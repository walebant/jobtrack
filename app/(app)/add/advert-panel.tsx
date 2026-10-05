"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip, ClosingChip } from "@/components/chips";
import { FitChip, VERDICT_LABEL } from "@/components/fit";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUkDate } from "@/lib/dates";
import { submitWithoutReset } from "@/lib/forms-client";
import { addManualJob, readAdvertAndSave, type AdvertState, type ManualState, type SavedJobSummary } from "./actions";

export function AdvertPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, reading] = useActionState<AdvertState, FormData>(async (prev, data) => {
    const next = await readAdvertAndSave(prev, data);
    if (next.status === "saved") {
      formRef.current?.reset();
      toast("Job saved");
    }
    return next;
  }, { status: "idle" });
  const [manual, setManual] = useState(false);

  return (
    <Panel
      title="Paste a job advert"
      hint="Copy the whole advert page from NHS Jobs, Trac or a council site, including the person specification."
    >
      <form ref={formRef} onSubmit={(e) => submitWithoutReset(e, action)} className="mt-1">
        <Label htmlFor="advertIn" className="mt-3 mb-1.5 text-muted-foreground">
          Advert text
        </Label>
        <Textarea id="advertIn" name="advert" required placeholder="Paste the full advert here" className="min-h-56 bg-background" />
        <Label htmlFor="advertLink" className="mt-3 mb-1.5 text-muted-foreground">
          Link to the advert (optional)
        </Label>
        <Input id="advertLink" name="link" type="url" placeholder="https://www.jobs.nhs.uk/…" className="h-10 bg-background" />
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button type="submit" disabled={reading}>
            {reading ? "Reading…" : "Read advert and save"}
          </Button>
          <Button type="button" variant="outline" aria-expanded={manual} onClick={() => setManual((m) => !m)}>
            Add manually instead
          </Button>
        </div>
        <StatusLine
          message={reading ? "Reading and scoring the advert. This can take up to a minute…" : state.status === "error" ? state.message : undefined}
          error={!reading && state.status === "error"}
        />
      </form>

      {state.status === "saved" && <SavedJob job={state.job} fit={state.fit} seconds={state.seconds} />}
      {manual && <ManualForm />}
    </Panel>
  );
}

type SavedFit = Extract<AdvertState, { status: "saved" }>["fit"];

function SavedJob({ job, fit, seconds }: { job: SavedJobSummary; fit: SavedFit; seconds: number }) {
  const noCriteria = job.essential.length + job.desirable.length === 0;
  return (
    <div className="mt-3 rounded-xl border bg-background p-3.5" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        Saved{"score" in fit ? " and scored" : ""} in {seconds} seconds
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold">{job.title}</h3>
        {"score" in fit && <FitChip score={fit.score} className="mt-1" />}
      </div>
      {"score" in fit ? (
        <p className="text-sm font-semibold">
          {VERDICT_LABEL[fit.verdict]}
          {fit.capped && <span className="font-normal text-muted-foreground"> (capped at 6: an essential criterion is a gap)</span>}
        </p>
      ) : (
        <p className="text-sm text-mid">{fit.note}</p>
      )}
      <p className="text-sm text-muted-foreground">{[job.employer, job.band, job.salary].filter(Boolean).join(" · ")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {job.closingDate && <Chip>Closes {formatUkDate(job.closingDate)}</Chip>}
        <ClosingChip closingDate={job.closingDate} />
        {job.sponsorship !== "unknown" && <Chip>{job.sponsorship === "yes" ? "Sponsorship offered" : "No sponsorship"}</Chip>}
      </div>
      {noCriteria ? (
        <p className="mt-2 text-sm text-mid">No person specification was found in this advert, so the job has no criteria yet.</p>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium">
            {job.essential.length} essential and {job.desirable.length} desirable criteria
          </summary>
          <CriteriaList title="Essential" items={job.essential} />
          <CriteriaList title="Desirable" items={job.desirable} />
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/jobs/${job.id}`}>{"score" in fit ? "View fit score" : "Open job"}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/pipeline">Go to pipeline</Link>
        </Button>
      </div>
    </div>
  );
}

function CriteriaList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <>
      <h4 className="mt-2.5 text-sm font-semibold">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </>
  );
}

function ManualForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, saving] = useActionState<ManualState, FormData>(async (prev, data) => {
    const next = await addManualJob(prev, data);
    if (next.status === "saved") {
      formRef.current?.reset();
      toast(`Saved "${next.title}"`);
    }
    return next;
  }, { status: "idle" });

  return (
    <form ref={formRef} onSubmit={(e) => submitWithoutReset(e, action)} className="mt-4 border-t pt-4">
      <h3 className="text-base font-bold">Add a job manually</h3>
      <div className="grid gap-x-3.5 sm:grid-cols-2">
        <Field id="mTitle" name="title" label="Job title" required />
        <Field id="mEmployer" name="employer" label="Employer" />
        <Field id="mBand" name="band" label="Band or grade" />
        <Field id="mClosing" name="closingDate" label="Closing date" type="date" />
      </div>
      <Field id="mLink" name="link" label="Link (optional)" type="url" placeholder="https://" />
      <Button type="submit" disabled={saving} className="mt-3">
        {saving ? "Saving…" : "Save job"}
      </Button>
      {state.status === "error" && <StatusLine message={state.message} error />}
    </form>
  );
}

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={id} className="mt-3 mb-1.5 text-muted-foreground">
        {label}
      </Label>
      <Input id={id} className="h-10 bg-background" {...props} />
    </div>
  );
}
