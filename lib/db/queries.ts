import { count, desc } from "drizzle-orm";
import type { Tx } from "./index";
import { jobs, profiles } from "./schema";

// Newest first. RLS limits it to the signed-in user's jobs.
export function listJobs(tx: Tx) {
  return tx
    .select({
      id: jobs.id,
      title: jobs.title,
      employer: jobs.employer,
      band: jobs.band,
      status: jobs.status,
      closingDate: jobs.closingDate,
      source: jobs.source,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt));
}
export type JobListItem = Awaited<ReturnType<typeof listJobs>>[number];

// RLS limits both queries to the signed-in user's rows.
export async function getPipelineSummary(tx: Tx) {
  const [{ jobCount }] = await tx.select({ jobCount: count() }).from(jobs);
  const [profile] = await tx.select({ cvText: profiles.cvText }).from(profiles).limit(1);
  return { jobCount, hasCv: Boolean(profile?.cvText.trim()) };
}
