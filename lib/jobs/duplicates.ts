// A job counts as already tracked when its title and employer match,
// ignoring case, spacing and punctuation.
export function jobKey(title: string, employer: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(title)}|${norm(employer)}`;
}

// Marks each found job with pick: false if it is already tracked (or repeats
// an earlier job in the same email), true otherwise.
export function markDuplicates<T extends { title: string; employer: string }>(
  found: T[],
  existing: { title: string; employer: string }[],
): (T & { pick: boolean })[] {
  const seen = new Set(existing.map((j) => jobKey(j.title, j.employer)));
  return found.map((j) => {
    const key = jobKey(j.title, j.employer);
    const pick = !seen.has(key);
    seen.add(key);
    return { ...j, pick };
  });
}
