"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { noDash } from "@/lib/ai/clean";
import { REVIEW_MARKER, WRITING_KINDS, WRITING_LABEL, countWords, splitReview, type WritingKind } from "@/lib/ai/writing";
import { formatUkDate } from "@/lib/dates";
import { submitWithoutReset } from "@/lib/forms-client";
import { cn } from "@/lib/utils";
import { downloadDocx, downloadTxt, fileStem } from "@/lib/writing/download";
import { askFirst, clearQuestions, markSent, saveAnswers, saveDraftEdit, saveWritingInputs, type InputsState } from "./writing-actions";

export type DraftVersion = {
  id: string;
  kind: WritingKind;
  version: number;
  content: string;
  review: string;
  isSent: boolean;
  cvName: string;
  model: string;
  createdAt: string;
};

type Props = {
  jobId: string;
  jobTitle: string;
  piece: WritingKind;
  applied: boolean;
  cvName: string | null;
  whyNotes: string;
  writeLimit: number | null;
  writeLimitUnit: "words" | "characters";
  questions: { question: string; answer: string }[];
  versions: DraftVersion[]; // this piece only, newest first
};

export function WritingTab(p: Props) {
  return (
    <div>
      <nav aria-label="What to write" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm">
        {WRITING_KINDS.map((k) => (
          <Link
            key={k}
            href={`/jobs/${p.jobId}?tab=writing&piece=${k}`}
            aria-current={p.piece === k ? "page" : undefined}
            className={cn(
              "rounded-[9px] px-3 py-1.5 font-medium whitespace-nowrap text-muted-foreground",
              p.piece === k && "bg-card text-foreground shadow-sm",
            )}
          >
            {WRITING_LABEL[k]}
          </Link>
        ))}
      </nav>

      {!p.cvName ? (
        <p className="text-mid">
          Add a CV in{" "}
          <Link href="/profile" className="underline underline-offset-2">
            My profile
          </Link>{" "}
          first. Everything is written from your real experience.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Written from your <span className="font-medium text-foreground">&quot;{p.cvName}&quot;</span> CV, evidence bank and notes,
            plus this job&apos;s advert, criteria and documents. Change the CV on the{" "}
            <Link href={`/jobs/${p.jobId}?tab=fit`} className="underline underline-offset-2">
              Fit score
            </Link>{" "}
            tab.
          </p>
          {p.piece === "statement" && (
            <StatementInputs jobId={p.jobId} whyNotes={p.whyNotes} writeLimit={p.writeLimit} writeLimitUnit={p.writeLimitUnit} />
          )}
          <AskFirst jobId={p.jobId} kind={p.piece} questions={p.questions} />
          <DraftEditor key={`${p.piece}-${p.versions[0]?.id ?? "none"}`} {...p} />
        </>
      )}
    </div>
  );
}

function StatementInputs({ jobId, whyNotes, writeLimit, writeLimitUnit }: { jobId: string; whyNotes: string; writeLimit: number | null; writeLimitUnit: "words" | "characters" }) {
  const [state, action, saving] = useActionState<InputsState, FormData>(saveWritingInputs, { status: "idle" });
  return (
    <details className="mb-4 rounded-xl border bg-card px-4 py-3" open={!whyNotes}>
      <summary className="cursor-pointer font-medium">Why this role, and the word limit</summary>
      <form onSubmit={(e) => submitWithoutReset(e, action)}>
        <input type="hidden" name="jobId" value={jobId} />
        <Label htmlFor="whyNotes" className="mt-3 mb-1.5 text-muted-foreground">
          Why you want this role at this employer (rough notes are fine)
        </Label>
        <Textarea
          id="whyNotes"
          name="whyNotes"
          defaultValue={whyNotes}
          placeholder="For example: I use their data in my current role, I like their digital strategy, it is close to home"
          className="min-h-20 bg-background"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="writeLimit" className="mb-1.5 text-muted-foreground">
              Limit in the advert (optional)
            </Label>
            <Input id="writeLimit" name="writeLimit" inputMode="numeric" defaultValue={writeLimit ?? ""} placeholder="For example: 1500" className="h-10 w-36 bg-background" />
          </div>
          <select
            name="writeLimitUnit"
            defaultValue={writeLimitUnit}
            aria-label="Limit unit"
            className="h-10 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="words">words</option>
            <option value="characters">characters</option>
          </select>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
      </form>
    </details>
  );
}

function AskFirst({ jobId, kind, questions }: { jobId: string; kind: WritingKind; questions: { question: string; answer: string }[] }) {
  const [asking, startAsk] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);

  function ask() {
    setError(undefined);
    startAsk(async () => {
      const result = await askFirst(jobId, kind);
      if (!result.ok) setError(result.message);
    });
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const answers = new FormData(e.currentTarget).getAll("answer").map(String);
    startSave(async () => {
      const { ok } = await saveAnswers(jobId, kind, answers);
      toast(ok ? "Answers saved. They will be used when you write." : "Could not save the answers.");
    });
  }

  if (!questions.length) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={ask} disabled={asking}>
          {asking ? "Thinking of questions…" : "Ask me first (optional)"}
        </Button>
        <span className="text-sm text-muted-foreground">Claude asks up to 8 questions to fill gaps and missing numbers. Skip it and unknowns are marked [CHECK].</span>
        {(asking || error) && <StatusLine message={asking ? "This can take up to a minute…" : error} error={!asking && Boolean(error)} className="w-full" />}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={save} className="mb-4 rounded-xl border bg-card px-4 py-3">
      <h3 className="text-base font-bold">Questions before writing</h3>
      <p className="text-sm text-muted-foreground">Answer what you can. Leave the rest blank.</p>
      <ol className="mt-2 space-y-3">
        {questions.map((q, i) => (
          <li key={i}>
            <label htmlFor={`answer-${i}`} className="text-sm font-medium">
              {i + 1}. {q.question}
            </label>
            <Textarea id={`answer-${i}`} name="answer" defaultValue={q.answer} className="mt-1 min-h-14 bg-background" />
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? "Saving…" : "Save answers"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => {
            if (confirm("Remove these questions and answers?")) startSave(async () => void (await clearQuestions(jobId, kind)));
          }}
        >
          Clear questions
        </Button>
      </div>
    </form>
  );
}

const ERROR_MARK = "[[ERROR]]";

function DraftEditor({ jobId, jobTitle, piece, applied, writeLimit, writeLimitUnit, versions }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(versions[0]?.id ?? null);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;
  const [text, setText] = useState(selected?.content ?? "");
  const [streamed, setStreamed] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const streaming = streamed !== null;

  const live = streamed !== null ? splitReview(noDash(streamed)) : null;
  const shown = live ? live.content : text;
  const review = live ? live.review : (selected?.review ?? "");
  const words = countWords(shown);
  const chars = shown.length;
  const limit = piece === "statement" ? writeLimit : null;
  const used = writeLimitUnit === "characters" ? chars : words;
  const over = limit !== null && used > limit;
  const dirty = selected ? text !== selected.content : text.trim() !== "";
  const sentVersion = versions.find((v) => v.isSent);

  async function write() {
    if (dirty && !confirm("You have unsaved edits. Write a new version anyway?")) return;
    setError(undefined);
    setStreamed("");
    const controller = new AbortController();
    abortRef.current = controller;
    let all = "";
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, kind: piece }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Writing could not start. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        all += decoder.decode(value, { stream: true });
        const cut = all.indexOf(ERROR_MARK);
        setStreamed(cut >= 0 ? all.slice(0, cut) : all);
      }
      const cut = all.indexOf(ERROR_MARK);
      if (cut >= 0) setError(all.slice(cut + ERROR_MARK.length).trim());
      else toast(`${WRITING_LABEL[piece]} written and saved`);
    } catch (e) {
      if (controller.signal.aborted) toast("Stopped. What was written so far is saved.");
      else setError(e instanceof Error ? e.message : "Writing failed. Try again.");
    } finally {
      abortRef.current = null;
      // The new version arrives from the server and replaces this view.
      router.refresh();
      if (!all.trim()) setStreamed(null);
    }
  }

  function saveEdits() {
    if (!selected) return;
    startSave(async () => {
      const result = await saveDraftEdit(selected.id, text);
      toast(result.message ?? (result.ok ? "Saved" : "Could not save."));
    });
  }

  function sent() {
    if (!selected) return;
    startSave(async () => {
      const result = await markSent(selected.id);
      toast(result.ok ? `Version ${selected.version} marked as sent` : (result.message ?? "Could not mark it as sent."));
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      toast("Copied");
    } catch {
      toast("Could not copy. Select the text and copy it instead.");
    }
  }

  const stem = fileStem(jobTitle, WRITING_LABEL[piece]);

  return (
    <section aria-label={WRITING_LABEL[piece]}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={write} disabled={streaming || saving}>
            {streaming ? "Writing…" : versions.length ? "Write again" : `Write my ${WRITING_LABEL[piece].toLowerCase()}`}
          </Button>
          {streaming && (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              Stop
            </Button>
          )}
        </div>
        {versions.length > 0 && !streaming && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Version</span>
            <select
              value={selected?.id}
              onChange={(e) => {
                const v = versions.find((x) => x.id === e.target.value);
                if (dirty && !confirm("Discard your unsaved edits?")) return;
                setSelectedId(e.target.value);
                setText(v?.content ?? "");
              }}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version}
                  {v.isSent ? " (sent)" : ""} · {formatUkDate(v.createdAt)} · {v.model ? "Claude" : "your edit"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {streaming && <StatusLine message={streamed ? "Writing…" : "Planning against the person specification. The first words can take a minute or two…"} />}

      {versions.length === 0 && !streaming ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground">
          Nothing written yet. Press the button above to write a first draft. You can edit it, keep versions and download it.
        </p>
      ) : (
        <>
          <Textarea
            aria-label={`${WRITING_LABEL[piece]} text`}
            value={shown}
            readOnly={streaming}
            onChange={(e) => setText(e.target.value)}
            className={cn("min-h-[420px] bg-background leading-relaxed", streaming && "opacity-90")}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={cn("text-muted-foreground", over && "font-semibold text-bad")}>
              {words.toLocaleString("en-GB")} words · {chars.toLocaleString("en-GB")} characters
              {limit !== null && ` · limit ${limit.toLocaleString("en-GB")} ${writeLimitUnit}${over ? " (over the limit)" : ""}`}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {selected?.isSent && <Badge>Sent{applied ? " · locked" : ""}</Badge>}
              {selected?.cvName && <span className="text-muted-foreground">CV: {selected.cvName}</span>}
            </span>
          </div>
          {!streaming && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveEdits} disabled={!dirty || saving}>
                Save edits as new version
              </Button>
              <Button variant="outline" onClick={copy}>
                Copy
              </Button>
              <Button variant="outline" onClick={() => downloadDocx(shown, stem)}>
                Download .docx
              </Button>
              <Button variant="outline" onClick={() => downloadTxt(shown, stem)}>
                Download .txt
              </Button>
              {selected && !selected.isSent && !(applied && sentVersion) && (
                <Button variant="outline" onClick={sent} disabled={saving || dirty}>
                  Mark this version as sent
                </Button>
              )}
            </div>
          )}
          {applied && sentVersion && !selected?.isSent && (
            <p className="mt-2 text-sm text-muted-foreground">Version {sentVersion.version} is locked as the one you sent.</p>
          )}
        </>
      )}

      {error && <StatusLine message={error} error />}

      {review && (
        <details className="mt-4 rounded-xl border bg-card px-4 py-3" open>
          <summary className="cursor-pointer font-medium">Panel check (not part of the text to paste)</summary>
          <pre className="mt-2 font-sans text-sm whitespace-pre-wrap text-muted-foreground">{review.replace(REVIEW_MARKER, "").trim()}</pre>
        </details>
      )}
    </section>
  );
}
