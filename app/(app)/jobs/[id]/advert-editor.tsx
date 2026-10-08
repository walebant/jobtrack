"use client";

import { startTransition, useActionState, useState } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ASSESSED_LABEL, assessedFor } from "@/lib/ai/sector";
import type { Assessment } from "@/lib/db/schema";
import { saveAdvert, type AdvertEditState } from "./actions";

type Props = { jobId: string; advert: string; essential: string[]; desirable: string[]; assessment: Assessment };

export function AdvertEditor({ jobId, advert, essential, desirable, assessment }: Props) {
  const [text, setText] = useState(advert);
  const [intent, setIntent] = useState<"save" | "read">("save");
  const [state, action, pending] = useActionState<AdvertEditState, FormData>(async (prev, data) => {
    const next = await saveAdvert(prev, data);
    if (next.status === "ok") toast(next.message);
    return next;
  }, { status: "idle" });
  const reading = pending && intent === "read";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Which button was pressed decides the intent ("read" or "save").
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    setIntent(data.get("intent") === "read" ? "read" : "save");
    startTransition(() => action(data));
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Paste the full advert here if the job came from an alert email, then read it to pull out the criteria. The job is
        scored again with the new criteria.
      </p>
      <form onSubmit={onSubmit} className="mt-2">
        <input type="hidden" name="jobId" value={jobId} />
        <label htmlFor="advertEdit" className="sr-only">
          Advert text
        </label>
        <Textarea
          id="advertEdit"
          name="advert"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-90 bg-background"
          placeholder="Paste the full advert here"
        />
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Button type="submit" name="intent" value="read" disabled={pending}>
            {reading ? "Reading…" : "Save and read again"}
          </Button>
          <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
            Save only
          </Button>
        </div>
        <StatusLine
          message={reading ? "Reading and scoring. This can take up to a minute…" : pending ? "Saving…" : state.message}
          error={!pending && state.status === "error"}
        />
      </form>

      <Criteria title="Essential criteria" items={essential} assessment={assessment} />
      <Criteria title="Desirable criteria" items={desirable} assessment={assessment} />
    </div>
  );
}

function Criteria({ title, items, assessment }: { title: string; items: string[]; assessment: Assessment }) {
  return (
    <>
      <h3 className="mt-5 mb-2 text-base font-bold">{title}</h3>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((c) => (
            <li key={c}>
              {c}
              {assessedFor(c, assessment).length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground" title="How the person specification says this is assessed">
                  ({assessedFor(c, assessment).map((a) => ASSESSED_LABEL[a]).join(", ")})
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None yet.</p>
      )}
    </>
  );
}
