import { z } from "zod";

// Shapes the model must return (sent as structured outputs, so replies always parse).
// Kept to plain strings and enums; the normalise* helpers below tidy the values.

export const AdvertSchema = z.object({
  title: z.string().describe("Job title as written in the advert"),
  employer: z.string().describe("Employing organisation, e.g. the NHS trust or council"),
  band: z.string().describe('Pay band or grade, e.g. "Band 5", or a council grade; "" if not stated'),
  salary: z.string().describe('Salary or range as written; "" if not stated'),
  location: z.string().describe('Main work location; "" if not stated'),
  reference: z.string().describe('Job reference number; "" if not stated'),
  closingDate: z.string().describe('Closing date as YYYY-MM-DD; "" if not stated'),
  link: z.string().describe('Link to the advert if it appears in the text; otherwise ""'),
  sponsorship: z
    .enum(["yes", "no", "unknown"])
    .describe('"yes" only if visa sponsorship is said to be possible, "no" if it is ruled out, otherwise "unknown"'),
  essential: z.array(z.string()).describe("Essential person specification criteria, one short criterion each"),
  desirable: z.array(z.string()).describe("Desirable person specification criteria, one short criterion each"),
});
export type AdvertReply = z.infer<typeof AdvertSchema>;

export const AlertJobSchema = z.object({
  title: z.string(),
  employer: z.string(),
  band: z.string(),
  salary: z.string(),
  location: z.string(),
  closingDate: z.string().describe('YYYY-MM-DD; "" if not shown'),
  link: z.string().describe('Link to this job if shown; otherwise ""'),
});
export const AlertSchema = z.object({
  jobs: z.array(AlertJobSchema).describe("Every job listed in the email, in order"),
});
export type AlertJob = z.infer<typeof AlertJobSchema>;

/* ---------- Normalising ---------- */

const MAX_CRITERIA = 40;
const MAX_FIELD = 300;

// "YYYY-MM-DD" for a real calendar date, otherwise null.
export function toIsoDate(value: string): string | null {
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

// Only http(s) links are kept, so a bad value can never become a javascript: link.
export function toHttpUrl(value: string): string {
  const s = value.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

const field = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD);

function criteriaList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const c = raw.replace(/^[\s\-•*·]+/, "").replace(/\s+/g, " ").trim().slice(0, 500);
    const key = c.toLowerCase();
    if (c && !seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out.slice(0, MAX_CRITERIA);
}

export function normaliseAdvert(a: AdvertReply) {
  return {
    title: field(a.title),
    employer: field(a.employer),
    band: field(a.band),
    salary: field(a.salary),
    location: field(a.location),
    reference: field(a.reference),
    closingDate: toIsoDate(a.closingDate),
    link: toHttpUrl(a.link),
    sponsorship: a.sponsorship,
    essential: criteriaList(a.essential),
    desirable: criteriaList(a.desirable),
  };
}
export type NormalisedAdvert = ReturnType<typeof normaliseAdvert>;

export function normaliseAlertJob(j: AlertJob) {
  return {
    title: field(j.title),
    employer: field(j.employer),
    band: field(j.band),
    salary: field(j.salary),
    location: field(j.location),
    closingDate: toIsoDate(j.closingDate),
    link: toHttpUrl(j.link),
  };
}
export type FoundJob = ReturnType<typeof normaliseAlertJob>;
