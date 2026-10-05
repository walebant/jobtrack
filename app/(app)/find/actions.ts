"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { processSuggestion, startDiscovery, type ProcessOutcome, type StartOutcome } from "@/lib/discovery/run";
import { jobSearches, jobs } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { SearchInput, firstIssue, formFields } from "@/lib/forms";

export type SearchFormState = { status: "idle" | "ok" | "error"; message?: string };

export async function saveSearch(_prev: SearchFormState, formData: FormData): Promise<SearchFormState> {
  const parsed = SearchInput.safeParse({
    ...formFields(formData),
    staffGroups: formData.getAll("staffGroups"),
    bands: formData.getAll("bands"),
  });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  await userDb((tx, userId) =>
    tx
      .insert(jobSearches)
      .values({ userId, ...parsed.data })
      .onConflictDoUpdate({ target: jobSearches.userId, set: parsed.data }),
  );
  refresh();
  return { status: "ok", message: "Search saved." };
}

export async function startRun(): Promise<StartOutcome> {
  const userId = await requireUserId();
  const outcome = await startDiscovery(userId);
  if (outcome.ok) refresh();
  return outcome;
}

export async function processOne(jobId: string): Promise<ProcessOutcome> {
  const userId = await requireUserId();
  const outcome = await processSuggestion(userId, String(jobId));
  refresh();
  return outcome;
}

// Save moves a suggestion into the pipeline as Saved; dismiss hides it for good.
export async function decideSuggestion(jobId: string, decision: "save" | "dismiss"): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const rows = await userDb((tx) =>
    tx
      .update(jobs)
      .set({ inbox: decision === "save" ? null : "dismissed" })
      .where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId), eq(jobs.inbox, "suggested")))
      .returning({ id: jobs.id }),
  );
  refresh();
  return { ok: rows.length > 0 };
}
