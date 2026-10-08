"use server";

import { and, desc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { askWritingQuestions } from "@/lib/ai/client";
import { noDash } from "@/lib/ai/clean";
import { aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { WRITING_KINDS, type WritingKind } from "@/lib/ai/writing";
import { drafts, jobs } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { AppQuestionsInput, WritingInputs, firstIssue, formFields } from "@/lib/forms";
import { APPLIED_STATUSES } from "@/lib/jobs/status";
import { loadWritingContext } from "@/lib/writing/context";

const isKind = (k: unknown): k is WritingKind => WRITING_KINDS.includes(k as WritingKind);

export type InputsState = { status: "idle" | "ok" | "error"; message?: string };

// Why this role and employer, and the supporting statement's limit.
export async function saveWritingInputs(_prev: InputsState, formData: FormData): Promise<InputsState> {
  const jobId = String(formData.get("jobId") ?? "");
  const parsed = WritingInputs.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const userId = await requireUserId();
  const rows = await userDb((tx) =>
    tx
      .update(jobs)
      .set(parsed.data)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
      .returning({ id: jobs.id }),
  );
  if (!rows.length) return { status: "error", message: "That job could not be found." };
  refresh();
  return { status: "ok", message: "Saved." };
}

// The application form's questions for this job, each with its own limit.
export async function saveAppQuestions(jobId: string, questions: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = AppQuestionsInput.safeParse(questions);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const userId = await requireUserId();
  const rows = await userDb((tx) =>
    tx
      .update(jobs)
      .set({ appQuestions: parsed.data })
      .where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)))
      .returning({ id: jobs.id }),
  );
  if (!rows.length) return { ok: false, message: "That job could not be found." };
  refresh();
  return { ok: true };
}

// "Ask me first": Claude's questions are saved on the job with empty answers.
export async function askFirst(jobId: string, kind: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isKind(kind)) return { ok: false, message: "Unknown kind of writing." };
  const userId = await requireUserId();
  const ctx = await userDb((tx) => loadWritingContext(tx, String(jobId), kind));
  if (!ctx) return { ok: false, message: "That job could not be found." };
  if (!ctx.cv) return { ok: false, message: "Add a CV in My profile first." };
  try {
    await consumeAiCall(userId);
    const questions = await askWritingQuestions(kind, ctx.profileForAi, ctx.jobForAi);
    await userDb((tx) =>
      tx
        .update(jobs)
        .set({ writingQa: { ...ctx.job.writingQa, [kind]: questions.map((question) => ({ question, answer: "" })) } })
        .where(eq(jobs.id, ctx.job.id)),
    );
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: aiErrorMessage(e) };
  }
}

export async function saveAnswers(jobId: string, kind: string, answers: string[]): Promise<{ ok: boolean }> {
  if (!isKind(kind) || !Array.isArray(answers)) return { ok: false };
  const userId = await requireUserId();
  const ok = await userDb(async (tx) => {
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)));
    if (!job) return false;
    const current = job.writingQa[kind] ?? [];
    const updated = current.map((qa, i) => ({ ...qa, answer: String(answers[i] ?? "").slice(0, 2_000) }));
    await tx.update(jobs).set({ writingQa: { ...job.writingQa, [kind]: updated } }).where(eq(jobs.id, job.id));
    return true;
  });
  if (ok) refresh();
  return { ok };
}

export async function clearQuestions(jobId: string, kind: string): Promise<{ ok: boolean }> {
  if (!isKind(kind)) return { ok: false };
  const userId = await requireUserId();
  const ok = await userDb(async (tx) => {
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)));
    if (!job) return false;
    const next = { ...job.writingQa };
    delete next[kind];
    await tx.update(jobs).set({ writingQa: next }).where(eq(jobs.id, job.id));
    return true;
  });
  if (ok) refresh();
  return { ok };
}

// A version is locked once it is marked sent and the job has been applied for.
async function loadDraft(draftId: string, userId: string) {
  return userDb(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, String(draftId)), eq(drafts.userId, userId)));
    if (!draft) return null;
    const [job] = await tx.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, draft.jobId));
    return { draft, locked: draft.isSent && APPLIED_STATUSES.has(job.status) };
  });
}

async function nextVersion(jobId: string, kind: WritingKind) {
  const [last] = await userDb((tx) =>
    tx
      .select({ version: drafts.version })
      .from(drafts)
      .where(and(eq(drafts.jobId, jobId), eq(drafts.kind, kind)))
      .orderBy(desc(drafts.version))
      .limit(1),
  );
  return (last?.version ?? 0) + 1;
}

// Saves edits as a new version, so every earlier version stays as it was.
export async function saveDraftEdit(draftId: string, content: string): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  const found = await loadDraft(draftId, userId);
  if (!found) return { ok: false, message: "That version could not be found." };
  const text = noDash(String(content)).slice(0, 60_000);
  if (text.trim() === found.draft.content.trim()) return { ok: true, message: "No changes to save." };
  const version = await nextVersion(found.draft.jobId, found.draft.kind);
  await userDb((tx) =>
    tx.insert(drafts).values({
      jobId: found.draft.jobId,
      kind: found.draft.kind,
      content: text,
      review: found.draft.review,
      version,
      cvName: found.draft.cvName,
    }),
  );
  refresh();
  return { ok: true, message: `Saved as version ${version}.` };
}

// Marks the version that was sent with the application (one per job and kind).
export async function markSent(draftId: string): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  const found = await loadDraft(draftId, userId);
  if (!found) return { ok: false, message: "That version could not be found." };
  const { draft } = found;
  const blocked = await userDb(async (tx) => {
    const [current] = await tx
      .select()
      .from(drafts)
      .where(and(eq(drafts.jobId, draft.jobId), eq(drafts.kind, draft.kind), eq(drafts.isSent, true)));
    const [job] = await tx.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, draft.jobId));
    if (current && current.id !== draft.id && APPLIED_STATUSES.has(job.status)) return true;
    if (current) await tx.update(drafts).set({ isSent: false }).where(eq(drafts.id, current.id));
    await tx.update(drafts).set({ isSent: true }).where(eq(drafts.id, draft.id));
    return false;
  });
  if (blocked) return { ok: false, message: "Another version is locked as sent because you have already applied." };
  refresh();
  return { ok: true };
}
