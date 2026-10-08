import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/stages";
import { APPLIED_STATUSES } from "@/lib/jobs/status";

// Everything on the Stats page, worked out from the user's own jobs.

export type StatsJob = {
  status: JobStatus;
  submittedAt: Date | null;
  band: string;
  cvName: string | null;
  score: number | null;
  // Every stage the job has been in, from its history.
  reached: JobStatus[];
};

const SHORTLISTED = new Set<JobStatus>(["shortlisted", "interview", "offer"]);

function everReached(job: StatsJob, stages: Set<JobStatus>) {
  return stages.has(job.status) || job.reached.some((s) => stages.has(s));
}

export function isApplied(job: StatsJob) {
  return job.submittedAt !== null || everReached(job, APPLIED_STATUSES);
}
export const isShortlisted = (job: StatsJob) => everReached(job, SHORTLISTED);
export const hadInterview = (job: StatsJob) => everReached(job, new Set(["interview", "offer"]));
export const gotOffer = (job: StatsJob) => everReached(job, new Set(["offer"]));

export function rate(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 100) : null;
}

// "Band 5", "band 5 ", "Band 8A" -> "Band 5" / "Band 8a"; anything else kept as written.
export function normaliseBand(band: string): string {
  const m = band.match(/band\s*(\d)\s*([a-d])?/i);
  if (m) return `Band ${m[1]}${m[2] ? m[2].toLowerCase() : ""}`;
  return band.trim() || "No band";
}

export function scoreRange(score: number | null): string {
  if (score === null) return "Not scored";
  return score >= 8 ? "8 to 10" : score >= 6 ? "6 to 7" : "1 to 5";
}
const SCORE_RANGE_ORDER = ["8 to 10", "6 to 7", "1 to 5", "Not scored"];

export type RateRow = { label: string; applied: number; shortlisted: number; rate: number | null };

// Shortlist rate for applied jobs, grouped by key.
export function shortlistRateBy(jobs: StatsJob[], key: (j: StatsJob) => string, order?: string[]): RateRow[] {
  const groups = new Map<string, { applied: number; shortlisted: number }>();
  for (const j of jobs.filter(isApplied)) {
    const k = key(j);
    const g = groups.get(k) ?? { applied: 0, shortlisted: 0 };
    g.applied++;
    if (isShortlisted(j)) g.shortlisted++;
    groups.set(k, g);
  }
  const rows = [...groups].map(([label, g]) => ({ label, ...g, rate: rate(g.shortlisted, g.applied) }));
  if (order) return rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return rows.sort((a, b) => b.applied - a.applied || a.label.localeCompare(b.label, "en-GB", { numeric: true }));
}

// Monday-start weeks in UK time, oldest first, ending with the current week.
export function weekStarts(now: Date, weeks: number): string[] {
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now) + "T00:00:00Z");
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() - 7 * (weeks - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function applicationsPerWeek(jobs: StatsJob[], now: Date, weeks = 8): { weekStart: string; count: number }[] {
  const starts = weekStarts(now, weeks);
  const counts = starts.map(() => 0);
  for (const j of jobs) {
    if (!j.submittedAt) continue;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(j.submittedAt);
    for (let i = starts.length - 1; i >= 0; i--) {
      if (day >= starts[i]) {
        const end = new Date(starts[i] + "T00:00:00Z");
        end.setUTCDate(end.getUTCDate() + 7);
        if (day < end.toISOString().slice(0, 10)) counts[i]++;
        break;
      }
    }
  }
  return starts.map((weekStart, i) => ({ weekStart, count: counts[i] }));
}

export function computeStats(jobs: StatsJob[], now: Date) {
  const applied = jobs.filter(isApplied);
  const shortlisted = applied.filter(isShortlisted).length;
  const interviews = applied.filter(hadInterview).length;
  const offers = applied.filter(gotOffer).length;
  const scored = jobs.filter((j) => j.score !== null);
  const avgScore = scored.length ? Math.round((scored.reduce((n, j) => n + j.score!, 0) / scored.length) * 10) / 10 : null;

  const byStage = Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const j of jobs) byStage[j.status]++;

  return {
    tracked: jobs.length,
    applied: applied.length,
    shortlisted,
    interviews,
    offers,
    shortlistRate: rate(shortlisted, applied.length),
    avgScore,
    scoredCount: scored.length,
    funnel: [
      { label: "Applied", count: applied.length },
      { label: "Shortlisted", count: shortlisted },
      { label: "Interview", count: interviews },
      { label: "Offer", count: offers },
    ],
    perWeek: applicationsPerWeek(jobs, now),
    byBand: shortlistRateBy(jobs, (j) => normaliseBand(j.band)),
    byCv: shortlistRateBy(jobs, (j) => j.cvName ?? "No CV"),
    byScore: shortlistRateBy(jobs, (j) => scoreRange(j.score), SCORE_RANGE_ORDER),
    byStage,
  };
}
export type Stats = ReturnType<typeof computeStats>;
