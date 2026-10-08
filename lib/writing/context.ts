import { asc, eq } from "drizzle-orm";
import { jobBlock } from "@/lib/ai/prompts";
import { limitLine, writingUser, type WritingKind } from "@/lib/ai/writing";
import { listCvs, pickCv } from "@/lib/cvs";
import type { Tx } from "@/lib/db";
import { evidence, jobDocuments, jobs, profiles } from "@/lib/db/schema";

// Everything Claude needs to write for one job: the job's CV, the evidence bank,
// notes, the job (advert, criteria, uploaded documents) and the user's answers.
export async function loadWritingContext(tx: Tx, jobId: string, kind: WritingKind) {
  const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return null;
  const [profile] = await tx.select({ notes: profiles.notes }).from(profiles).limit(1);
  const examples = await tx
    .select({ title: evidence.title, tags: evidence.tags, story: evidence.story })
    .from(evidence)
    .orderBy(asc(evidence.createdAt));
  const documents = await tx
    .select({ name: jobDocuments.name, text: jobDocuments.text })
    .from(jobDocuments)
    .where(eq(jobDocuments.jobId, jobId));
  const cv = pickCv(await listCvs(tx), job.cvId);
  if (!cv) return { job, cv: null } as const;

  const notes = [cv.focus && `This CV is for: ${cv.focus}`, profile?.notes].filter(Boolean).join("\n\n");
  const profileForAi = { cvText: cv.cvText, notes, evidence: examples };
  const jobForAi = { ...job, documents };
  const answers = job.writingQa[kind] ?? [];
  const user = writingUser(kind, {
    jobBlock: jobBlock(jobForAi),
    whyNotes: job.whyNotes,
    limit: limitLine(job.writeLimit, job.writeLimitUnit),
    answers,
    questions: job.appQuestions,
  });
  return { job, cv, profileForAi, jobForAi, user } as const;
}
