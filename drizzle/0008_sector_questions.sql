CREATE TYPE "public"."job_sector" AS ENUM('nhs', 'council', 'other');--> statement-breakpoint
ALTER TYPE "public"."draft_kind" ADD VALUE 'questions';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sector" "job_sector" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "assessment" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "app_questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Fill in the sector for existing jobs from where they came from and the employer's name.
UPDATE public.jobs SET sector = 'nhs'
WHERE source = 'nhs_jobs' OR employer ~* '(\mNHS\M|\mtrust\M|integrated care|\mICB\M|hospital|ambulance service)';--> statement-breakpoint
UPDATE public.jobs SET sector = 'council'
WHERE sector = 'other' AND employer ~* '(council|borough|county|district|metropolitan|city of|royal borough|combined authority|local authority)';
