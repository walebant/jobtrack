CREATE TYPE "public"."job_inbox" AS ENUM('suggested', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."job_source" ADD VALUE 'nhs_jobs';--> statement-breakpoint
CREATE TABLE "job_searches" (
	"user_id" uuid PRIMARY KEY DEFAULT auth.uid() NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"distance" integer DEFAULT 20 NOT NULL,
	"staff_groups" text[] DEFAULT '{ADMINISTRATIVE_AND_CLERICAL}'::text[] NOT NULL,
	"bands" text[] DEFAULT '{}'::text[] NOT NULL,
	"max_new" integer DEFAULT 20 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_searches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "inbox" "job_inbox";--> statement-breakpoint
ALTER TABLE "job_searches" ADD CONSTRAINT "job_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_user_external_ref_idx" ON "jobs" USING btree ("user_id","external_ref") WHERE "jobs"."external_ref" is not null;--> statement-breakpoint
CREATE POLICY "job_searches_owner_all" ON "job_searches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_searches"."user_id" = (select auth.uid())) WITH CHECK ("job_searches"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE TRIGGER job_searches_set_updated_at BEFORE UPDATE ON public.job_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
