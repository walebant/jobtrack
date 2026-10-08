"use client";

import { useActionState } from "react";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms-client";
import { saveNotes, type FormState } from "./actions";

export function NotesPanel({ notes }: { notes: string }) {
  const [state, action, saving] = useActionState<FormState, FormData>(saveNotes, { status: "idle" });
  return (
    <Panel title="Anything else Claude should know" hint="Used with every CV, for example the roles you are targeting or training in progress.">
      <form onSubmit={(e) => submitWithoutReset(e, action)} className="mt-3">
        <label htmlFor="notes" className="sr-only">
          Notes
        </label>
        <Textarea id="notes" name="notes" defaultValue={notes} className="min-h-24 bg-background" />
        <Button type="submit" variant="outline" disabled={saving} className="mt-3">
          {saving ? "Saving…" : "Save notes"}
        </Button>
        {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
      </form>
    </Panel>
  );
}
