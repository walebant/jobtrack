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
