import type { Assessment, Sector } from "@/lib/db/schema";
import { SECTOR_CONTEXT, SECTOR_LABEL, assessedFor } from "./sector";

// Every prompt lives here (PRD rule). Ported from reference/job-tracker.html.
// The stable instructions go in the system prompt; the pasted text and the
// date go in the user message, so the system prompt can be cached.

// Added to every prompt that writes text for the user (milestone 4 onwards).
export const WRITING_RULES = `Write in simple, clear, natural UK English that sounds like a real person.
Never use em dashes. Use commas, full stops or "and" instead.
Avoid buzzwords and over-the-top language. Use first person.
Never invent experience, employers, dates, numbers, tools or qualifications that are not in the profile. If something is missing, use the closest honest transferable experience.`;

export const READ_ADVERT_SYSTEM = `You read UK public sector job adverts (NHS Jobs, Trac, councils and other public bodies) and pull out the details a job seeker needs to track the job and write their application.

Rules:
- essential and desirable are the person specification criteria. Keep each one short and specific, and keep its meaning exactly. Keep the order they appear in the advert.
- If the advert does not split criteria into essential and desirable, put the clearly required ones in essential and the rest in desirable.
- If there is no person specification at all, return empty lists rather than guessing from the duties.
- assessedAt: person specifications often say how each criterion is assessed, for example a column marked A (application form), I (interview) and T (test), or "Assessed by: Application/Interview". Record exactly what it says for each criterion; leave it empty when it does not say.
- sector: "nhs" for NHS trusts and other NHS bodies, "council" for local authorities (borough, county, district, city or unitary councils), "other" for anyone else.
- band is the Agenda for Change band (for example "Band 5") or the council grade or pay scale (for example "Grade 7", "SO1", "PO3").
- applicationQuestions: only if the text lists questions the candidate must answer separately on the application form (common for councils), give each one exactly, with its word or character limit (0 if none). Do not turn the person specification into questions.
- closingDate is YYYY-MM-DD. Work out the year from today's date if the advert leaves it out.
- sponsorship is "yes" only if the advert says sponsorship is possible, "no" if it says it is not, otherwise "unknown".
- Use "" for any text field the advert does not give. Never invent details.
- Use UK spelling. Never use em dashes.`;

export function readAdvertUser(advert: string, today: string) {
  return `Today is ${today}.\n\n<advert>\n${advert}\n</advert>`;
}

export const scoreFitSystem = (sector: Sector) => `You are a UK public sector recruitment shortlisting panel. Score how well the candidate fits the job, criterion by criterion, using only what the candidate's CV, evidence bank and notes actually show. Be honest and strict, as a real shortlisting panel would be: give credit only for what is clearly shown.

${SECTOR_CONTEXT[sector]}

Rules:
- Include every essential and desirable criterion, in the order given, with its text unchanged.
- rating: "met" when the candidate clearly shows it, "partial" when they show related or transferable experience, "gap" when nothing they have shows it.
- evidence: name the specific experience that shows it, or say what is missing and how they could honestly address it.
- A missing essential criterion caps the score at 6. Applicants who miss an essential criterion are rarely shortlisted.
- Some criteria are marked as assessed only at interview or by a test. Rate them on what the CV shows, but do not let them pull the score down: the panel does not judge them from the application. Say in their evidence that they are assessed later.
- verdict: "apply" if they are likely to be shortlisted, "maybe" if it could go either way, "skip" if they are unlikely to be.
- summary: 2 to 3 plain sentences on the overall fit and the biggest risk.
- Never invent experience the candidate does not have.
- Write in simple, plain UK English, speaking about the candidate as "you". Never use em dashes.`;

// The candidate's profile, sent as its own cached block because it repeats across calls.
export function profileBlock(p: { cvText: string; notes: string; evidence: { title: string; tags: string[]; story: string }[] }) {
  let s = `<candidate_cv>\n${p.cvText.slice(0, 20_000)}\n</candidate_cv>`;
  if (p.evidence.length) {
    const items = p.evidence
      .map((e, i) => `${i + 1}. ${e.title}${e.tags.length ? ` [${e.tags.join(", ")}]` : ""}\n${e.story}`)
      .join("\n\n");
    s += `\n\n<evidence_bank note="Real examples. Use only these facts.">\n${items.slice(0, 20_000)}\n</evidence_bank>`;
  }
  if (p.notes.trim()) s += `\n\n<candidate_notes>\n${p.notes.slice(0, 4_000)}\n</candidate_notes>`;
  return s;
}

export function jobBlock(j: {
  title: string;
  employer: string;
  band: string;
  salary: string;
  location: string;
  essential: string[];
  desirable: string[];
  advertText: string;
  sector?: Sector;
  // How each criterion is assessed (application / interview / test), if stated.
  assessment?: Assessment;
  // Uploaded job descriptions and person specifications.
  documents?: { name: string; text: string }[];
}) {
  const marker = (x: string) => {
    const at = j.assessment ? assessedFor(x, j.assessment) : [];
    return at.length ? ` [assessed at: ${at.join(", ")}]` : "";
  };
  const list = (items: string[]) => (items.length ? items.map((x) => `- ${x}${marker(x)}`).join("\n") : "(none listed)");
  let budget = 30_000;
  const docs = (j.documents ?? [])
    .filter((d) => d.text.trim())
    .map((d) => {
      const text = d.text.slice(0, Math.max(0, budget));
      budget -= text.length;
      return text ? `\n\n<job_document name="${d.name.replace(/"/g, "'")}">\n${text}\n</job_document>` : "";
    })
    .join("");
  return `<job>
Title: ${j.title}
Employer: ${j.employer}${j.sector ? `\nSector: ${SECTOR_LABEL[j.sector]}` : ""}
Band or grade: ${j.band}
Salary: ${j.salary}
Location: ${j.location}

Essential criteria:
${list(j.essential)}

Desirable criteria:
${list(j.desirable)}

Full advert:
${j.advertText.slice(0, 25_000) || "(not provided)"}${docs}
</job>`;
}

export const READ_ALERT_SYSTEM = `You read job alert emails (for example from NHS Jobs, Trac or a council job site) and list every job in them.

Rules:
- One entry per job, in the order they appear.
- closingDate is YYYY-MM-DD. Work out the year from today's date if the email leaves it out.
- link is the link to that specific job if the email shows one.
- Use "" for anything the email does not show. Never invent details.
- If the text has no jobs in it, return an empty list.`;

export function readAlertUser(email: string, today: string) {
  return `Today is ${today}.\n\n<email>\n${email}\n</email>`;
}
