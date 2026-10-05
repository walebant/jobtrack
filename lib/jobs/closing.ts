import { todayUk } from "@/lib/dates";

// Whole days from today (UK) to the closing date. 0 = closes today, negative = closed.
export function daysLeft(closingDate: string | null, today: string = todayUk()): number | null {
  if (!closingDate) return null;
  const close = Date.parse(closingDate + "T00:00:00Z");
  const now = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(close) || Number.isNaN(now)) return null;
  return Math.round((close - now) / 86_400_000);
}

export type ClosingTone = "bad" | "mid" | "neutral";

// PRD: amber at 7 days or fewer, red at 3 days or fewer.
export function closingInfo(closingDate: string | null, today?: string): { label: string; tone: ClosingTone } | null {
  const d = daysLeft(closingDate, today);
  if (d === null) return null;
  if (d < 0) return { label: "Closed", tone: "neutral" };
  const label = d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : `Closes in ${d} days`;
  return { label, tone: d <= 3 ? "bad" : d <= 7 ? "mid" : "neutral" };
}
