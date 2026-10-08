import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { Tx } from "./index";
import { fitScores, jobSearches, jobStatusHistory, jobs, profiles } from "./schema";

// All queries run under RLS, so they only ever see the signed-in user's rows.

export async function getPipelineSummary(tx: Tx) {
  const [{ jobCount }] = await tx.select({ jobCount: count() }).from(jobs).where(isNull(jobs.inbox));
  const [profile] = await tx.select({ cvText: profiles.cvText }).from(profiles).limit(1);
  return { jobCount, hasCv: Boolean(profile?.cvText.trim()) };
}

// The newest score for each job, keyed by job id.
export async function latestScores(tx: Tx) {
  const rows = await tx
    .selectDistinctOn([fitScores.jobId], {
      jobId: fitScores.jobId,
      score: fitScores.score,
      verdict: fitScores.verdict,
      createdAt: fitScores.createdAt,
    })
    .from(fitScores)
    .orderBy(fitScores.jobId, desc(fitScores.createdAt));
  return new Map(rows.map((r) => [r.jobId, r]));
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
      essential: jobs.essential,
      desirable: jobs.desirable,
      advertText: jobs.advertText,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(which === "pipeline" ? isNull(jobs.inbox) : and(eq(jobs.inbox, "suggested")))
    .orderBy(desc(jobs.createdAt));
  const scores = await latestScores(tx);
  return rows.map(({ essential, desirable, advertText, ...j }) => {
    const s = scores.get(j.id);
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

export async function getSearch(tx: Tx) {
  const [search] = await tx.select().from(jobSearches).limit(1);
  return search ?? null;
}

export async function getJobDetail(tx: Tx, id: string) {
  const [job] = await tx.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return null;
  const scores = await tx.select().from(fitScores).where(eq(fitScores.jobId, id)).orderBy(desc(fitScores.createdAt)).limit(10);
  const history = await tx
    .select({ status: jobStatusHistory.status, changedAt: jobStatusHistory.changedAt })
    .from(jobStatusHistory)
    .where(eq(jobStatusHistory.jobId, id))
    .orderBy(asc(jobStatusHistory.changedAt));
  const [profile] = await tx.select({ cvText: profiles.cvText }).from(profiles).limit(1);
  return { job, scores, history, hasCv: Boolean(profile?.cvText.trim()) };
}
