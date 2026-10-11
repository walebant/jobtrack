import { normaliseStatus, type JobStatus } from "./stages";

// How far an application really got, worked out from its stage history.
//
// Stages form a ladder: saved < submitted < interview < offer. Moving back down
// the ladder is treated as a correction, so the stages above it no longer count
// (a slip to "offer" and straight back to "interview" is not an offer).
// Rejected, withdrawn and closed are outcomes: they end the application but keep
// how far it got (rejected after interview still counts the interview).

const RANK: Partial<Record<JobStatus, number>> = { saved: 0, submitted: 1, interview: 2, offer: 3 };
export const OUTCOMES = new Set<JobStatus>(["rejected", "withdrawn", "closed"]);

export type Progress = {
  furthest: number; // 0 saved, 1 submitted, 2 interview, 3 offer
  outcome: JobStatus | null;
};

export function replayHistory(history: JobStatus[]): Progress {
  const reached = new Set<number>();
  let outcome: JobStatus | null = null;
  for (const raw of history) {
    const s = normaliseStatus(raw);
    const rank = RANK[s];
    if (rank === undefined) {
      outcome = s;
      continue;
    }
    // Moving to a ladder stage reopens the application and undoes anything above it.
    for (const r of [...reached]) if (r > rank) reached.delete(r);
    reached.add(rank);
    outcome = null;
  }
  return { furthest: reached.size ? Math.max(...reached) : 0, outcome };
}

// The furthest stage reached on the corrected path, also counting the current
// stage (in case history is missing) and "rejected", which means it was applied for.
export function progressOf(job: { status: JobStatus; reached: JobStatus[] }): Progress {
  const p = replayHistory(job.reached.length ? job.reached : [job.status]);
  const current = RANK[normaliseStatus(job.status)];
  const furthest = Math.max(p.furthest, current ?? 0, job.status === "rejected" ? 1 : 0);
  return { furthest, outcome: p.outcome };
}
