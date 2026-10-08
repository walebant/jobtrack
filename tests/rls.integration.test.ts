// Proves row level security against the real Supabase database.
// Creates two throwaway users, checks neither can touch the other's rows,
// then deletes them (their rows go with them). Skipped until .env.local is filled.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, withUser, type JwtClaims } from "@/lib/db";
import { consumeAiCall } from "@/lib/ai/usage";
import { aiUsage, cvs, fitScores, jobDocuments, jobs, jobStatusHistory, profiles } from "@/lib/db/schema";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = Boolean(url && anonKey && serviceKey && process.env.DATABASE_URL);

describe.skipIf(!ready)("row level security", { timeout: 30_000 }, () => {
  let admin: SupabaseClient;
  let a: JwtClaims;
  let b: JwtClaims;
  let jobA: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const make = async (label: string): Promise<JwtClaims> => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `rls-${label}-${randomUUID().slice(0, 8)}@example.test`,
        email_confirm: true,
      });
      if (error) throw error;
      return { sub: data.user.id, role: "authenticated" };
    };
    a = await make("a");
    b = await make("b");
  });

  afterAll(async () => {
    for (const u of [a, b]) if (u) await admin.auth.admin.deleteUser(u.sub);
    await adminDb().$client.end();
  });

  it("creates a profile for each new user, visible only to them", async () => {
    const rows = await withUser(a, (tx) => tx.select().from(profiles));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(a.sub);
  });

  it("fills user_id from the session and logs the first status", async () => {
    const [job] = await withUser(a, (tx) => tx.insert(jobs).values({ title: "RLS test job", employer: "Test Trust" }).returning());
    jobA = job.id;
    expect(job.userId).toBe(a.sub);
    expect(job.status).toBe("saved");

    const history = await withUser(a, (tx) => tx.select().from(jobStatusHistory).where(eq(jobStatusHistory.jobId, jobA)));
    expect(history.map((h) => h.status)).toEqual(["saved"]);
  });

  it("hides one user's rows from another", async () => {
    await withUser(b, async (tx) => {
      expect(await tx.select().from(jobs)).toHaveLength(0);
      expect(await tx.select().from(jobStatusHistory)).toHaveLength(0);
      const profileRows = await tx.select().from(profiles);
      expect(profileRows.map((p) => p.userId)).toEqual([b.sub]);
    });
  });

  it("blocks updates and deletes on another user's job", async () => {
    const updated = await withUser(b, (tx) => tx.update(jobs).set({ title: "Hacked" }).where(eq(jobs.id, jobA)).returning());
    const deleted = await withUser(b, (tx) => tx.delete(jobs).where(eq(jobs.id, jobA)).returning());
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);

    const [job] = await withUser(a, (tx) => tx.select().from(jobs).where(eq(jobs.id, jobA)));
    expect(job.title).toBe("RLS test job");
  });

  it("blocks writing rows as another user or onto another user's job", async () => {
    await expect(withUser(b, (tx) => tx.insert(jobs).values({ userId: a.sub, title: "Planted" }))).rejects.toThrow();
    await expect(
      withUser(b, (tx) => tx.insert(fitScores).values({ jobId: jobA, score: 9, verdict: "apply", summary: "x", model: "test" })),
    ).rejects.toThrow();
  });

  it("sets submitted_at and logs each stage change", async () => {
    const [job] = await withUser(a, (tx) =>
      tx.update(jobs).set({ status: "submitted" }).where(eq(jobs.id, jobA)).returning(),
    );
    expect(job.submittedAt).toBeInstanceOf(Date);

    const history = await withUser(a, (tx) =>
      tx.select().from(jobStatusHistory).where(eq(jobStatusHistory.jobId, jobA)).orderBy(jobStatusHistory.changedAt),
    );
    expect(history.map((h) => h.status)).toEqual(["saved", "submitted"]);
  });

  it("lets users read their AI count but never change it, and stops at the limit", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    expect(await consumeAiCall(a.sub)).toBe(1);
    expect(await consumeAiCall(a.sub)).toBe(2);
    await expect(consumeAiCall(a.sub)).rejects.toMatchObject({ code: "limit" });
    delete process.env.AI_DAILY_LIMIT;

    const own = await withUser(a, (tx) => tx.select().from(aiUsage));
    expect(own.map((r) => r.calls)).toEqual([2]);
    expect(await withUser(b, (tx) => tx.select().from(aiUsage))).toHaveLength(0);

    // Writes are refused (no policy) or silently match nothing.
    const reset = await withUser(a, (tx) => tx.update(aiUsage).set({ calls: 0 }).returning());
    expect(reset).toHaveLength(0);
    await expect(withUser(a, (tx) => tx.insert(aiUsage).values({ userId: a.sub, day: "2000-01-01", calls: 0 }))).rejects.toThrow();
    const cleared = await withUser(a, (tx) => tx.delete(aiUsage).returning());
    expect(cleared).toHaveLength(0);
  });

  it("keeps CVs private, allows one default, and links jobs only to the owner's CVs", async () => {
    const [cvA] = await withUser(a, (tx) => tx.insert(cvs).values({ name: "A main", cvText: "A", isDefault: true }).returning());
    const [cvB] = await withUser(b, (tx) => tx.insert(cvs).values({ name: "B main", cvText: "B", isDefault: true }).returning());
    expect(await withUser(b, (tx) => tx.select().from(cvs))).toHaveLength(1);

    // A second default for the same user is refused.
    await expect(withUser(a, (tx) => tx.insert(cvs).values({ name: "A2", isDefault: true }))).rejects.toThrow();

    // A job can use its owner's CV, never someone else's.
    await withUser(a, (tx) => tx.update(jobs).set({ cvId: cvA.id }).where(eq(jobs.id, jobA)));
    await expect(withUser(a, (tx) => tx.update(jobs).set({ cvId: cvB.id }).where(eq(jobs.id, jobA)))).rejects.toThrow();

    // Deleting the CV clears only the job's cv_id.
    await withUser(a, (tx) => tx.delete(cvs).where(eq(cvs.id, cvA.id)));
    const [job] = await withUser(a, (tx) => tx.select().from(jobs).where(eq(jobs.id, jobA)));
    expect(job.cvId).toBeNull();
    expect(job.userId).toBe(a.sub);
  });

  it("keeps job documents private and tied to the owner's jobs", async () => {
    await withUser(a, (tx) => tx.insert(jobDocuments).values({ jobId: jobA, name: "JD.pdf", filePath: `${a.sub}/${jobA}/1.pdf`, text: "x" }));
    expect(await withUser(b, (tx) => tx.select().from(jobDocuments))).toHaveLength(0);
    await expect(
      withUser(b, (tx) => tx.insert(jobDocuments).values({ jobId: jobA, name: "x", filePath: `${b.sub}/x.pdf` })),
    ).rejects.toThrow();
  });

  it("gives signed-out API callers nothing", async () => {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    for (const table of ["profiles", "jobs", "job_status_history", "fit_scores", "drafts", "prep_questions", "evidence", "ai_usage", "job_searches", "cvs", "job_documents"]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
  });
});
