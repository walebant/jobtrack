import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { listCvs, pickCv } from "@/lib/cvs";
import type { JobStatus } from "@/lib/jobs/stages";
import type { Tx } from "./index";
import { cvs, drafts, fitScores, jobDocuments, jobSearches, jobStatusHistory, jobs } from "./schema";

// All queries run under RLS, so they only ever see the signed-in user's rows.

export async function getPipelineSummary(tx: Tx) {
  const [{ jobCount }] = await tx.select({ jobCount: count() }).from(jobs).where(isNull(jobs.inbox));
  return { jobCount, hasCv: await hasUsableCv(tx) };
}

// The newest score per job and CV. Scores from before CVs existed (cv_id null)
// count as the default CV's.
async function latestScoresByCv(tx: Tx) {
  const rows = await tx
    .selectDistinctOn([fitScores.jobId, fitScores.cvId], {
      jobId: fitScores.jobId,
      cvId: fitScores.cvId,
      score: fitScores.score,
      verdict: fitScores.verdict,
      createdAt: fitScores.createdAt,
    })
    .from(fitScores)
    .orderBy(fitScores.jobId, fitScores.cvId, desc(fitScores.createdAt));
  const byJob = new Map<string, typeof rows>();
  for (const r of rows) byJob.set(r.jobId, [...(byJob.get(r.jobId) ?? []), r]);
  return byJob;
}

// Pipeline jobs (inbox = null), or the Find jobs suggestions.
export async function listJobs(tx: Tx, which: "pipeline" | "suggested" = "pipeline") {
  const rows = await tx
    .select({
      id: jobs.id,
      title: jobs.title,
      employer: jobs.employer,
      band: jobs.band,
      salary: jobs.salary,
      location: jobs.location,
      status: jobs.status,
      closingDate: jobs.closingDate,
      interviewDate: jobs.interviewDate,
      interviewTime: jobs.interviewTime,
      source: jobs.source,
      cvId: jobs.cvId,
      essential: jobs.essential,
      desirable: jobs.desirable,
      advertText: jobs.advertText,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(which === "pipeline" ? isNull(jobs.inbox) : and(eq(jobs.inbox, "suggested")))
    .orderBy(desc(jobs.createdAt));
  const scores = await latestScoresByCv(tx);
  const allCvs = await listCvs(tx);
  const defaultId = pickCv(allCvs)?.id ?? null;
  return rows.map(({ essential, desirable, advertText, cvId, ...j }) => {
    // The score shown is the one made with the job's CV (or the default CV).
    const jobCv = pickCv(allCvs, cvId)?.id ?? null;
    const s = scores.get(j.id)?.find((r) => (r.cvId ?? defaultId) === jobCv);
    return {
      ...j,
      hasCriteria: essential.length + desirable.length > 0,
      advertRead: advertText !== "",
      score: s?.score ?? null,
      verdict: s?.verdict ?? null,
    };
  });
}
export type JobListItem = Awaited<ReturnType<typeof listJobs>>[number];

// Pipeline jobs shaped for lib/stats.ts: stage, applied date, band, CV, the
// score for the job's CV, and every stage the job has been in.
export async function getStatsJobs(tx: Tx) {
  const list = await listJobs(tx);
  const rows = await tx
    .select({ id: jobs.id, submittedAt: jobs.submittedAt, cvId: jobs.cvId })
    .from(jobs)
    .where(isNull(jobs.inbox));
  const extra = new Map(rows.map((r) => [r.id, r]));
  const history = await tx.select({ jobId: jobStatusHistory.jobId, status: jobStatusHistory.status }).from(jobStatusHistory);
  const reached = new Map<string, JobStatus[]>();
  for (const h of history) reached.set(h.jobId, [...(reached.get(h.jobId) ?? []), h.status]);
  const allCvs = await listCvs(tx);
  return list.map((j) => ({
    status: j.status,
    submittedAt: extra.get(j.id)?.submittedAt ?? null,
    band: j.band,
    cvName: pickCv(allCvs, extra.get(j.id)?.cvId)?.name ?? null,
    score: j.score,
    reached: reached.get(j.id) ?? [],
  }));
}

export async function getSearch(tx: Tx) {
  const [search] = await tx.select().from(jobSearches).limit(1);
  return search ?? null;
}

export async function getJobDetail(tx: Tx, id: string) {
  const [job] = await tx.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return null;
  const scores = await tx.select().from(fitScores).where(eq(fitScores.jobId, id)).orderBy(desc(fitScores.createdAt)).limit(30);
  const history = await tx
    .select({ status: jobStatusHistory.status, changedAt: jobStatusHistory.changedAt })
    .from(jobStatusHistory)
    .where(eq(jobStatusHistory.jobId, id))
    .orderBy(asc(jobStatusHistory.changedAt));
  const documents = await tx
    .select({
      id: jobDocuments.id,
      name: jobDocuments.name,
      chars: sql<number>`length(${jobDocuments.text})`.mapWith(Number),
      createdAt: jobDocuments.createdAt,
    })
    .from(jobDocuments)
    .where(eq(jobDocuments.jobId, id))
    .orderBy(asc(jobDocuments.createdAt));
  const allCvs = await listCvs(tx);
  const cv = pickCv(allCvs, job.cvId);
  const draftVersions = await tx.select().from(drafts).where(eq(drafts.jobId, id)).orderBy(desc(drafts.version));
  return {
    job,
    scores,
    history,
    documents,
    drafts: draftVersions,
    cvs: allCvs.map((c) => ({ id: c.id, name: c.name, isDefault: c.isDefault, usable: Boolean(c.cvText.trim()) })),
    // The CV this job is scored and written with.
    cv: cv ? { id: cv.id, name: cv.name } : null,
    hasCv: cv !== null,
  };
}

// True when at least one CV has text.
export async function hasUsableCv(tx: Tx) {
  const [row] = await tx.select({ n: count() }).from(cvs).where(sql`btrim(${cvs.cvText}) <> ''`);
  return row.n > 0;
}
