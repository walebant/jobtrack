"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setJobStatus } from "@/app/(app)/jobs/[id]/actions";
import { PICKABLE_STATUSES, normaliseStatus, type JobStatus } from "@/lib/jobs/stages";
import { STATUS_LABEL } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

// How long a choice must stay put before it is saved. Arrow keys on a closed
// dropdown change the value one stage at a time, and only the stage it settles
// on should count (the database logs every saved change).
const SETTLE_MS = 1000;

// Stage picker. The settled choice saves on its own; the database records the history.
export function StatusSelect({
  jobId,
  status,
  title,
  compact,
}: {
  jobId: string;
  status: JobStatus;
  title: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(normaliseStatus(status));
  const [pending, start] = useTransition();
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);

  function commit() {
    clearTimeout(timer.current);
    timer.current = undefined;
    const next = latest.current;
    if (next === saved.current) return;
    const previous = saved.current;
    saved.current = next;
    start(async () => {
      const result = await setJobStatus(jobId, next);
      if (result.ok) toast(`Moved to ${STATUS_LABEL[next]}`);
      else {
        saved.current = previous;
        latest.current = previous;
        setValue(previous);
        toast(result.message ?? "Could not change the stage.");
      }
    });
  }

  function change(next: JobStatus) {
    latest.current = next;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, SETTLE_MS);
  }

  // Leaving the page before the choice settles still saves it.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => () => {
    if (timer.current) commitRef.current();
  }, []);

  return (
    <select
      aria-label={`Stage for ${title}`}
      value={value}
      aria-busy={pending}
      onChange={(e) => change(e.target.value as JobStatus)}
      onBlur={() => timer.current && commit()}
      className={cn(
        "rounded-lg border border-input bg-background font-medium",
        pending && "opacity-60",
        compact ? "h-8 px-1.5 text-[13px]" : "h-9 px-2.5 text-sm",
      )}
    >
      {PICKABLE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
