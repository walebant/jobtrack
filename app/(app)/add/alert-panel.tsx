"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUkDate } from "@/lib/dates";
import { submitWithoutReset } from "@/lib/forms-client";
import { readAlert, saveFoundJobs, type AlertState, type FoundJobWithPick } from "./actions";

export function AlertPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const [found, setFound] = useState<FoundJobWithPick[]>([]);
  const [state, action, reading] = useActionState<AlertState, FormData>(async (prev, data) => {
    const next = await readAlert(prev, data);
    setFound(next.status === "found" ? next.jobs : []);
    return next;
  }, { status: "idle" });
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string>();
  const router = useRouter();

  const picked = found.filter((j) => j.pick);
  const alreadyTracked = state.status === "found" ? state.jobs.filter((j) => !j.pick).length : 0;

  function toggle(i: number, pick: boolean) {
    setFound((list) => list.map((j, k) => (k === i ? { ...j, pick } : j)));
  }

  function save() {
    setSaveError(undefined);
    startSave(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await saveFoundJobs(picked.map(({ pick, ...job }) => job));
      if (!result.ok) return setSaveError(result.message);
      toast(`Saved ${result.count} job${result.count === 1 ? "" : "s"}`);
      setFound([]);
      formRef.current?.reset();
      router.push("/pipeline");
    });
  }

  const status = reading
    ? "Looking for jobs…"
    : state.status === "error"
      ? state.message
      : state.status === "found"
        ? state.jobs.length
          ? `Found ${state.jobs.length} job${state.jobs.length === 1 ? "" : "s"}.${alreadyTracked ? " Jobs you already track are unticked." : ""}`
          : "No jobs found in that text."
        : undefined;

  return (
    <Panel title="Paste a job alert email" hint="Paste a whole alert email to pick out every job in it.">
      <form ref={formRef} onSubmit={(e) => submitWithoutReset(e, action)} className="mt-1">
        <Label htmlFor="alertIn" className="mt-3 mb-1.5 text-muted-foreground">
          Email text
        </Label>
        <Textarea id="alertIn" name="email" required placeholder="Paste the alert email here" className="min-h-56 bg-background" />
        <Button type="submit" disabled={reading} className="mt-3">
          {reading ? "Reading…" : "Find jobs in email"}
        </Button>
        <StatusLine message={status} error={!reading && state.status === "error"} />
      </form>

      {found.length > 0 && (
        <div className="mt-2 border-t pt-3">
          <h3 className="text-base font-bold">Jobs found in the email</h3>
          <ul>
            {found.map((j, i) => {
              const id = `found-${i}`;
              return (
                <li key={id} className="flex items-start gap-3 border-b py-2.5 last:border-b-0">
                  <Checkbox id={id} checked={j.pick} onCheckedChange={(v) => toggle(i, v === true)} className="mt-1 size-[18px]" />
                  <label htmlFor={id} className="cursor-pointer">
                    <span className="font-semibold">{j.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[j.employer, j.band, j.salary, j.location].filter(Boolean).join(" · ")}
                      {j.closingDate && ` · Closes ${formatUkDate(j.closingDate)}`}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            Alert emails rarely include the person specification, so these jobs are saved without criteria. Paste the full
            advert for any job you want scored.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button onClick={save} disabled={saving || picked.length === 0}>
              {saving ? "Saving…" : `Save ${picked.length} selected job${picked.length === 1 ? "" : "s"}`}
            </Button>
            <Button variant="outline" onClick={() => setFound([])} disabled={saving}>
              Clear
            </Button>
          </div>
          {saveError && <StatusLine message={saveError} error />}
        </div>
      )}
    </Panel>
  );
}
