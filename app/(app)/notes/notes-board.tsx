"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatUkDate } from "@/lib/dates";
import { hostOf, linkify } from "@/lib/linkify";
import { cn } from "@/lib/utils";
import { addNote, deleteNote, setPinned, updateNote } from "./actions";

type Note = { id: string; body: string; pinned: boolean; createdAt: string; updatedAt: string };

export function NotesBoard({ notes }: { notes: Note[] }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const q = query.trim().toLowerCase();
  const shown = q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;

  function save() {
    setError(undefined);
    startSave(async () => {
      const result = await addNote(draft);
      if (!result.ok) return setError(result.message);
      setDraft("");
      toast("Note saved");
      boxRef.current?.focus();
    });
  }

  return (
    <div className="space-y-3.5">
      <Panel title="Notes" hint="Job links to look at later, ideas and reminders. Not tied to any job.">
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor="newNote" className="sr-only">
            New note
          </label>
          <Textarea
            ref={boxRef}
            id="newNote"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
              }
            }}
            placeholder="Paste a link or write a note. For example: https://www.jobs.nhs.uk/… looks good, closes Friday"
            className="min-h-24 bg-background"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save note"}
            </Button>
            <span className="text-sm text-muted-foreground">or press Ctrl+Enter</span>
          </div>
          {error && <StatusLine message={error} error />}
        </form>
      </Panel>

      {notes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground">
            {q ? `${shown.length} of ${notes.length} notes` : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </p>
          <label className="w-full sm:w-72">
            <span className="sr-only">Search notes</span>
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="h-10 bg-card" />
          </label>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState title="No notes yet">Paste a job link or jot something down above.</EmptyState>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">No notes match &quot;{query}&quot;.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((n) => (
            <NoteCard key={`${n.id}-${n.updatedAt}`} note={n} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [pending, start] = useTransition();
  const parts = linkify(note.body);
  const links = parts.filter((p) => p.type === "link");

  function save() {
    start(async () => {
      const result = await updateNote(note.id, text);
      if (!result.ok) return void toast(result.message);
      setEditing(false);
      toast("Note updated");
    });
  }

  return (
    <li className={cn("flex flex-col rounded-2xl border bg-card p-4", note.pinned && "border-primary/50")}>
      {editing ? (
        <>
          <label htmlFor={`edit-${note.id}`} className="sr-only">
            Edit note
          </label>
          <Textarea
            id={`edit-${note.id}`}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-h-28 bg-background"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={save} disabled={pending || !text.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setText(note.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[15px] break-words whitespace-pre-wrap">
            {parts.map((p, i) =>
              p.type === "link" ? (
                <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                  {p.text}
                </a>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
          {links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {links.map((l, i) => (
                <a
                  key={i}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium hover:bg-primary/15"
                >
                  Open {hostOf(l.href) || "link"} ↗
                </a>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            <span className="text-xs text-muted-foreground">
              {note.pinned && <span className="font-semibold text-primary">Pinned · </span>}
              {formatUkDate(note.createdAt)}
              {note.updatedAt.slice(0, 16) !== note.createdAt.slice(0, 16) && `, edited ${formatUkDate(note.updatedAt)}`}
            </span>
            <span className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-pressed={note.pinned}
                onClick={() => start(async () => void (await setPinned(note.id, !note.pinned)))}
              >
                {note.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this note?")) start(async () => void (await deleteNote(note.id)));
                }}
              >
                Delete
              </Button>
            </span>
          </div>
        </>
      )}
    </li>
  );
}
