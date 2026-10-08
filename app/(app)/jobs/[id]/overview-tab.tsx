"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobStatus } from "@/lib/jobs/stages";
import { submitWithoutReset } from "@/lib/forms-client";
import { formatUkDate, todayUk } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/jobs/status";
import { SECTOR_LABEL } from "@/lib/ai/sector";
import { SECTORS, type Sector } from "@/lib/jobs/stages";
import { deleteJob, saveOverview, type OverviewState } from "./actions";

export type OverviewJob = {
  id: string;
  title: string;
  employer: string;
  band: string;
  salary: string;
  location: string;
  reference: string;
  closingDate: string | null;
  interviewDate: string | null;
  interviewTime: string;
  link: string;
  sponsorship: "yes" | "no" | "unknown";
  sector: Sector;
  contacts: string;
  notes: string;
  submittedAt: string | null;
};

type Props = { job: OverviewJob; history: { status: JobStatus; changedAt: string }[] };

export function OverviewTab({ job, history }: Props) {
  const [state, action, saving] = useActionState<OverviewState, FormData>(async (prev, data) => {
    const next = await saveOverview(prev, data);
    if (next.status === "ok") toast(next.message);
    return next;
  }, { status: "idle" });
  const [deleting, startDelete] = useTransition();

  function remove() {
    if (!confirm(`Delete "${job.title}" with its scores and history? This cannot be undone.`)) return;
    startDelete(async () => {
      const result = await deleteJob(job.id);
      if (result && !result.ok) toast("That job could not be deleted.");
    });
  }

  return (
    <div>
      <form onSubmit={(e) => submitWithoutReset(e, action)}>
        <input type="hidden" name="jobId" value={job.id} />
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <Field name="title" label="Job title" value={job.title} required />
          <Field name="employer" label="Employer" value={job.employer} />
          <Field name="band" label="Band or grade" value={job.band} />
          <Field name="salary" label="Salary" value={job.salary} />
          <Field name="location" label="Location" value={job.location} />
          <Field name="reference" label="Reference number" value={job.reference} />
          <Field name="closingDate" label="Closing date" value={job.closingDate ?? ""} type="date" />
          <div>
            <Label htmlFor="sector" className="mt-3 mb-1.5 text-muted-foreground">
              Sector (changes how the job is scored and written for)
            </Label>
            <select id="sector" name="sector" defaultValue={job.sector} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sponsorship" className="mt-3 mb-1.5 text-muted-foreground">
              Visa sponsorship
            </Label>
            <select id="sponsorship" name="sponsorship" defaultValue={job.sponsorship} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
              <option value="unknown">Not stated</option>
              <option value="yes">Offered</option>
              <option value="no">Not offered</option>
            </select>
          </div>
          <Field
            name="appliedDate"
            label="Date applied"
            value={job.submittedAt ? todayUk(new Date(job.submittedAt)) : ""}
            type="date"
            max={todayUk()}
          />
          <div className="hidden sm:block" aria-hidden />
          <Field name="interviewDate" label="Interview date" value={job.interviewDate ?? ""} type="date" />
          <Field name="interviewTime" label="Interview time" value={job.interviewTime} type="time" />
        </div>
        <Field name="link" label="Link to the advert" value={job.link} type="url" placeholder="https://" />
        <Label htmlFor="contacts" className="mt-3 mb-1.5 text-muted-foreground">
          Contacts
        </Label>
        <Textarea id="contacts" name="contacts" defaultValue={job.contacts} placeholder="Recruiting manager name, email, phone" className="min-h-18 bg-background" />
        <Label htmlFor="notes" className="mt-3 mb-1.5 text-muted-foreground">
          Notes
        </Label>
        <Textarea id="notes" name="notes" defaultValue={job.notes} className="min-h-24 bg-background" />
        <Button type="submit" disabled={saving} className="mt-3">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
      </form>

      <h3 className="mt-6 mb-2 text-base font-bold">Stage history</h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes yet.</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {history.map((h, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted-foreground">{formatUkDate(h.changedAt)}</span>
              <span>{STATUS_LABEL[h.status]}</span>
            </li>
          ))}
        </ol>
      )}
      {job.submittedAt && <p className="mt-2 text-sm text-muted-foreground">Applied {formatUkDate(job.submittedAt)}</p>}

      <div className="mt-8 border-t pt-4">
        <Button variant="destructive" onClick={remove} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete this job"}
        </Button>
      </div>
    </div>
  );
}

function Field({ name, label, value, ...props }: { name: string; label: string; value: string } & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={name} className="mt-3 mb-1.5 text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} defaultValue={value} className="h-10 bg-background" {...props} />
    </div>
  );
}
