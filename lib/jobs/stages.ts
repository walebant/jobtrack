// The application stages, shared by the database schema and the browser.
// Every value the database enum has ever had stays here (Postgres cannot drop
// enum values), but "applying" and "shortlisted" are retired: they are no
// longer offered and existing rows were moved to "saved" and "interview".
export const JOB_STATUSES = [
  "saved",
  "applying",
  "submitted",
  "shortlisted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "closed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// The stages people can pick, in board order.
export const PICKABLE_STATUSES = ["saved", "submitted", "interview", "offer", "rejected", "withdrawn", "closed"] as const satisfies readonly JobStatus[];

// Retired stages read as their replacement.
export function normaliseStatus(s: JobStatus): JobStatus {
  return s === "applying" ? "saved" : s === "shortlisted" ? "interview" : s;
}

// Who the employer is: shapes how a job is scored and written for.
export const SECTORS = ["nhs", "council", "other"] as const;
export type Sector = (typeof SECTORS)[number];
