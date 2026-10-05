CREATE TYPE "public"."draft_kind" AS ENUM('statement', 'cv_experience');--> statement-breakpoint
CREATE TYPE "public"."fit_verdict" AS ENUM('apply', 'maybe', 'skip');--> statement-breakpoint
CREATE TYPE "public"."job_source" AS ENUM('paste', 'alert', 'manual', 'gmail');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('saved', 'applying', 'submitted', 'shortlisted', 'interview', 'offer', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."sponsorship" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "draft_kind" NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"version" integer NOT NULL,
	"is_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_job_kind_version_key" UNIQUE("job_id","kind","version")
);
--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"title" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"story" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fit_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"job_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"verdict" "fit_verdict" NOT NULL,
	"summary" text NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_scores_score_range" CHECK ("fit_scores"."score" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "fit_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "job_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"employer" text DEFAULT '' NOT NULL,
	"band" text DEFAULT '' NOT NULL,
	"salary" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"closing_date" date,
	"interview_date" date,
	"link" text DEFAULT '' NOT NULL,
	"sponsorship" "sponsorship" DEFAULT 'unknown' NOT NULL,
	"advert_text" text DEFAULT '' NOT NULL,
	"essential" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"desirable" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'saved' NOT NULL,
	"submitted_at" timestamp with time zone,
	"contacts" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" "job_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_id_user_id_key" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prep_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"job_id" uuid NOT NULL,
	"question" text NOT NULL,
	"tip" text DEFAULT '' NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prep_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY DEFAULT auth.uid() NOT NULL,
	"cv_text" text DEFAULT '' NOT NULL,
	"cv_file_path" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD CONSTRAINT "fit_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD CONSTRAINT "fit_scores_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_questions" ADD CONSTRAINT "prep_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_questions" ADD CONSTRAINT "prep_questions_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_one_sent_idx" ON "drafts" USING btree ("job_id","kind") WHERE "drafts"."is_sent";--> statement-breakpoint
CREATE INDEX "evidence_user_idx" ON "evidence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fit_scores_job_created_idx" ON "fit_scores" USING btree ("job_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_status_history_job_idx" ON "job_status_history" USING btree ("job_id","changed_at");--> statement-breakpoint
CREATE INDEX "jobs_user_status_idx" ON "jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "jobs_user_closing_idx" ON "jobs" USING btree ("user_id","closing_date");--> statement-breakpoint
CREATE INDEX "prep_questions_job_idx" ON "prep_questions" USING btree ("job_id","position");--> statement-breakpoint
CREATE POLICY "drafts_owner_all" ON "drafts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("drafts"."user_id" = (select auth.uid())) WITH CHECK ("drafts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "evidence_owner_all" ON "evidence" AS PERMISSIVE FOR ALL TO "authenticated" USING ("evidence"."user_id" = (select auth.uid())) WITH CHECK ("evidence"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fit_scores_owner_all" ON "fit_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fit_scores"."user_id" = (select auth.uid())) WITH CHECK ("fit_scores"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "job_status_history_owner_all" ON "job_status_history" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_status_history"."user_id" = (select auth.uid())) WITH CHECK ("job_status_history"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "jobs_owner_all" ON "jobs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("jobs"."user_id" = (select auth.uid())) WITH CHECK ("jobs"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "prep_questions_owner_all" ON "prep_questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("prep_questions"."user_id" = (select auth.uid())) WITH CHECK ("prep_questions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_owner_all" ON "profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("profiles"."user_id" = (select auth.uid())) WITH CHECK ("profiles"."user_id" = (select auth.uid()));