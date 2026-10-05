"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { scoreJobAction } from "./actions";

export function ScoreButton({ jobId, label, className }: { jobId: string; label: string; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function score() {
    setError(undefined);
    start(async () => {
      const result = await scoreJobAction(jobId);
      if (result.ok) toast(`Scored ${result.score}/10${result.capped ? " (capped: an essential criterion is a gap)" : ""}`);
      else setError(result.message);
    });
  }

  return (
    <div className={className}>
      <Button onClick={score} disabled={pending}>
        {pending ? "Scoring…" : label}
      </Button>
      <StatusLine message={pending ? "Scoring. This can take up to a minute…" : error} error={!pending && Boolean(error)} />
    </div>
  );
}
