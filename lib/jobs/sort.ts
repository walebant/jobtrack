export const SORTS = ["fit", "closing", "newest"] as const;
export type JobSort = (typeof SORTS)[number];

export function parseSort(value: unknown): JobSort {
  return SORTS.includes(value as JobSort) ? (value as JobSort) : "fit";
}

type Sortable = { score: number | null; closingDate: string | null; createdAt: Date };

const byClosing = (a: Sortable, b: Sortable) =>
  (a.closingDate ?? "9999-12-31").localeCompare(b.closingDate ?? "9999-12-31");
const byNewest = (a: Sortable, b: Sortable) => b.createdAt.getTime() - a.createdAt.getTime();

// fit: best score first, unscored last, ties by soonest closing date.
// closing: soonest closing date first, no date last.
// newest: most recently added first.
export function sortJobs<T extends Sortable>(list: T[], sort: JobSort): T[] {
  const out = [...list];
  if (sort === "newest") return out.sort(byNewest);
  if (sort === "closing") return out.sort((a, b) => byClosing(a, b) || byNewest(a, b));
  return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byClosing(a, b) || byNewest(a, b));
}
