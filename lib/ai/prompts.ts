// Every prompt lives here (PRD rule). Ported from reference/job-tracker.html.
// The stable instructions go in the system prompt; the pasted text and the
// date go in the user message, so the system prompt can be cached.

// Added to every prompt that writes text for the user (milestone 4 onwards).
export const WRITING_RULES = `Write in simple, clear, natural UK English that sounds like a real person.
Never use em dashes. Use commas, full stops or "and" instead.
Avoid buzzwords and over-the-top language. Use first person.
Never invent experience, employers, dates, numbers, tools or qualifications that are not in the profile. If something is missing, use the closest honest transferable experience.`;

export const READ_ADVERT_SYSTEM = `You read UK public sector job adverts (NHS Jobs, Trac, councils) and pull out the details a job seeker needs to track the job and write their application.

Rules:
- essential and desirable are the person specification criteria. Keep each one short and specific, and keep its meaning exactly. Keep the order they appear in the advert.
- If the advert does not split criteria into essential and desirable, put the clearly required ones in essential and the rest in desirable.
- If there is no person specification at all, return empty lists rather than guessing from the duties.
- band is the Agenda for Change band (for example "Band 5") or the council grade.
- closingDate is YYYY-MM-DD. Work out the year from today's date if the advert leaves it out.
- sponsorship is "yes" only if the advert says sponsorship is possible, "no" if it says it is not, otherwise "unknown".
- Use "" for any text field the advert does not give. Never invent details.
- Use UK spelling. Never use em dashes.`;

export function readAdvertUser(advert: string, today: string) {
  return `Today is ${today}.\n\n<advert>\n${advert}\n</advert>`;
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
