-- Merging Shortlisted into Interview left some histories reading
-- "Interview, Interview". Drop an entry that repeats the one before it.
DELETE FROM public.job_status_history h
USING (
  SELECT id, status, lag(status) OVER (PARTITION BY job_id ORDER BY changed_at, id) AS prev
  FROM public.job_status_history
) o
WHERE h.id = o.id AND o.status = o.prev;
