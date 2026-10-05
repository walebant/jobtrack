"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { MAX_CV_BYTES, extractCvText } from "@/lib/cv/extract";
import { evidence, profiles } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { EvidenceInput, ProfileInput, firstIssue, formFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export type FormState = { status: "idle" | "ok" | "error"; message?: string; at?: number };

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ProfileInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const { cvText, notes } = parsed.data;

  await userDb((tx, userId) =>
    tx
      .insert(profiles)
      .values({ userId, cvText, notes })
      .onConflictDoUpdate({ target: profiles.userId, set: { cvText, notes } }),
  );
  refresh();
  return { status: "ok", message: "Profile saved.", at: Date.now() };
}

export type ExtractResult = { ok: true; text: string } | { ok: false; message: string };

// Reads the text out of a CV the browser has just uploaded to the private cvs bucket.
export async function extractUploadedCv(path: string): Promise<ExtractResult> {
  const userId = await requireUserId();
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) {
    return { ok: false, message: "That upload could not be found. Try again." };
  }

  // The user's own session: storage RLS only lets them read their own folder.
  const supabase = await createClient();
  const bucket = supabase.storage.from("cvs");
  const { data: file, error } = await bucket.download(path);
  if (error || !file) return { ok: false, message: "That upload could not be found. Try again." };
  if (file.size > MAX_CV_BYTES) {
    await bucket.remove([path]);
    return { ok: false, message: "That file is over 10 MB. Upload a smaller copy." };
  }

  let text = "";
  try {
    text = await extractCvText(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("[cv] text extraction failed", e);
  }
  if (!text) {
    await bucket.remove([path]);
    return {
      ok: false,
      message: "No text could be read from that file. If it is a scanned PDF, paste your CV into the box instead.",
    };
  }

  // Keep only the latest upload.
  const previous = await userDb(async (tx, uid) => {
    const [row] = await tx.select({ path: profiles.cvFilePath }).from(profiles).where(eq(profiles.userId, uid));
    await tx.update(profiles).set({ cvFilePath: path }).where(eq(profiles.userId, uid));
    return row?.path ?? null;
  });
  if (previous && previous !== path) await bucket.remove([previous]);

  return { ok: true, text };
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
