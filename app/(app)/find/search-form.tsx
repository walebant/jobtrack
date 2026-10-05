"use client";

import { useActionState } from "react";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISTANCES } from "@/lib/forms";
import { submitWithoutReset } from "@/lib/forms-client";
import { BANDS, STAFF_GROUPS } from "@/lib/nhsjobs/constants";
import { saveSearch, type SearchFormState } from "./actions";

export type SearchValues = {
  keywords: string;
  location: string;
  distance: number;
  staffGroups: string[];
  bands: string[];
  maxNew: number;
};

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function SearchForm({ values, saved }: { values: SearchValues; saved: boolean }) {
  const [state, action, saving] = useActionState<SearchFormState, FormData>(saveSearch, { status: "idle" });

  return (
    <Panel
      title="Your NHS Jobs search"
      hint={saved ? "Find jobs searches NHS Jobs with these settings." : "Check these settings and save them before your first search."}
    >
      <form onSubmit={(e) => submitWithoutReset(e, action)} className="mt-1">
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="location" className="mt-3 mb-1.5 text-muted-foreground">
              Location (town or postcode, optional)
            </Label>
            <Input id="location" name="location" defaultValue={values.location} placeholder="For example: Sutton or SM1" className="h-10 bg-background" />
          </div>
          <div>
            <Label htmlFor="distance" className="mt-3 mb-1.5 text-muted-foreground">
              Distance
            </Label>
            <select id="distance" name="distance" defaultValue={String(values.distance)} className={selectClass}>
              {DISTANCES.map((d) => (
                <option key={d} value={d}>
                  Within {d} miles
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="keywords" className="mt-3 mb-1.5 text-muted-foreground">
              Keywords (optional)
            </Label>
            <Input id="keywords" name="keywords" defaultValue={values.keywords} placeholder="For example: data, systems, analyst" className="h-10 bg-background" />
          </div>
          <div>
            <Label htmlFor="maxNew" className="mt-3 mb-1.5 text-muted-foreground">
              New jobs to score per search
            </Label>
            <select id="maxNew" name="maxNew" defaultValue={String(values.maxNew)} className={selectClass}>
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  Up to {n} (uses up to {n} AI calls)
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium text-muted-foreground">Staff group</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(STAFF_GROUPS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="staffGroups" value={value} defaultChecked={values.staffGroups.includes(value)} className="size-4 accent-primary" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium text-muted-foreground">Bands (none ticked = any band)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(BANDS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="bands" value={value} defaultChecked={values.bands.includes(value)} className="size-4 accent-primary" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" variant={saved ? "outline" : "default"} disabled={saving} className="mt-4">
          {saving ? "Saving…" : "Save search"}
        </Button>
        {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
      </form>
    </Panel>
  );
}
