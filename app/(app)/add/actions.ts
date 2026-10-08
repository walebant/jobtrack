"use server";

import { refresh } from "next/cache";
import { readAdvert, readAlertEmail, MAX_ADVERT_CHARS } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import type { FoundJob } from "@/lib/ai/schemas";
import { consumeAiCall } from "@/lib/ai/usage";
import { jobs } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { AdvertInput, AlertInput, FoundJobsInput, ManualJobInput, firstIssue, formFields } from "@/lib/forms";
import { markDuplicates } from "@/lib/jobs/duplicates";
import { scoreJob } from "@/lib/jobs/score";

export type SavedJobSummary = {
  id: string;
  title: string;
  employer: string;
  band: string;
  salary: string;
  closingDate: string | null;
  sponsorship: "yes" | "no" | "unknown";
  essential: string[];
  desirable: string[];
};

export type AdvertState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "saved";
      job: SavedJobSummary;
      // The fit score, or why the job was not scored.
      fit: { score: number; verdict: "apply" | "maybe" | "skip"; capped: boolean } | { note: string };
      seconds: number;
      at: number;
    };

// Reads a pasted advert, saves the job, then scores it straight away.
export async function readAdvertAndSave(_prev: AdvertState, formData: FormData): Promise<AdvertState> {
  const parsed = AdvertInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const userId = await requireUserId();
  const started = Date.now();

  let job: typeof jobs.$inferSelect;
  try {
    await consumeAiCall(userId);
    const { advert } = await readAdvert(parsed.data.advert);
    [job] = await userDb((tx) =>
      tx
        .insert(jobs)
        .values({
          ...advert,
          title: advert.title || "Untitled job",
          link: parsed.data.link || advert.link,
          advertText: parsed.data.advert.slice(0, MAX_ADVERT_CHARS),
          source: "paste",
        })
        .returning(),
    );
  } catch (e) {
    return { status: "error", message: aiErrorMessage(e) };
  }

  // The job is saved either way; a scoring problem is shown as a note.
  const scored = await scoreJob(userId, job.id);
  refresh();
  return {
      status: "saved",
      fit: scored.ok ? { score: scored.score, verdict: scored.verdict, capped: scored.capped } : { note: scored.message },
      seconds: Math.round((Date.now() - started) / 1000),
      at: Date.now(),
      job: {
        id: job.id,
        title: job.title,
        employer: job.employer,
        band: job.band,
        salary: job.salary,
        closingDate: job.closingDate,
        sponsorship: job.sponsorship,
        essential: job.essential,
        desirable: job.desirable,
      },
    };
}

export type FoundJobWithPick = FoundJob & { pick: boolean };
export type AlertState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "found"; jobs: FoundJobWithPick[]; at: number };

export async function readAlert(_prev: AlertState, formData: FormData): Promise<AlertState> {
  const parsed = AlertInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const userId = await requireUserId();

  try {
    await consumeAiCall(userId);
    const found = await readAlertEmail(parsed.data.email);
    const existing = await userDb((tx) => tx.select({ title: jobs.title, employer: jobs.employer }).from(jobs));
    return { status: "found", jobs: markDuplicates(found, existing), at: Date.now() };
  } catch (e) {
    return { status: "error", message: aiErrorMessage(e) };
  }
}

export async function saveFoundJobs(picked: unknown): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const parsed = FoundJobsInput.safeParse(picked);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  await userDb((tx) => tx.insert(jobs).values(parsed.data.map((j) => ({ ...j, source: "alert" as const }))));
  refresh();
  return { ok: true, count: parsed.data.length };
}

export type ManualState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; id: string; title: string; at: number };

export async function addManualJob(_prev: ManualState, formData: FormData): Promise<ManualState> {
  const parsed = ManualJobInput.safeParse(formFields(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const [job] = await userDb((tx) => tx.insert(jobs).values({ ...parsed.data, source: "manual" }).returning({ id: jobs.id }));
  refresh();
  return { status: "saved", id: job.id, title: parsed.data.title, at: Date.now() };
}
