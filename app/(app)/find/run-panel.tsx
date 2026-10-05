"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { formatUkDate } from "@/lib/dates";
import { processOne, startRun } from "./actions";

// Runs a search step by step from the browser, so no single server call runs long:
// one call searches NHS Jobs, then one call per new job reads its advert and scores it.
export function RunPanel({ ready, lastRunAt, hasCv }: { ready: boolean; lastRunAt: string | null; hasCv: boolean }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(undefined);
    setProgress("Searching NHS Jobs…");
    try {
      const start = await startRun();
      if (!start.ok) return setError(start.message);
      if (start.pending.length === 0) {
        toast(start.listed ? "No new jobs since your last search." : "NHS Jobs found no jobs for this search.");
        return;
      }

      let scored = 0;
      for (const [i, id] of start.pending.entries()) {
        setProgress(
          `${start.added ? `Found ${start.added} new job${start.added === 1 ? "" : "s"}. ` : ""}Reading and scoring ${i + 1} of ${start.pending.length}…`,
        );
        const result = await processOne(id);
        if (result.ok) {
          if (result.score !== null) scored++;
        } else if (result.stop) {
          setError(result.message);
          break;
        }
        router.refresh();
      }
      toast(`Done: ${start.pending.length} job${start.pending.length === 1 ? "" : "s"} checked, ${scored} scored.`);
    } catch {
      setError("The search stopped unexpectedly. Run it again to pick up where it left off.");
    } finally {
      setRunning(false);
      setProgress(undefined);
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-bold">Find jobs</h2>
          <p className="text-sm text-muted-foreground">
            {lastRunAt ? `Last searched ${formatUkDate(lastRunAt)}.` : "Not searched yet."} New jobs are read and scored against your
            profile, best fit first.
          </p>
        </div>
        <Button onClick={run} disabled={running || !ready}>
          {running ? "Searching…" : "Find jobs now"}
        </Button>
      </div>
      {!ready && <StatusLine message="Save your search settings below first." />}
      {ready && !hasCv && <StatusLine message="Add your CV in My profile so new jobs can be scored." error />}
      {(progress || error) && <StatusLine message={progress ?? error} error={!progress && Boolean(error)} />}
    </div>
  );
}
