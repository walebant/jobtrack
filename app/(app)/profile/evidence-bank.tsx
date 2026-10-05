"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel, StatusLine } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms-client";
import { deleteEvidence, saveEvidence, type FormState } from "./actions";

type Item = { id: string; title: string; tags: string[]; story: string };

export function EvidenceBank({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleting, startDelete] = useTransition();
  const [state, action, saving] = useActionState<FormState, FormData>(async (prev, data) => {
    const next = await saveEvidence(prev, data);
    // Clear the form after a successful save.
    if (next.status === "ok") {
      setEditing(null);
      setFormKey((k) => k + 1);
      toast(next.message);
    }
    return next;
  }, { status: "idle" });

  function edit(item: Item) {
    setEditing(item);
    setFormKey((k) => k + 1);
    requestAnimationFrame(() => document.getElementById("evTitle")?.focus());
  }

  function remove(item: Item) {
    if (!confirm(`Remove "${item.title}"?`)) return;
    startDelete(async () => {
      const { ok } = await deleteEvidence(item.id);
      toast(ok ? "Example removed." : "Could not remove that example.");
      if (editing?.id === item.id) setEditing(null);
    });
  }

  return (
    <Panel
      title="Evidence bank"
      hint="Real examples of your work, written as Situation, Task, Action, Result. Statements and interview answers draw on these."
    >
      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="text-muted-foreground">No examples yet.</p>}
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border bg-background px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-sans font-semibold">{item.title}</h3>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => edit(item)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" disabled={deleting} onClick={() => remove(item)}>
                  Remove
                </Button>
              </div>
            </div>
            {item.tags.length > 0 && (
              <div className="my-1.5 flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.story}</p>
          </article>
        ))}
      </div>

      <form key={formKey} onSubmit={(e) => submitWithoutReset(e, action)} className="mt-5">
        <h3 className="text-base font-bold">{editing ? "Edit example" : "Add an example"}</h3>
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <Label htmlFor="evTitle" className="mt-3 mb-1.5 text-muted-foreground">
          Title
        </Label>
        <Input
          id="evTitle"
          name="title"
          required
          maxLength={200}
          defaultValue={editing?.title}
          placeholder="For example: Built automated referral tool"
          className="h-10 bg-background"
        />
        <Label htmlFor="evTags" className="mt-3 mb-1.5 text-muted-foreground">
          Skills it shows (comma separated)
        </Label>
        <Input
          id="evTags"
          name="tags"
          defaultValue={editing?.tags.join(", ")}
          placeholder="Excel, automation, data quality"
          className="h-10 bg-background"
        />
        <Label htmlFor="evStory" className="mt-3 mb-1.5 text-muted-foreground">
          The example
        </Label>
        <Textarea
          id="evStory"
          name="story"
          required
          defaultValue={editing?.story}
          placeholder="Situation, task, what you did, and the result (with numbers if you have them)"
          className="min-h-32 bg-background"
        />
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save example"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setFormKey((k) => k + 1);
            }}
          >
            {editing ? "Cancel" : "Clear"}
          </Button>
        </div>
        {state.status === "error" && <StatusLine message={state.message} error />}
      </form>
    </Panel>
  );
}
