"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setJobStatus } from "@/app/(app)/jobs/[id]/actions";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/stages";
import { STATUS_LABEL } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

// Stage picker. Changes save straight away; the database records the history.
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
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  function change(next: JobStatus) {
    const previous = value;
    setValue(next);
    start(async () => {
      const result = await setJobStatus(jobId, next);
      if (result.ok) toast(`Moved to ${STATUS_LABEL[next]}`);
      else {
        setValue(previous);
        toast(result.message ?? "Could not change the stage.");
      }
    });
  }

  return (
    <select
      aria-label={`Stage for ${title}`}
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value as JobStatus)}
      className={cn(
        "rounded-lg border border-input bg-background font-medium disabled:opacity-60",
        compact ? "h-8 px-1.5 text-[13px]" : "h-9 px-2.5 text-sm",
      )}
    >
      {JOB_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
