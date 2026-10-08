import { asc, eq } from "drizzle-orm";
import { scoreFit } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { listCvs, pickCv } from "@/lib/cvs";
import { evidence, fitScores, jobDocuments, jobs, profiles } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";

export type ScoreOutcome =
  | { ok: true; score: number; verdict: "apply" | "maybe" | "skip"; capped: boolean; cvName: string }
  | { ok: false; reason: "not_found" | "no_cv" | "no_criteria" | "ai"; message: string };

export const NO_CV_MESSAGE = "Add a CV in My profile first, so the score is based on your real experience.";
export const NO_CRITERIA_MESSAGE =
  "This job has no person specification yet. Paste the full advert or upload the job description in the Advert tab, then score it.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Scores one of the signed-in user's jobs and saves the result (every score is kept).
// cvId picks a CV for this score only (used by "Compare my CVs"); otherwise the
// job's chosen CV, or the default CV, is used.
export async function scoreJob(userId: string, jobId: string, cvId?: string): Promise<ScoreOutcome> {
  if (!UUID.test(jobId)) return { ok: false, reason: "not_found", message: "That job could not be found." };

  const { job, profile, examples, allCvs, documents } = await userDb(async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    const [profile] = await tx.select({ notes: profiles.notes }).from(profiles).limit(1);
    const examples = await tx
      .select({ title: evidence.title, tags: evidence.tags, story: evidence.story })
      .from(evidence)
      .orderBy(asc(evidence.createdAt));
    const allCvs = await listCvs(tx);
    const documents = job
      ? await tx.select({ name: jobDocuments.name, text: jobDocuments.text }).from(jobDocuments).where(eq(jobDocuments.jobId, jobId))
      : [];
    return { job, profile, examples, allCvs, documents };
  });

  if (!job) return { ok: false, reason: "not_found", message: "That job could not be found." };
  const cv = pickCv(allCvs, cvId, job.cvId);
  if (!cv) return { ok: false, reason: "no_cv", message: NO_CV_MESSAGE };
  if (job.essential.length + job.desirable.length === 0) {
    return { ok: false, reason: "no_criteria", message: NO_CRITERIA_MESSAGE };
  }

  try {
    await consumeAiCall(userId);
    const notes = [cv.focus && `This CV is for: ${cv.focus}`, profile?.notes].filter(Boolean).join("\n\n");
    const { fit, model } = await scoreFit({ cvText: cv.cvText, notes, evidence: examples }, { ...job, documents });
    await userDb((tx) =>
      tx.insert(fitScores).values({
        jobId,
        score: fit.score,
        verdict: fit.verdict,
        summary: fit.summary,
        criteria: fit.criteria,
        model,
        cvId: cv.id,
        cvName: cv.name,
      }),
    );
    return { ok: true, score: fit.score, verdict: fit.verdict, capped: fit.capped, cvName: cv.name };
  } catch (e) {
    return { ok: false, reason: "ai", message: aiErrorMessage(e) };
  }
}
