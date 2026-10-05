"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { MAX_ADVERT_CHARS, readAdvert } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { jobs } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { scoreJob, type ScoreOutcome } from "@/lib/jobs/score";

export async function scoreJobAction(jobId: string): Promise<ScoreOutcome> {
  const userId = await requireUserId();
  const outcome = await scoreJob(userId, String(jobId));
  if (outcome.ok) refresh();
  return outcome;
}

export type AdvertEditState = { status: "idle" | "ok" | "error"; message?: string; at?: number };

// Saves the advert text. With intent "read", Claude reads it again to refresh
// the job's details and criteria, then the job is scored against the new criteria.
export async function saveAdvert(_prev: AdvertEditState, formData: FormData): Promise<AdvertEditState> {
  const jobId = String(formData.get("jobId") ?? "");
  const advert = String(formData.get("advert") ?? "").slice(0, MAX_ADVERT_CHARS);
  const intent = formData.get("intent") === "read" ? "read" : "save";
  const userId = await requireUserId();

  const [job] = await userDb((tx) => tx.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))));
  if (!job) return { status: "error", message: "That job could not be found." };

  if (intent === "save") {
    await userDb((tx) => tx.update(jobs).set({ advertText: advert }).where(eq(jobs.id, jobId)));
    refresh();
    return { status: "ok", message: "Advert saved.", at: Date.now() };
  }

  if (advert.trim().length < 80) return { status: "error", message: "Paste the full advert first." };

  try {
    await consumeAiCall(userId);
    const { advert: read } = await readAdvert(advert);
    // Fill in details the job is missing; never overwrite what the user has set.
    const fill = <T extends string | null>(current: T, found: T) => (current ? current : found);
    await userDb((tx) =>
      tx
        .update(jobs)
        .set({
          advertText: advert,
          title: fill(job.title, read.title) || "Untitled job",
          employer: fill(job.employer, read.employer),
          band: fill(job.band, read.band),
          salary: fill(job.salary, read.salary),
          location: fill(job.location, read.location),
          reference: fill(job.reference, read.reference),
          closingDate: fill(job.closingDate, read.closingDate),
          link: fill(job.link, read.link),
          sponsorship: job.sponsorship === "unknown" ? read.sponsorship : job.sponsorship,
          essential: read.essential,
          desirable: read.desirable,
        })
        .where(eq(jobs.id, jobId)),
    );
  } catch (e) {
    return { status: "error", message: aiErrorMessage(e) };
  }

  const found = await userDb((tx) => tx.select({ e: jobs.essential, d: jobs.desirable }).from(jobs).where(eq(jobs.id, jobId)));
  const criteria = found[0] ? found[0].e.length + found[0].d.length : 0;
  if (criteria === 0) {
    refresh();
    return { status: "ok", message: "Advert read, but no person specification was found in it.", at: Date.now() };
  }

  // New criteria make the old score out of date, so score again straight away.
  const scored = await scoreJob(userId, jobId);
  refresh();
  return scored.ok
    ? { status: "ok", message: `Criteria updated (${criteria}) and the job was scored ${scored.score}/10.`, at: Date.now() }
    : { status: "ok", message: `Criteria updated (${criteria}). ${scored.message}`, at: Date.now() };
}
