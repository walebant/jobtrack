import { z } from "zod";
import { toHttpUrl, toIsoDate } from "@/lib/ai/schemas";

// Checks for everything the browser sends to a server action.

const text = (max: number) => z.string().trim().max(max);

export const ProfileInput = z.object({
  cvText: text(100_000),
  notes: text(10_000),
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
