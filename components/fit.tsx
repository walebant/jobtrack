import type { Criterion } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Chip } from "./chips";

type Tone = "good" | "mid" | "bad";

// Green 8 and above, amber 6 to 7, red 5 and below (as in the prototype).
export function scoreTone(score: number): Tone {
  return score >= 8 ? "good" : score >= 6 ? "mid" : "bad";
}

const TONE_TEXT: Record<Tone, string> = { good: "text-good", mid: "text-mid", bad: "text-bad" };
const TONE_CHIP: Record<Tone, string> = { good: "bg-good-bg text-good", mid: "bg-mid-bg text-mid", bad: "bg-bad-bg text-bad" };

export const VERDICT_LABEL = { apply: "Worth applying", maybe: "Maybe", skip: "Probably skip" } as const;

export function FitChip({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONE_CHIP[scoreTone(score)], className)}>
      Fit {score}/10
    </span>
  );
}

// The one bold element in the design: a large ring with the score in the middle.
export function FitDial({ score, size = 112 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  return (
    <div
      role="img"
      aria-label={`Fit score ${score} out of 10`}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--${tone}) ${score * 36}deg, var(--muted) 0)` }}
    >
      <div className="absolute inset-[10px] rounded-full bg-background" />
      <div className="relative text-center">
        <div className={cn("font-heading text-[42px] leading-none font-bold", TONE_TEXT[tone])}>{score}</div>
        <div className="text-xs text-muted-foreground">out of 10</div>
      </div>
    </div>
  );
}

const RATING: Record<Criterion["rating"], { label: string; tone: "good" | "mid" | "bad" }> = {
  met: { label: "Met", tone: "good" },
  partial: { label: "Partly met", tone: "mid" },
  gap: { label: "Gap", tone: "bad" },
};
const ORDER = { gap: 0, partial: 1, met: 2 } as const;

// Essential criteria first, then gaps first within each group.
export function sortCriteria(criteria: Criterion[]): Criterion[] {
  return [...criteria].sort(
    (a, b) => (a.type === b.type ? 0 : a.type === "essential" ? -1 : 1) || ORDER[a.rating] - ORDER[b.rating],
  );
}

export function CriterionCard({ c }: { c: Criterion }) {
  const r = RATING[c.rating];
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span>
          <span className="block text-xs text-muted-foreground">{c.type === "essential" ? "Essential" : "Desirable"}</span>
          {c.text}
        </span>
        <span className={cn("inline-block shrink-0 rounded-full px-2 py-0.5 text-xs whitespace-nowrap", TONE_CHIP[r.tone])}>{r.label}</span>
      </div>
      {c.evidence && <p className="mt-1.5 text-sm text-muted-foreground">{c.evidence}</p>}
    </div>
  );
}

export function NotScoredChip({ hasCriteria }: { hasCriteria: boolean }) {
  return <Chip className="text-muted-foreground">{hasCriteria ? "Not scored" : "No criteria"}</Chip>;
}
