"use server";

import { and, asc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_ADVERT_CHARS, readAdvert } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { cvs, jobDocuments, jobs, type Job } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";
import { OverviewInput, firstIssue, formFields } from "@/lib/forms";
import { scoreJob, type ScoreOutcome } from "@/lib/jobs/score";
import { isJobStatus } from "@/lib/jobs/status";
import { readUploadedText, removeUploads } from "@/lib/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// cvId scores with that CV for this one score (Compare my CVs); otherwise the job's CV.
export async function scoreJobAction(jobId: string, cvId?: string): Promise<ScoreOutcome> {
  const userId = await requireUserId();
  const outcome = await scoreJob(userId, String(jobId), cvId && UUID.test(cvId) ? cvId : undefined);
  if (outcome.ok) refresh();
  return outcome;
}

// Picks the CV a job is scored and written with. null = use the default CV.
export async function setJobCv(jobId: string, cvId: string | null): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const ok = await userDb(async (tx) => {
    if (cvId) {
      const [cv] = await tx.select({ id: cvs.id }).from(cvs).where(and(eq(cvs.id, String(cvId)), eq(cvs.userId, userId)));
      if (!cv) return false;
    }
    const rows = await tx
      .update(jobs)
      .set({ cvId: cvId || null })
      .where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    return rows.length > 0;
  });
  if (ok) refresh();
  return { ok };
}

// Moves a job to a new stage. The database logs the change in job_status_history
// and sets submitted_at the first time it reaches an applied stage. Changing the
// stage of a Find jobs suggestion also moves it into the pipeline.
export async function setJobStatus(jobId: string, status: string): Promise<{ ok: boolean; message?: string }> {
  if (!isJobStatus(status)) return { ok: false, message: "Unknown stage." };
  const userId = await requireUserId();
  const rows = await userDb((tx) =>
    tx
      .update(jobs)
      .set({ status, inbox: null })
      .where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)))
      .returning({ id: jobs.id }),
  );
  if (!rows.length) return { ok: false, message: "That job could not be found." };
  refresh();
  return { ok: true };
}

export type OverviewState = { status: "idle" | "ok" | "error"; message?: string };

export async function saveOverview(_prev: OverviewState, formData: FormData): Promise<OverviewState> {
  const jobId = String(formData.get("jobId") ?? "");
  const parsed = OverviewInput.safeParse(formFields(formData));
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
  return { status: "ok", message: "Changes saved." };
}

// Deletes a job with its scores, documents and history (they cascade).
export async function deleteJob(jobId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const files = await userDb(async (tx) => {
    const docs = await tx.select({ path: jobDocuments.filePath }).from(jobDocuments).where(eq(jobDocuments.jobId, String(jobId)));
    const rows = await tx
      .delete(jobs)
      .where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    return rows.length ? docs.map((d) => d.path) : null;
  });
  if (!files) return { ok: false };
  await removeUploads("job-docs", files);
  redirect("/pipeline");
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

  await userDb((tx) => tx.update(jobs).set({ advertText: advert }).where(eq(jobs.id, jobId)));
  if (intent === "save") {
    refresh();
    return { status: "ok", message: "Advert saved.", at: Date.now() };
  }
  if (advert.trim().length < 80) return { status: "error", message: "Paste the full advert first." };
  return readAndRescore(userId, job, advert);
}

// Reads the criteria from the uploaded documents (and the advert, if any), then re-scores.
export async function readCriteriaFromDocuments(jobId: string): Promise<AdvertEditState> {
  const userId = await requireUserId();
  const { job, docs } = await userDb(async (tx) => ({
    job: (await tx.select().from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId))))[0],
    docs: await tx.select().from(jobDocuments).where(eq(jobDocuments.jobId, String(jobId))).orderBy(asc(jobDocuments.createdAt)),
  }));
  if (!job) return { status: "error", message: "That job could not be found." };
  if (!docs.length) return { status: "error", message: "Upload the job description or person specification first." };
  const source = [job.advertText.trim(), ...docs.map((d) => `${d.name}\n\n${d.text}`)].filter(Boolean).join("\n\n---\n\n");
  return readAndRescore(userId, job, source.slice(0, MAX_ADVERT_CHARS));
}

async function readAndRescore(userId: string, job: Job, source: string): Promise<AdvertEditState> {
  try {
    await consumeAiCall(userId);
    const { advert: read } = await readAdvert(source);
    // Fill in details the job is missing; never overwrite what the user has set.
    const fill = <T extends string | null>(current: T, found: T) => (current ? current : found);
    await userDb((tx) =>
      tx
        .update(jobs)
        .set({
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
        .where(eq(jobs.id, job.id)),
    );
    const criteria = read.essential.length + read.desirable.length;
    if (criteria === 0) {
      refresh();
      return { status: "ok", message: "Read, but no person specification was found.", at: Date.now() };
    }
    // New criteria make the old score out of date, so score again straight away.
    const scored = await scoreJob(userId, job.id);
    refresh();
    return scored.ok
      ? { status: "ok", message: `Criteria updated (${criteria}) and the job was scored ${scored.score}/10.`, at: Date.now() }
      : { status: "ok", message: `Criteria updated (${criteria}). ${scored.message}`, at: Date.now() };
  } catch (e) {
    return { status: "error", message: aiErrorMessage(e) };
  }
}

const MAX_DOCUMENTS = 5;

// Stores a job document the browser has just uploaded to the private job-docs bucket.
export async function addJobDocument(jobId: string, path: string, name: string): Promise<{ ok: true; chars: number } | { ok: false; message: string }> {
  const userId = await requireUserId();
  if (!String(path).startsWith(`${userId}/${jobId}/`)) return { ok: false, message: "That upload could not be found." };
  const count = await userDb(async (tx) => {
    const [job] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.userId, userId)));
    if (!job) return -1;
    return (await tx.select({ id: jobDocuments.id }).from(jobDocuments).where(eq(jobDocuments.jobId, String(jobId)))).length;
  });
  if (count < 0) return { ok: false, message: "That job could not be found." };
  if (count >= MAX_DOCUMENTS) {
    await removeUploads("job-docs", [path]);
    return { ok: false, message: `A job can have up to ${MAX_DOCUMENTS} documents.` };
  }

  const result = await readUploadedText("job-docs", path, userId);
  if (!result.ok) return result;
  await userDb((tx) =>
    tx.insert(jobDocuments).values({
      jobId: String(jobId),
      name: String(name).replace(/[^\w .()-]/g, "").slice(0, 120) || "Document",
      filePath: path,
      text: result.text,
    }),
  );
  refresh();
  return { ok: true, chars: result.text.length };
}

export async function deleteJobDocument(documentId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const [row] = await userDb((tx) =>
    tx
      .delete(jobDocuments)
      .where(and(eq(jobDocuments.id, String(documentId)), eq(jobDocuments.userId, userId)))
      .returning({ path: jobDocuments.filePath }),
  );
  if (!row) return { ok: false };
  await removeUploads("job-docs", [row.path]);
  refresh();
  return { ok: true };
}
