"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideSuggestion } from "./actions";

export function DecisionButtons({ jobId, title }: { jobId: string; title: string }) {
  const [pending, start] = useTransition();

  function decide(decision: "save" | "dismiss") {
    start(async () => {
      const { ok } = await decideSuggestion(jobId, decision);
      if (!ok) toast("That job was already moved.");
      else toast(decision === "save" ? `Saved "${title}" to your pipeline` : `Dismissed "${title}"`);
    });
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" onClick={() => decide("save")} disabled={pending}>
        Save
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide("dismiss")} disabled={pending}>
        Dismiss
      </Button>
    </div>
  );
}
