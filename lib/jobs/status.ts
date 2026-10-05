import type { JobStatus } from "@/lib/db/schema";

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

// Stages after an application has gone in.
export const APPLIED_STATUSES = new Set<JobStatus>(["submitted", "shortlisted", "interview", "offer", "rejected"]);

// Closing dates only matter before applying.
export function closingDateMatters(status: JobStatus) {
  return !APPLIED_STATUSES.has(status) && status !== "withdrawn";
}
