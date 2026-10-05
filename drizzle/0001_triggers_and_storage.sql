-- Triggers and storage that Drizzle cannot express in lib/db/schema.ts.

-- 1. updated_at on every edit
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER evidence_set_updated_at BEFORE UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

-- 2. submitted_at is set the first time a job reaches Submitted or any later
--    "applied" stage, so stats still count it if Submitted was skipped.
CREATE OR REPLACE FUNCTION public.jobs_set_submitted_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.submitted_at IS NULL
     AND NEW.status IN ('submitted', 'shortlisted', 'interview', 'offer', 'rejected') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER jobs_set_submitted_at BEFORE INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_set_submitted_at();--> statement-breakpoint

-- 3. Every stage change is logged, whichever code path made it.
CREATE OR REPLACE FUNCTION public.jobs_log_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.job_status_history (user_id, job_id, status)
    VALUES (NEW.user_id, NEW.id, NEW.status);
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER jobs_log_status AFTER INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_log_status();--> statement-breakpoint

-- 4. Every new user gets an empty profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint
INSERT INTO public.profiles (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;--> statement-breakpoint

-- Trigger functions are not meant to be called through the API.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.jobs_set_submitted_at() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.jobs_log_status() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- 5. Private bucket for uploaded CVs. Files live under "<user id>/…".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cvs', 'cvs', false, 10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
CREATE POLICY "cvs_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "cvs_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "cvs_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);--> statement-breakpoint
CREATE POLICY "cvs_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
