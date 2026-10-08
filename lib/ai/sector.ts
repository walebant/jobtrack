import type { AssessedAt, Assessment, Sector } from "@/lib/db/schema";

export const SECTOR_LABEL: Record<Sector, string> = {
  nhs: "NHS",
  council: "Local council",
  other: "Other public sector",
};

// Added to scoring and writing prompts so each job is judged and written for in
// its own sector's terms. Kept stable per sector so prompt caching still works.
export const SECTOR_CONTEXT: Record<Sector, string> = {
  nhs: `Sector: NHS. The employer is an NHS organisation. Pay is on Agenda for Change bands. Panels look for the NHS values (the NHS Constitution and the trust's own values), patient and service user focus, and, for data or records work, information governance, confidentiality, the Data Security and Protection Toolkit and Caldicott principles.`,
  council: `Sector: UK local government. The employer is a council (local authority). Pay is on the council's own grades or pay scales (for example Grade 7, SO1, PO3 or NJC scale points), never Agenda for Change bands. Panels look for the council's own values and behaviours or competency framework, a focus on residents, communities and council services, working with councillors, partners and the public, and value for public money. For data or records work this means UK GDPR, the Data Protection Act 2018 and Freedom of Information. Do not use NHS terms, NHS values or patient language unless the role itself involves health or care services.`,
  other: `Sector: UK public or not-for-profit sector (for example the civil service, a university, a housing association or a charity). Use the organisation's own values and language from the advert. If it is the civil service, panels assess the Success Profiles behaviours. Do not assume NHS or council terms unless the advert uses them.`,
};

// A best guess from the employer's name, used when nothing else says.
export function guessSector(employer: string, fallback: Sector = "other"): Sector {
  if (/\bNHS\b|\btrust\b|integrated care|\bICB\b|hospital|ambulance service/i.test(employer)) return "nhs";
  if (/council|borough|county|district|metropolitan|city of|combined authority|local authority/i.test(employer)) return "council";
  return fallback;
}

const LETTER: Record<AssessedAt, string> = { application: "A", interview: "I", test: "T" };
export const ASSESSED_LABEL: Record<AssessedAt, string> = { application: "Application", interview: "Interview", test: "Test" };

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The assessment markers for a criterion (matched loosely, as the model may reword slightly).
export function assessedFor(text: string, assessment: Assessment): AssessedAt[] {
  if (assessment[text]) return assessment[text];
  const k = key(text);
  for (const [criterion, at] of Object.entries(assessment)) if (key(criterion) === k) return at;
  return [];
}

// True unless the person specification says the criterion is only assessed
// later (at interview or by a test). Unmarked criteria count as application.
export function judgedAtApplication(text: string, assessment: Assessment): boolean {
  const at = assessedFor(text, assessment);
  return at.length === 0 || at.includes("application");
}

export function assessedLetters(at: AssessedAt[]): string {
  return at.map((a) => LETTER[a]).join("/");
}
