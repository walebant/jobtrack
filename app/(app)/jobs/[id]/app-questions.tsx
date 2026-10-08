"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { countWords } from "@/lib/ai/writing";
import type { AppQuestion } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { saveAppQuestions } from "./writing-actions";

type Row = { question: string; limit: string; unit: "words" | "characters" };

// The application form's questions, each with its own limit.
export function AppQuestionsEditor({ jobId, questions }: { jobId: string; questions: AppQuestion[] }) {
  const toRows = (qs: AppQuestion[]): Row[] => qs.map((q) => ({ question: q.question, limit: q.limit ? String(q.limit) : "", unit: q.unit }));
  const [rows, setRows] = useState<Row[]>(questions.length ? toRows(questions) : [{ question: "", limit: "", unit: "words" }]);
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();
  const saved = JSON.stringify(toRows(questions));
  const dirty = JSON.stringify(rows.filter((r) => r.question.trim())) !== saved;

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  function save() {
    setError(undefined);
    const clean = rows
      .filter((r) => r.question.trim())
      .map((r) => ({ question: r.question.trim(), limit: r.limit.trim() ? Number(r.limit.replace(/,/g, "")) : null, unit: r.unit }));
    if (clean.some((q) => q.limit !== null && !Number.isInteger(q.limit))) return setError("Limits must be whole numbers.");
    start(async () => {
      const result = await saveAppQuestions(jobId, clean);
      if (!result.ok) return setError(result.message);
      toast(clean.length ? `Saved ${clean.length} question${clean.length === 1 ? "" : "s"}` : "Questions cleared");
    });
  }

  return (
    <details className="mb-4 rounded-xl border bg-card px-4 py-3" open={!questions.length || dirty}>
      <summary className="cursor-pointer font-medium">
        The application form&apos;s questions {questions.length > 0 && <span className="text-muted-foreground">({questions.length})</span>}
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">
        Copy each question from the form, with its word or character limit. Questions found in the advert or documents are added
        for you.
      </p>
      <ol className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border bg-background p-3">
            <label htmlFor={`aq-${i}`} className="text-sm font-medium">
              Question {i + 1}
            </label>
            <Textarea
              id={`aq-${i}`}
              value={r.question}
              onChange={(e) => update(i, { question: e.target.value })}
              placeholder="For example: Describe a time you used data to improve a service. What did you do and what changed?"
              className="mt-1 min-h-16 bg-card"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`aql-${i}`} className="text-muted-foreground">
                Limit
              </label>
              <Input
                id={`aql-${i}`}
                inputMode="numeric"
                value={r.limit}
                onChange={(e) => update(i, { limit: e.target.value })}
                placeholder="None"
                className="h-9 w-24 bg-card"
              />
              <select
                aria-label={`Limit unit for question ${i + 1}`}
                value={r.unit}
                onChange={(e) => update(i, { unit: e.target.value as Row["unit"] })}
                className="h-9 rounded-lg border border-input bg-card px-2"
              >
                <option value="words">words</option>
                <option value="characters">characters</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [{ question: "", limit: "", unit: "words" }]))}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= 15}
          onClick={() => setRows((rs) => [...rs, { question: "", limit: "", unit: rs.at(-1)?.unit ?? "words" }])}
        >
          + Add a question
        </Button>
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save questions"}
        </Button>
      </div>
      {error && <StatusLine message={error} error />}
    </details>
  );
}

// One box per question: the answer, its count against the limit, and a copy button.
export function AnswersView({
  questions,
  answers,
  readOnly,
  onChange,
}: {
  questions: AppQuestion[];
  answers: string[];
  readOnly: boolean;
  onChange: (i: number, text: string) => void;
}) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Answer copied");
    } catch {
      toast("Could not copy. Select the text and copy it instead.");
    }
  }

  return (
    <ol className="space-y-4">
      {questions.map((q, i) => {
        const text = answers[i] ?? "";
        const used = q.unit === "characters" ? text.length : countWords(text);
        const over = q.limit !== null && used > q.limit;
        return (
          <li key={i} className="rounded-xl border bg-card p-3">
            <label htmlFor={`ans-${i}`} className="block text-sm font-semibold">
              {i + 1}. {q.question}
            </label>
            <Textarea
              id={`ans-${i}`}
              value={text}
              readOnly={readOnly}
              onChange={(e) => onChange(i, e.target.value)}
              className={cn("mt-2 min-h-44 bg-background leading-relaxed", readOnly && "opacity-90")}
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={cn("text-muted-foreground", over && "font-semibold text-bad")}>
                {used.toLocaleString("en-GB")} {q.unit}
                {q.limit !== null && ` of ${q.limit.toLocaleString("en-GB")}${over ? " (over the limit)" : ""}`}
              </span>
              {!readOnly && text.trim() && (
                <Button size="sm" variant="outline" onClick={() => copy(text)}>
                  Copy answer
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
