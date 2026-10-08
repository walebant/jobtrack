// The application stages, shared by the database schema and the browser.
// Order matters: it is the board's column order.
export const JOB_STATUSES = [
  "saved",
  "applying",
  "submitted",
  "shortlisted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// Who the employer is: shapes how a job is scored and written for.
export const SECTORS = ["nhs", "council", "other"] as const;
export type Sector = (typeof SECTORS)[number];
