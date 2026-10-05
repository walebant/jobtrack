import { asc, eq } from "drizzle-orm";
import { scoreFit } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { evidence, fitScores, jobs, profiles } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";

export type ScoreOutcome =
  | { ok: true; score: number; verdict: "apply" | "maybe" | "skip"; capped: boolean }
  | { ok: false; reason: "not_found" | "no_cv" | "no_criteria" | "ai"; message: string };

export const NO_CV_MESSAGE = "Add your CV in My profile first, so the score is based on your real experience.";
export const NO_CRITERIA_MESSAGE =
  "This job has no person specification yet. Paste the full advert in the Advert tab, then score it.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Scores one of the signed-in user's jobs against their profile and saves the result.
// Every score is kept, so the job's score history stays visible.
export async function scoreJob(userId: string, jobId: string): Promise<ScoreOutcome> {
  if (!UUID.test(jobId)) return { ok: false, reason: "not_found", message: "That job could not be found." };

  const { job, profile, examples } = await userDb(async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    const [profile] = await tx.select().from(profiles).limit(1);
    const examples = await tx
      .select({ title: evidence.title, tags: evidence.tags, story: evidence.story })
      .from(evidence)
      .orderBy(asc(evidence.createdAt));
    return { job, profile, examples };
  });

  if (!job) return { ok: false, reason: "not_found", message: "That job could not be found." };
  if (!profile?.cvText.trim()) return { ok: false, reason: "no_cv", message: NO_CV_MESSAGE };
  if (job.essential.length + job.desirable.length === 0) {
    return { ok: false, reason: "no_criteria", message: NO_CRITERIA_MESSAGE };
  }

  try {
    await consumeAiCall(userId);
    const { fit, model } = await scoreFit({ cvText: profile.cvText, notes: profile.notes, evidence: examples }, job);
    await userDb((tx) =>
      tx.insert(fitScores).values({
        jobId,
        score: fit.score,
        verdict: fit.verdict,
        summary: fit.summary,
        criteria: fit.criteria,
        model,
      }),
    );
    return { ok: true, score: fit.score, verdict: fit.verdict, capped: fit.capped };
  } catch (e) {
    return { ok: false, reason: "ai", message: aiErrorMessage(e) };
  }
}
