import { JOB_STATUSES, type JobStatus } from "./stages";

// Sorting for the pipeline table. Each column has a natural first direction
// (best fit first, soonest closing first, newest first, A to Z, earliest stage
// first); clicking the same header again reverses it. Missing values (no score,
// no closing date) always go last, whichever way the column is sorted.
export const SORTS = ["fit", "closing", "newest", "title", "stage"] as const;
export type JobSort = (typeof SORTS)[number];
export type SortDir = "natural" | "reversed";

export function parseSort(value: unknown): JobSort {
  return SORTS.includes(value as JobSort) ? (value as JobSort) : "fit";
}

export function parseDir(value: unknown): SortDir {
  return value === "reversed" ? "reversed" : "natural";
}

type Sortable = { score: number | null; closingDate: string | null; createdAt: Date; title?: string; status?: JobStatus };

// Compare two values where null always sorts last.
function nullsLast<V>(a: V | null, b: V | null, cmp: (x: V, y: V) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b);
}

const newestFirst = (a: Sortable, b: Sortable) => b.createdAt.getTime() - a.createdAt.getTime();
const stageIndex = (s: JobStatus | undefined) => (s ? JOB_STATUSES.indexOf(s) : JOB_STATUSES.length);
const text = (s: string | undefined) => (s ?? "").trim();

export function sortJobs<T extends Sortable>(list: T[], sort: JobSort, dir: SortDir = "natural"): T[] {
  const flip = dir === "reversed" ? -1 : 1;
  const primary = (a: T, b: T): number => {
    switch (sort) {
      case "fit":
        return nullsLast(a.score, b.score, (x, y) => flip * (y - x));
      case "closing":
        return nullsLast(a.closingDate, b.closingDate, (x, y) => flip * x.localeCompare(y));
      case "newest":
        return flip * newestFirst(a, b);
      case "title":
        return flip * text(a.title).localeCompare(text(b.title), "en-GB", { sensitivity: "base", numeric: true });
      case "stage":
        return flip * (stageIndex(a.status) - stageIndex(b.status));
    }
  };
  // Ties: soonest closing date, then newest.
  return [...list].sort(
    (a, b) => primary(a, b) || nullsLast(a.closingDate, b.closingDate, (x, y) => x.localeCompare(y)) || newestFirst(a, b),
  );
}
