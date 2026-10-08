import { z } from "zod";
import { toHttpUrl, toIsoDate } from "@/lib/ai/schemas";
import { todayUk } from "@/lib/dates";
import { BANDS, STAFF_GROUPS, type Band, type StaffGroup } from "@/lib/nhsjobs/constants";

// Checks for everything the browser sends to a server action.

const text = (max: number) => z.string().trim().max(max);

export const NotesInput = z.object({
  notes: text(10_000),
});

export const CvInput = z.object({
  name: text(80).min(1, "Give the CV a name."),
  focus: text(500),
  cvText: text(100_000),
});

export const EvidenceInput = z.object({
  id: z.uuid().optional(),
  title: text(200).min(1, "Add a title."),
  tags: text(500).transform(splitTags),
  story: text(10_000).min(1, "Add the example."),
});

export function splitTags(s: string): string[] {
  const seen = new Set<string>();
  return s
    .split(",")
    .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 20);
}

const optionalDate = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (!s) return null;
    const d = toIsoDate(s);
    if (!d) ctx.addIssue({ code: "custom", message: "Enter a valid date." });
    return d;
  });

const optionalLink = z
  .string()
  .trim()
  .max(2000)
  .transform((s, ctx) => {
    if (!s) return "";
    const url = toHttpUrl(s);
    if (!url) ctx.addIssue({ code: "custom", message: "Enter a full link starting with https://" });
    return url;
  });

export const ManualJobInput = z.object({
  title: text(300).min(1, "Add the job title."),
  employer: text(300),
  band: text(100),
  closingDate: optionalDate,
  link: optionalLink,
});

// Job details edited on the Overview tab.
export const OverviewInput = z.object({
  title: text(300).min(1, "Add the job title."),
  employer: text(300),
  band: text(100),
  salary: text(300),
  location: text(300),
  reference: text(100),
  closingDate: optionalDate,
  interviewDate: optionalDate,
  // The day the application was sent (YYYY-MM-DD), never in the future.
  appliedDate: optionalDate.refine((d) => d === null || d <= todayUk(), "The date applied cannot be in the future."),
  interviewTime: z
    .string()
    .trim()
    .refine((s) => s === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(s), "Enter the interview time as HH:MM."),
  link: optionalLink,
  sponsorship: z.enum(["yes", "no", "unknown"]),
  sector: z.enum(["nhs", "council", "other"]),
  contacts: text(2_000),
  notes: text(10_000),
});

// Application form questions answered separately (Writing tab).
export const AppQuestionsInput = z
  .array(
    z.object({
      question: text(1_000).min(1, "A question cannot be empty. Remove it instead."),
      limit: z
        .number()
        .int()
        .min(20, "Limits must be at least 20.")
        .max(20_000, "Limits must be 20,000 or less.")
        .nullable(),
      unit: z.enum(["words", "characters"]),
    }),
  )
  .max(15, "Add up to 15 questions.");

// Writing tab: why this role and employer, and the supporting statement's limit.
export const WritingInputs = z.object({
  whyNotes: text(3_000),
  writeLimit: z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (!s) return null;
      const n = Number(s.replace(/,/g, ""));
      if (!Number.isInteger(n) || n < 50 || n > 20_000) {
        ctx.addIssue({ code: "custom", message: "Enter a limit between 50 and 20,000, or leave it blank." });
        return null;
      }
      return n;
    }),
  writeLimitUnit: z.enum(["words", "characters"]),
});

export const AdvertInput = z.object({
  advert: z.string().trim().min(80, "Paste the full advert text first."),
  link: optionalLink,
});

export const AlertInput = z.object({
  email: z.string().trim().min(40, "Paste the alert email first."),
});

// Jobs ticked in the alert email list, sent back from the browser to be saved.
export const FoundJobsInput = z
  .array(
    z.object({
      title: text(300).min(1),
      employer: text(300),
      band: text(300),
      salary: text(300),
      location: text(300),
      closingDate: z.string().nullable().transform((s) => (s ? toIsoDate(s) : null)),
      link: z.string().max(2000).transform(toHttpUrl),
    }),
  )
  .min(1, "Tick at least one job.")
  .max(50);

export const DISTANCES = [5, 10, 15, 20, 30, 50] as const;

export const SearchInput = z.object({
  keywords: text(200),
  location: text(100),
  distance: z.coerce
    .number()
    .refine((n) => (DISTANCES as readonly number[]).includes(n), "Pick a distance from the list."),
  staffGroups: z.array(z.enum(Object.keys(STAFF_GROUPS) as [StaffGroup, ...StaffGroup[]])).max(10),
  bands: z.array(z.enum(Object.keys(BANDS) as [Band, ...Band[]])).max(15),
  maxNew: z.coerce.number().int().min(1).max(30),
});

// First error message from a failed parse, for showing under a form.
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

// FormData to a plain object of strings.
export function formFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string") out[k] = v;
  return out;
}
