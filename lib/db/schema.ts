import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type PgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";
// Relative import: drizzle-kit reads this file without the @/ path alias.
import { JOB_STATUSES, type JobStatus } from "../jobs/stages";

/* ---------- Enums ---------- */

export { JOB_STATUSES, type JobStatus };

export const jobStatus = pgEnum("job_status", JOB_STATUSES);
export const sponsorship = pgEnum("sponsorship", ["yes", "no", "unknown"]);
export const jobSource = pgEnum("job_source", ["paste", "alert", "manual", "gmail", "nhs_jobs"]);
// Jobs found by Find jobs wait in an inbox until saved (inbox becomes null) or dismissed.
export const jobInbox = pgEnum("job_inbox", ["suggested", "dismissed"]);
export const fitVerdict = pgEnum("fit_verdict", ["apply", "maybe", "skip"]);
export const draftKind = pgEnum("draft_kind", ["statement", "cv_experience"]);

export type CriterionRating = "met" | "partial" | "gap";
export type Criterion = {
  text: string;
  type: "essential" | "desirable";
  rating: CriterionRating;
  evidence: string;
};

/* ---------- Shared columns and policy ---------- */

// Filled from the signed-in user's JWT, so inserts never need to pass it.
const userId = () =>
  uuid("user_id")
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// One policy per table: the owner can read and write their own rows, nobody else can.
const ownerOnly = (table: string, col: PgColumn) => {
  const isOwner: SQL = sql`${col} = (select auth.uid())`;
  return pgPolicy(`${table}_owner_all`, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: isOwner,
    withCheck: isOwner,
  });
};

/* ---------- Tables ---------- */

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .default(sql`auth.uid()`)
      .references(() => authUsers.id, { onDelete: "cascade" }),
    cvText: text("cv_text").notNull().default(""),
    cvFilePath: text("cv_file_path"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [ownerOnly("profiles", t.userId)],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    title: text("title").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    story: text("story").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("evidence_user_idx").on(t.userId), ownerOnly("evidence", t.userId)],
);

// The user's CVs (for example "Data and analyst", "Admin and patient-facing").
// One is the default. The evidence bank and profile notes are shared by all CVs.
export const cvs = pgTable(
  "cvs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    cvText: text("cv_text").notNull().default(""),
    filePath: text("file_path"),
    // What this CV is for, sent to Claude with it (for example "for data analyst roles").
    focus: text("focus").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Target for jobs' (cv_id, user_id) foreign key, added in a custom migration.
    unique("cvs_id_user_id_key").on(t.id, t.userId),
    // At most one default CV per user.
    uniqueIndex("cvs_one_default_idx").on(t.userId).where(sql`${t.isDefault}`),
    ownerOnly("cvs", t.userId),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    title: text("title").notNull().default(""),
    employer: text("employer").notNull().default(""),
    band: text("band").notNull().default(""),
    salary: text("salary").notNull().default(""),
    location: text("location").notNull().default(""),
    reference: text("reference").notNull().default(""),
    closingDate: date("closing_date"),
    interviewDate: date("interview_date"),
    // "HH:MM" (24-hour, UK time), or "" when not known.
    interviewTime: text("interview_time").notNull().default(""),
    link: text("link").notNull().default(""),
    sponsorship: sponsorship("sponsorship").notNull().default("unknown"),
    advertText: text("advert_text").notNull().default(""),
    essential: jsonb("essential").$type<string[]>().notNull().default([]),
    desirable: jsonb("desirable").$type<string[]>().notNull().default([]),
    status: jobStatus("status").notNull().default("saved"),
    // Set by a trigger the first time the job moves to Submitted.
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    contacts: text("contacts").notNull().default(""),
    notes: text("notes").notNull().default(""),
    source: jobSource("source").notNull().default("manual"),
    // NHS Jobs advert id (for example C9232-26-0255), so a job is never suggested twice.
    externalRef: text("external_ref"),
    // null = in the pipeline; "suggested" / "dismissed" = found by Find jobs.
    inbox: jobInbox("inbox"),
    // The CV to score and write with; null = the default CV. Foreign key
    // (cv_id, user_id) -> cvs(id, user_id) ON DELETE SET NULL (cv_id) is in the migration.
    cvId: uuid("cv_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Target for the child tables' (job_id, user_id) foreign keys.
    unique("jobs_id_user_id_key").on(t.id, t.userId),
    uniqueIndex("jobs_user_external_ref_idx").on(t.userId, t.externalRef).where(sql`${t.externalRef} is not null`),
    index("jobs_user_status_idx").on(t.userId, t.status),
    index("jobs_user_closing_idx").on(t.userId, t.closingDate),
    ownerOnly("jobs", t.userId),
  ],
);

// Child rows reference (job_id, user_id) together, so a row can never
// belong to one user while pointing at another user's job.
const jobRef = (t: { jobId: PgColumn; userId: PgColumn }, name: string) =>
  foreignKey({ name, columns: [t.jobId, t.userId], foreignColumns: [jobs.id, jobs.userId] }).onDelete("cascade");

export const jobStatusHistory = pgTable(
  "job_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    status: jobStatus("status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    jobRef(t, "job_status_history_job_fk"),
    index("job_status_history_job_idx").on(t.jobId, t.changedAt),
    ownerOnly("job_status_history", t.userId),
  ],
);

export const fitScores = pgTable(
  "fit_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    score: smallint("score").notNull(),
    verdict: fitVerdict("verdict").notNull(),
    summary: text("summary").notNull(),
    criteria: jsonb("criteria").$type<Criterion[]>().notNull().default([]),
    model: text("model").notNull(),
    // Which CV was scored. The name is kept as written then, in case the CV is renamed or deleted.
    cvId: uuid("cv_id"),
    cvName: text("cv_name").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    jobRef(t, "fit_scores_job_fk"),
    check("fit_scores_score_range", sql`${t.score} between 1 and 10`),
    // Every score is kept; the job page shows the newest.
    index("fit_scores_job_created_idx").on(t.jobId, t.createdAt.desc()),
    ownerOnly("fit_scores", t.userId),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    kind: draftKind("kind").notNull(),
    content: text("content").notNull().default(""),
    version: integer("version").notNull(),
    isSent: boolean("is_sent").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    jobRef(t, "drafts_job_fk"),
    unique("drafts_job_kind_version_key").on(t.jobId, t.kind, t.version),
    // At most one "sent" version per job and kind.
    uniqueIndex("drafts_one_sent_idx").on(t.jobId, t.kind).where(sql`${t.isSent}`),
    ownerOnly("drafts", t.userId),
  ],
);

export const prepQuestions = pgTable(
  "prep_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    question: text("question").notNull(),
    tip: text("tip").notNull().default(""),
    answer: text("answer").notNull().default(""),
    feedback: text("feedback").notNull().default(""),
    position: smallint("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    jobRef(t, "prep_questions_job_fk"),
    index("prep_questions_job_idx").on(t.jobId, t.position),
    ownerOnly("prep_questions", t.userId),
  ],
);

// The saved NHS Jobs search behind Find jobs (one per user).
export const jobSearches = pgTable(
  "job_searches",
  {
    userId: uuid("user_id")
      .primaryKey()
      .default(sql`auth.uid()`)
      .references(() => authUsers.id, { onDelete: "cascade" }),
    keywords: text("keywords").notNull().default(""),
    location: text("location").notNull().default(""),
    distance: integer("distance").notNull().default(20),
    staffGroups: text("staff_groups").array().notNull().default(sql`'{ADMINISTRATIVE_AND_CLERICAL}'::text[]`),
    bands: text("bands").array().notNull().default(sql`'{}'::text[]`),
    maxNew: integer("max_new").notNull().default(20),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [ownerOnly("job_searches", t.userId)],
);

// AI calls per user per UK day. Users may read their own count but never write it:
// only the server (adminDb) increments it, so the daily limit cannot be reset from the API.
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    day: date("day").notNull().default(sql`(now() at time zone 'Europe/London')::date`),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    pgPolicy("ai_usage_owner_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = (select auth.uid())`,
    }),
  ],
);

// Job descriptions and person specifications uploaded for a job (.pdf or .docx).
// The file lives in the private job-docs bucket; its text is kept here for prompts.
export const jobDocuments = pgTable(
  "job_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    jobId: uuid("job_id").notNull(),
    name: text("name").notNull(),
    filePath: text("file_path").notNull(),
    text: text("text").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    jobRef(t, "job_documents_job_fk"),
    index("job_documents_job_idx").on(t.jobId),
    ownerOnly("job_documents", t.userId),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Cv = typeof cvs.$inferSelect;
export type JobDocument = typeof jobDocuments.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobStatusChange = typeof jobStatusHistory.$inferSelect;
export type FitScore = typeof fitScores.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type PrepQuestion = typeof prepQuestions.$inferSelect;
