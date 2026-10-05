import { parse, type HTMLElement } from "node-html-parser";

import { BANDS, NHS_JOBS_ORIGIN, STAFF_GROUPS } from "./constants";

export { BANDS, NHS_JOBS_ORIGIN, STAFF_GROUPS };
export type { Band, StaffGroup } from "./constants";

export type SearchSettings = {
  keywords: string;
  location: string;
  distance: number;
  staffGroups: string[];
  bands: string[];
};

export function buildSearchUrl(s: SearchSettings, page = 1): string {
  const q = new URLSearchParams();
  if (s.keywords.trim()) q.set("keyword", s.keywords.trim());
  if (s.location.trim()) {
    q.set("location", s.location.trim());
    q.set("distance", String(s.distance));
  }
  // NHS Jobs wants several values as one comma-separated parameter; repeating it returns a 400.
  const groups = s.staffGroups.filter((g) => g in STAFF_GROUPS);
  const bands = s.bands.filter((b) => b in BANDS);
  if (groups.length) q.set("staffGroup", groups.join(","));
  if (bands.length) q.set("payBand", bands.join(","));
  q.set("sort", "publicationDateDesc"); // newest first, so a capped run sees the latest jobs
  if (page > 1) q.set("page", String(page));
  q.set("language", "en");
  return `${NHS_JOBS_ORIGIN}/candidate/search/results?${q}`;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "5 October 2026" (or "The closing date is 07 October 2026") -> "2026-10-05".
export function parseUkLongDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const iso = `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

// The advert id in a job link, for example /candidate/jobadvert/C9232-26-0255?x=y -> C9232-26-0255.
export function advertRef(href: string): string | null {
  const m = href.match(/\/candidate\/jobadvert\/([A-Za-z0-9-]+)/);
  return m ? m[1] : null;
}

export type SearchResult = {
  ref: string;
  title: string;
  employer: string;
  location: string;
  salary: string;
  closingDate: string | null;
  postedDate: string | null;
  contractType: string;
  workingPattern: string;
  url: string;
};

function field(item: HTMLElement, test: string): string {
  const el = item.querySelector(`[data-test="${test}"]`);
  return clean(el?.querySelector("strong")?.text ?? el?.text);
}

export function parseSearchResults(html: string): { results: SearchResult[]; total: number | null; hasNext: boolean } {
  const root = parse(html);
  const results: SearchResult[] = [];
  for (const item of root.querySelectorAll('[data-test="search-result"]')) {
    const link = item.querySelector('[data-test="search-result-job-title"]');
    const ref = advertRef(link?.getAttribute("href") ?? "");
    if (!link || !ref) continue;
    const where = item.querySelector('[data-test="search-result-location"]');
    const town = clean(where?.querySelector(".location-font-size")?.text);
    const employer = clean(where?.querySelector("h3")?.childNodes.find((n) => n.nodeType === 3 && clean(n.text))?.text);
    results.push({
      ref,
      title: clean(link.text),
      employer,
      location: town,
      salary: field(item, "search-result-salary"),
      closingDate: parseUkLongDate(field(item, "search-result-closingDate")),
      postedDate: parseUkLongDate(field(item, "search-result-publicationDate")),
      contractType: field(item, "search-result-jobType"),
      workingPattern: field(item, "search-result-workingPattern"),
      url: `${NHS_JOBS_ORIGIN}/candidate/jobadvert/${ref}`,
    });
  }
  const total = root.text.match(/([\d,]+)\s+jobs?\s+found/i);
  return {
    results,
    total: total ? Number(total[1].replace(/,/g, "")) : null,
    hasNext: Boolean(root.querySelector('[data-test="search-next-page"]')),
  };
}
