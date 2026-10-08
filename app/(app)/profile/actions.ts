"use server";

import { and, asc, count, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { cvs, evidence, profiles } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { CvInput, EvidenceInput, NotesInput, firstIssue, formFields } from "@/lib/forms";
import { readUploadedText, removeUploads, type ReadResult } from "@/lib/uploads";

export type FormState = { status: "idle" | "ok" | "error"; message?: string; at?: number };

const MAX_CVS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Anything else Claude should know" (shared by all CVs).
export async function saveNotes(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = NotesInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const { notes } = parsed.data;
  await userDb((tx, userId) =>
    tx.insert(profiles).values({ userId, notes }).onConflictDoUpdate({ target: profiles.userId, set: { notes } }),
  );
  refresh();
  return { status: "ok", message: "Notes saved.", at: Date.now() };
}

export async function saveCv(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = CvInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const rows = await userDb((tx, userId) =>
    tx.update(cvs).set(parsed.data).where(and(eq(cvs.id, id), eq(cvs.userId, userId))).returning({ id: cvs.id }),
  );
  if (!rows.length) return { status: "error", message: "That CV no longer exists." };
  refresh();
  return { status: "ok", message: "CV saved.", at: Date.now() };
}

// A new CV, empty or copied from another. The first CV becomes the default.
export async function createCv(copyFromId?: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  return userDb(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(cvs);
    if (n >= MAX_CVS) return { ok: false as const, message: `You can keep up to ${MAX_CVS} CVs.` };
    const [source] = copyFromId && UUID.test(copyFromId) ? await tx.select().from(cvs).where(eq(cvs.id, copyFromId)) : [];
    const [created] = await tx
      .insert(cvs)
      .values({
        name: source ? `${source.name} (copy)`.slice(0, 80) : n === 0 ? "Main CV" : `CV ${n + 1}`,
        cvText: source?.cvText ?? "",
        focus: source?.focus ?? "",
        isDefault: n === 0,
      })
      .returning({ id: cvs.id });
    refresh();
    return { ok: true as const, id: created.id };
  });
}

export async function setDefaultCv(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const ok = await userDb(async (tx) => {
    const [target] = await tx.select({ id: cvs.id }).from(cvs).where(and(eq(cvs.id, String(id)), eq(cvs.userId, userId)));
    if (!target) return false;
    // Clear the old default first: the database allows only one.
    await tx
      .update(cvs)
      .set({ isDefault: false })
      .where(and(eq(cvs.userId, userId), ne(cvs.id, target.id), eq(cvs.isDefault, true)));
    await tx.update(cvs).set({ isDefault: true }).where(eq(cvs.id, target.id));
    return true;
  });
  refresh();
  return { ok };
}

// Jobs that used this CV switch to the default. If it was the default, the oldest other CV takes over.
export async function deleteCv(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const removed = await userDb(async (tx) => {
    const [row] = await tx.delete(cvs).where(and(eq(cvs.id, String(id)), eq(cvs.userId, userId))).returning();
    if (row?.isDefault) {
      const [next] = await tx.select({ id: cvs.id }).from(cvs).orderBy(asc(cvs.createdAt)).limit(1);
      if (next) await tx.update(cvs).set({ isDefault: true }).where(eq(cvs.id, next.id));
    }
    return row ?? null;
  });
  if (removed) await removeUploads("cvs", [removed.filePath]);
  refresh();
  return { ok: Boolean(removed) };
}

// Reads the text of a CV file just uploaded for the given CV. The text goes back to
// the browser to check before saving; the file replaces the CV's previous upload.
export async function extractUploadedCv(path: string, cvId: string): Promise<ReadResult> {
  const userId = await requireUserId();
  const result = await readUploadedText("cvs", path, userId);
  if (!result.ok) return result;
  const previous = await userDb(async (tx) => {
    const [row] = await tx
      .select({ path: cvs.filePath })
      .from(cvs)
      .where(and(eq(cvs.id, String(cvId)), eq(cvs.userId, userId)));
    if (row) await tx.update(cvs).set({ filePath: path }).where(eq(cvs.id, String(cvId)));
    return row?.path ?? null;
  });
  if (previous && previous !== path) await removeUploads("cvs", [previous]);
  return result;
}

export async function saveEvidence(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = formFields(formData);
  const parsed = EvidenceInput.safeParse({ ...fields, id: fields.id || undefined });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const { id, title, tags, story } = parsed.data;

  const saved = await userDb(async (tx, userId) => {
    if (!id) {
      await tx.insert(evidence).values({ title, tags, story });
      return true;
    }
    const rows = await tx
      .update(evidence)
      .set({ title, tags, story })
      .where(and(eq(evidence.id, id), eq(evidence.userId, userId)))
      .returning({ id: evidence.id });
    return rows.length > 0;
  });
  if (!saved) return { status: "error", message: "That example no longer exists." };

  refresh();
  return { status: "ok", message: id ? "Example updated." : "Example added.", at: Date.now() };
}

export async function deleteEvidence(id: string): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  await userDb((tx, userId) => tx.delete(evidence).where(and(eq(evidence.id, id), eq(evidence.userId, userId))));
  refresh();
  return { ok: true };
}
