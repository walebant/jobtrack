ALTER TYPE "public"."job_status" ADD VALUE 'closed';--> statement-breakpoint

-- "applying" and "shortlisted" are retired: move jobs and their history to
-- "saved" and "interview". The log trigger is paused so the moves are not
-- logged as new stage changes.
ALTER TABLE public.jobs DISABLE TRIGGER jobs_log_status;--> statement-breakpoint
UPDATE public.jobs SET status = 'saved' WHERE status = 'applying';--> statement-breakpoint
UPDATE public.jobs SET status = 'interview' WHERE status = 'shortlisted';--> statement-breakpoint
ALTER TABLE public.jobs ENABLE TRIGGER jobs_log_status;--> statement-breakpoint
UPDATE public.job_status_history SET status = 'saved' WHERE status = 'applying';--> statement-breakpoint
UPDATE public.job_status_history SET status = 'interview' WHERE status = 'shortlisted';--> statement-breakpoint

-- Moving a job back to Saved means it has not been applied for, so the date
-- applied is cleared. Otherwise it is set the first time it reaches an applied stage.
CREATE OR REPLACE FUNCTION public.jobs_set_submitted_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('saved', 'applying') THEN
    NEW.submitted_at := NULL;
  ELSIF NEW.submitted_at IS NULL
     AND NEW.status IN ('submitted', 'shortlisted', 'interview', 'offer', 'rejected') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
UPDATE public.jobs SET submitted_at = NULL WHERE status IN ('saved', 'applying') AND submitted_at IS NOT NULL;--> statement-breakpoint

-- A backdated "date applied" could put the stage logged when a job was added
-- after it. That first entry belongs first, so move it to just before the earliest.
UPDATE public.job_status_history h
SET changed_at = m.first_at - interval '1 second'
FROM public.jobs j,
  (SELECT job_id, min(changed_at) AS first_at FROM public.job_status_history GROUP BY job_id) m
WHERE h.job_id = j.id
  AND m.job_id = j.id
  AND h.changed_at BETWEEN j.created_at - interval '2 seconds' AND j.created_at + interval '2 seconds'
  AND h.changed_at > m.first_at;
