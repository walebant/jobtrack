import { z } from "zod";
import { judgedAtApplication } from "./sector";
import type { AppQuestion, Assessment, AssessedAt } from "@/lib/db/schema";

// Shapes the model must return (sent as structured outputs, so replies always parse).
// Kept to plain strings and enums; the normalise* helpers below tidy the values.

const CriterionSchema = z.object({
  text: z.string().describe("One short, specific criterion, keeping its meaning exactly"),
  assessedAt: z
    .array(z.enum(["application", "interview", "test"]))
    .describe('How the person specification says it is assessed (often marked A, I or T). Empty if not stated.'),
});

export const AdvertSchema = z.object({
  title: z.string().describe("Job title as written in the advert"),
  employer: z.string().describe("Employing organisation, e.g. the NHS trust or council"),
  sector: z
    .enum(["nhs", "council", "other"])
    .describe('"nhs" for NHS organisations, "council" for local authorities, "other" for any other employer'),
  band: z.string().describe('Pay band or grade, e.g. "Band 5", or a council grade; "" if not stated'),
  salary: z.string().describe('Salary or range as written; "" if not stated'),
  location: z.string().describe('Main work location; "" if not stated'),
  reference: z.string().describe('Job reference number; "" if not stated'),
  closingDate: z.string().describe('Closing date as YYYY-MM-DD; "" if not stated'),
  link: z.string().describe('Link to the advert if it appears in the text; otherwise ""'),
  sponsorship: z
    .enum(["yes", "no", "unknown"])
    .describe('"yes" only if visa sponsorship is said to be possible, "no" if it is ruled out, otherwise "unknown"'),
  essential: z.array(CriterionSchema).describe("Essential person specification criteria"),
  desirable: z.array(CriterionSchema).describe("Desirable person specification criteria"),
  applicationQuestions: z
    .array(
      z.object({
        question: z.string().describe("The question exactly as written"),
        limit: z.number().int().describe("Its word or character limit, or 0 if none is given"),
        unit: z.enum(["words", "characters"]),
      }),
    )
    .describe("Questions the application form asks the candidate to answer separately, if the text lists them; otherwise empty"),
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

export const FitCriterionSchema = z.object({
  text: z.string().describe("The criterion, as written in the person specification"),
  type: z.enum(["essential", "desirable"]),
  rating: z.enum(["met", "partial", "gap"]),
  evidence: z
    .string()
    .describe("Which of the candidate's real experience shows it, or what is missing and how to address it honestly"),
});
export const FitSchema = z.object({
  score: z.number().int().describe("Overall fit from 1 (poor) to 10 (excellent)"),
  verdict: z.enum(["apply", "maybe", "skip"]),
  summary: z.string().describe("2 to 3 plain sentences on the overall fit"),
  criteria: z.array(FitCriterionSchema).describe("Every essential and desirable criterion, in the order given"),
});
export type FitReply = z.infer<typeof FitSchema>;

/* ---------- Normalising ---------- */

// PRD scoring rule: a missing essential criterion caps the score at 6.
export const ESSENTIAL_GAP_CAP = 6;

// Gaps in criteria assessed only at interview or by a test do not cap the score:
// the panel does not judge them from the application.
export function normaliseFit(f: FitReply, assessment: Assessment = {}) {
  const criteria = f.criteria
    .map((c) => ({ ...c, text: c.text.trim().slice(0, 500), evidence: c.evidence.trim().slice(0, 1500) }))
    .filter((c) => c.text)
    .slice(0, MAX_CRITERIA * 2);
  const essentialGap = criteria.some(
    (c) => c.type === "essential" && c.rating === "gap" && judgedAtApplication(c.text, assessment),
  );
  let score = Math.min(10, Math.max(1, Math.round(f.score)));
  if (essentialGap) score = Math.min(score, ESSENTIAL_GAP_CAP);
  // Keep the verdict consistent with a capped score.
  const verdict = essentialGap && f.verdict === "apply" ? "maybe" : f.verdict;
  return { score, verdict, summary: f.summary.trim().slice(0, 1500), criteria, capped: essentialGap && score < f.score };
}
export type NormalisedFit = ReturnType<typeof normaliseFit>;

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

type RawCriterion = { text: string; assessedAt: AssessedAt[] };

// Tidies and de-duplicates criteria; collects their "assessed at" markers into `assessment`.
function criteriaList(items: RawCriterion[], assessment: Assessment): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const c = raw.text.replace(/^[\s\-•*·]+/, "").replace(/\s+/g, " ").trim().slice(0, 500);
    const key = c.toLowerCase();
    if (c && !seen.has(key)) {
      seen.add(key);
      out.push(c);
      const at = [...new Set(raw.assessedAt)];
      if (at.length) assessment[c] = at;
    }
  }
  return out.slice(0, MAX_CRITERIA);
}

const MAX_QUESTIONS = 15;

export function normaliseQuestions(items: { question: string; limit: number; unit: "words" | "characters" }[]): AppQuestion[] {
  return items
    .map((q) => ({
      question: q.question.replace(/\s+/g, " ").trim().slice(0, 1_000),
      limit: Number.isInteger(q.limit) && q.limit >= 20 && q.limit <= 20_000 ? q.limit : null,
      unit: q.unit,
    }))
    .filter((q) => q.question)
    .slice(0, MAX_QUESTIONS);
}

export function normaliseAdvert(a: AdvertReply) {
  const assessment: Assessment = {};
  const essential = criteriaList(a.essential, assessment);
  const desirable = criteriaList(a.desirable, assessment);
  return {
    title: field(a.title),
    employer: field(a.employer),
    sector: a.sector,
    band: field(a.band),
    salary: field(a.salary),
    location: field(a.location),
    reference: field(a.reference),
    closingDate: toIsoDate(a.closingDate),
    link: toHttpUrl(a.link),
    sponsorship: a.sponsorship,
    essential,
    desirable,
    assessment,
    appQuestions: normaliseQuestions(a.applicationQuestions),
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
