CREATE TABLE "cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"cv_text" text DEFAULT '' NOT NULL,
	"file_path" text,
	"focus" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvs_id_user_id_key" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "cvs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD COLUMN "cv_id" uuid;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD COLUMN "cv_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cv_id" uuid;--> statement-breakpoint
ALTER TABLE "cvs" ADD CONSTRAINT "cvs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_fk" FOREIGN KEY ("job_id","user_id") REFERENCES "public"."jobs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cvs_one_default_idx" ON "cvs" USING btree ("user_id") WHERE "cvs"."is_default";--> statement-breakpoint
CREATE INDEX "job_documents_job_idx" ON "job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE POLICY "cvs_owner_all" ON "cvs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cvs"."user_id" = (select auth.uid())) WITH CHECK ("cvs"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "job_documents_owner_all" ON "job_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_documents"."user_id" = (select auth.uid())) WITH CHECK ("job_documents"."user_id" = (select auth.uid()));--> statement-breakpoint
-- A job's CV must be one of the same user's CVs. Deleting the CV clears only
-- cv_id (the job then uses the default CV), never user_id.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cv_fk" FOREIGN KEY ("cv_id","user_id")
  REFERENCES "public"."cvs"("id","user_id") ON DELETE SET NULL ("cv_id");--> statement-breakpoint
CREATE TRIGGER cvs_set_updated_at BEFORE UPDATE ON public.cvs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
-- Move each existing profile CV into the new table as the default "Main CV".
INSERT INTO public.cvs (user_id, name, cv_text, file_path, is_default)
SELECT user_id, 'Main CV', cv_text, cv_file_path, true
FROM public.profiles
WHERE cv_text <> '' OR cv_file_path IS NOT NULL;--> statement-breakpoint
-- Private bucket for job descriptions and person specifications. Files live under "<user id>/…".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-docs', 'job-docs', false, 10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
CREATE POLICY "job_docs_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-docs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "job_docs_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-docs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "job_docs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-docs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
