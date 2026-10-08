import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/stages";
import { daysLeft } from "./closing";

export const STATUS_LABEL: Record<JobStatus, string> = {
  saved: "Saved",
  applying: "Applying",
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

// Stages after an application has gone in.
export const APPLIED_STATUSES = new Set<JobStatus>(["submitted", "shortlisted", "interview", "offer", "rejected"]);

// Closing dates only matter before applying.
export function closingDateMatters(status: JobStatus) {
  return !APPLIED_STATUSES.has(status) && status !== "withdrawn";
}

/* ---------- Pipeline groups ---------- */

export const STAGE_GROUPS = {
  all: { label: "All", statuses: JOB_STATUSES },
  active: { label: "To apply", statuses: ["saved", "applying"] },
  applied: { label: "Applied", statuses: ["submitted", "shortlisted", "interview"] },
  offers: { label: "Offers", statuses: ["offer"] },
  closed: { label: "Closed", statuses: ["rejected", "withdrawn"] },
} as const satisfies Record<string, { label: string; statuses: readonly JobStatus[] }>;
export type StageGroup = keyof typeof STAGE_GROUPS;

export function parseStageGroup(value: unknown): StageGroup {
  return typeof value === "string" && value in STAGE_GROUPS ? (value as StageGroup) : "all";
}

export function inStageGroup(status: JobStatus, group: StageGroup): boolean {
  return (STAGE_GROUPS[group].statuses as readonly JobStatus[]).includes(status);
}

export function countByGroup(statuses: JobStatus[]): Record<StageGroup, number> {
  const out = { all: 0, active: 0, applied: 0, offers: 0, closed: 0 } as Record<StageGroup, number>;
  for (const s of statuses) for (const g of Object.keys(STAGE_GROUPS) as StageGroup[]) if (inStageGroup(s, g)) out[g]++;
  return out;
}

/* ---------- Interviews ---------- */

// "Interview 21 Oct, 10:30". soon = within the next 7 days (including today).
export function interviewInfo(
  date: string | null,
  time: string,
  today?: string,
): { label: string; soon: boolean; past: boolean } | null {
  const d = daysLeft(date, today);
  if (d === null || !date) return null;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
  const when = d === 0 ? "today" : d === 1 ? "tomorrow" : day;
  return {
    label: d < 0 ? `Interviewed ${day}` : `Interview ${when}${time ? `, ${time}` : ""}`,
    soon: d >= 0 && d <= 7,
    past: d < 0,
  };
}
