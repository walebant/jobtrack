"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { scoreJobAction } from "../jobs/[id]/actions";

// Scores each unscored job one at a time, showing progress. Stops on the first
// error that would repeat (no CV, daily AI limit, API trouble).
export function ScoreAll({ jobIds }: { jobIds: string[] }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(undefined);
    let done = 0;
    for (const [i, id] of jobIds.entries()) {
      setProgress(`Scoring job ${i + 1} of ${jobIds.length}. Each one can take up to a minute…`);
      const result = await scoreJobAction(id);
      if (result.ok) {
        done++;
        router.refresh();
      } else if (result.reason !== "no_criteria" && result.reason !== "not_found") {
        setError(result.message);
        break;
      }
    }
    setRunning(false);
    setProgress(undefined);
    if (done) toast(`Scored ${done} job${done === 1 ? "" : "s"}`);
  }

  return (
    <div>
      <Button variant="outline" onClick={run} disabled={running}>
        {running ? "Scoring…" : `Score ${jobIds.length} unscored job${jobIds.length === 1 ? "" : "s"}`}
      </Button>
      {(progress || error) && <StatusLine message={progress ?? error} error={!progress && Boolean(error)} />}
    </div>
  );
}
