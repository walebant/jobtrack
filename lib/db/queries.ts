import { count } from "drizzle-orm";
import type { Tx } from "./index";
import { jobs, profiles } from "./schema";

// RLS limits both queries to the signed-in user's rows.
export async function getPipelineSummary(tx: Tx) {
  const [{ jobCount }] = await tx.select({ jobCount: count() }).from(jobs);
  const [profile] = await tx.select({ cvText: profiles.cvText }).from(profiles).limit(1);
  return { jobCount, hasCv: Boolean(profile?.cvText.trim()) };
}
