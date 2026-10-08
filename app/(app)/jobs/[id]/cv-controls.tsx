"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { scoreJobAction, setJobCv } from "./actions";

type CvOption = { id: string; name: string; isDefault: boolean; usable: boolean };

// Which CV this job is scored and written with.
export function CvPicker({ jobId, cvs, chosenId }: { jobId: string; cvs: CvOption[]; chosenId: string | null }) {
  const [pending, start] = useTransition();
  const usable = cvs.filter((c) => c.usable);
  const defaultCv = usable.find((c) => c.isDefault);

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Scored with</span>
      <select
        value={chosenId ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const { ok } = await setJobCv(jobId, e.target.value || null);
            toast(ok ? "CV changed. Score again to see the fit with this CV." : "Could not change the CV.");
          })
        }
        className="h-9 rounded-lg border border-input bg-background px-2.5 font-medium"
      >
        <option value="">Default CV{defaultCv ? ` (${defaultCv.name})` : ""}</option>
        {usable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function UseCvButton({ jobId, cvId, name }: { jobId: string; cvId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { ok } = await setJobCv(jobId, cvId);
          toast(ok ? `This job now uses "${name}"` : "Could not change the CV.");
        })
      }
    >
      Use this CV
    </Button>
  );
}

// Scores the job against each CV in turn (1 AI call each).
export function CompareCvs({ jobId, cvs }: { jobId: string; cvs: CvOption[] }) {
  const usable = cvs.filter((c) => c.usable);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const router = useRouter();
  if (usable.length < 2) return null;

  async function run() {
    setError(undefined);
    for (const [i, cv] of usable.entries()) {
      setProgress(`Scoring with "${cv.name}" (${i + 1} of ${usable.length}). Each can take up to a minute…`);
      const result = await scoreJobAction(jobId, cv.id);
      if (!result.ok) {
        setError(result.message);
        break;
      }
      router.refresh();
    }
    setProgress(undefined);
  }

  return (
    <div>
      <Button variant="outline" onClick={run} disabled={Boolean(progress)}>
        {progress ? "Comparing…" : `Compare my ${usable.length} CVs`}
      </Button>
      {(progress || error) && <StatusLine message={progress ?? error} error={!progress && Boolean(error)} />}
    </div>
  );
}
