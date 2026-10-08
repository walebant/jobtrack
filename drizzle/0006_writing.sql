CREATE TYPE "public"."limit_unit" AS ENUM('words', 'characters');--> statement-breakpoint
ALTER TYPE "public"."draft_kind" ADD VALUE 'education';--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "review" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "cv_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "why_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "write_limit" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "write_limit_unit" "limit_unit" DEFAULT 'words' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "writing_qa" jsonb DEFAULT '{}'::jsonb NOT NULL;