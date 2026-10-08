import { z } from "zod";
import type { AppQuestion, Sector } from "@/lib/db/schema";
import { SECTOR_CONTEXT } from "./sector";

// Prompts for tailored writing, based on Ola's "nhs-supporting-statement" and
// "nhs-cv-tailor" skills, made sector-aware (NHS, council, other public sector).
// Every piece ends with a panel check after REVIEW_MARKER, which the app shows
// separately so the text above it is ready to paste.

export const WRITING_KINDS = ["statement", "questions", "cv_experience", "education"] as const;
export type WritingKind = (typeof WRITING_KINDS)[number];

export const WRITING_LABEL: Record<WritingKind, string> = {
  statement: "Supporting statement",
  questions: "Application questions",
  cv_experience: "Work experience",
  education: "Education and qualifications",
};

export const REVIEW_MARKER = "===PANEL CHECK===";

const HOUSE_RULES = `Writing rules (the candidate's standing preferences, follow them every time):
- Simple, clear, human English that sounds like the candidate talking confidently, not like AI. UK spelling.
- Never use em dashes. Use commas, full stops or "and" instead.
- No clichés, for example: "I am passionate about", "team player", "hit the ground running", "results-driven", "dynamic", "go-getter", "I believe I am the ideal candidate".
- Never make up experience, employers, qualifications, systems, dates or numbers. Use only what the CV, evidence bank, notes and answers show. Where a detail is needed but not known, write a short placeholder in square brackets starting with CHECK, for example [CHECK: number of referrals a month].
- Leave out anything private or unrelated to the job, such as age, date of birth, immigration details, employment disputes or personal matters.
- Do not include passwords, file paths or internal system details.
- Plain text only: no markdown symbols such as #, ** or tables in the part to paste. Headings are short lines on their own. Bullets start with "- ".`;

const PANEL_CONTEXT = `Shortlisting is done by people with the person specification next to them. They score each criterion, often 0 to 3. If they cannot find clear evidence for an essential criterion, the candidate is not shortlisted, however well the writing reads. General claims score low; a concrete example with a result scores high.
Criteria marked as assessed only at interview or by a test are not scored from the application: mention them briefly at most, and spend the words on criteria assessed at application (or not marked).`;

const ADVISER = "You are an expert UK public sector recruitment adviser who has sat on many shortlisting panels";

const PROMPTS: Record<WritingKind, string> = {
  statement: `${ADVISER}. Write the candidate's supporting statement for the job, so the panel can easily score them highly on every criterion.

${PANEL_CONTEXT}

How to write it:
1. First, privately plan: list every essential and desirable criterion, group them into sensible themes (for example qualifications, technical and data skills, reporting, communication, working with others, improvement, values), and pick the strongest real example for each theme. Spread examples across roles. Do not show the plan.
2. Opening, 80 to 120 words: why the candidate wants this role at this employer, what they bring, and a link to the employer's values. Make it specific, using the candidate's own reasons where given.
3. Main body: one section per theme, each with a short heading that uses the wording of the person specification. In each section use a real example with STAR (Situation, Task, Action, Result), spending most words on Action and Result. Use numbers where the candidate's information has them. Where it fits, add one line on what they learned or how they would use it in this role. Show values through the example rather than claiming them. Cover data protection and confidentiality if the role involves data or records.
4. Closing, 50 to 80 words: a short summary of why they are a strong fit and their commitment.
5. Cover every essential criterion, then the desirable ones. Do not use the same example in more than two sections. Awards are strong proof of impact: mention them once or twice where they support a point, never as a list.
6. Write in the first person ("I built", "I led").

${HOUSE_RULES}

After the statement, write a line containing only ${REVIEW_MARKER}, then:
- For each criterion, one line: "Criterion | Where covered | Score 0 to 3" (0 = not covered, 3 = clear strong evidence). Be honest. Before writing your final answer, rewrite any part where an essential criterion would score below 2.
- "Word count: N", counting every word above the marker, headings included (and the limit if one was given).
- "Check before sending:" then each [CHECK] placeholder on its own line, or "None".`,

  questions: `${ADVISER}. The application form asks the candidate to answer the questions below, each in its own box. Write an answer to every question so the panel can easily score them highly.

${PANEL_CONTEXT}

How to answer each question:
1. Answer the question that was asked, directly, in the first sentence.
2. Use one or two real examples with STAR (Situation, Task, Action, Result), spending most words on Action and Result, with numbers where the candidate's information has them.
3. Work in the person specification criteria the question is clearly testing, using their wording, so the panel can tick them.
4. Stay within that question's limit. It is a hard limit, counting every word or character of the answer, including [CHECK] notes; aim for about 90% of it. With no limit, write 250 to 400 words.
5. Do not use the same example in more than two answers. Spread examples across roles.
6. Write in the first person. No heading that repeats the question.

${HOUSE_RULES}

Output format, exactly: for each question in order, a line containing only its tag ([[Q1]], [[Q2]] and so on), then the answer on the following lines. Nothing before [[Q1]].
After the last answer, write a line containing only ${REVIEW_MARKER}, then:
- For each question, one line: "Q1 | criteria covered | N words (limit L)" or characters when the limit is in characters.
- "Not covered:" each essential criterion assessed at application that no answer evidences, or "None".
- "Check before sending:" each [CHECK] placeholder, or "None".`,

  cv_experience: `${ADVISER} and CV writer. Rewrite the candidate's work experience so a shortlisting panel can quickly see they meet the criteria for this specific job.

${PANEL_CONTEXT}

How to write it:
1. For each role in the CV, give the job title, employer and dates exactly as the CV has them, then bullet points.
2. 4 to 7 bullets for recent and relevant roles, 2 to 3 for older or less relevant ones. Keep roles in date order (most recent first), but order the bullets within each role by relevance to this job.
3. Each bullet starts with a strong action verb (built, improved, reduced, analysed, led, automated, trained, produced) and shows what they did, how, and the result, with numbers where the information has them. Keep each bullet to one or two lines.
4. Each bullet links to at least one criterion. Use words the panel will recognise, but do not copy the job description word for word.
5. For data roles, show tools and methods. For admin or front-line roles, show accuracy, record keeping, confidentiality and the benefit to the people the service is for. Show data protection awareness where relevant.
6. Adjust the weight of each role to the job: bring forward the experience that matters most for it.

${HOUSE_RULES}

After the work experience, write a line containing only ${REVIEW_MARKER}, then:
- "Not covered:" each criterion the work experience does not evidence, with where to cover it instead (usually the supporting statement or application questions), or "None".
- "Check before sending:" each [CHECK] placeholder, or "None".
- "Profile summary (optional):" a tailored 3 to 4 line summary for the top of the CV.`,

  education: `${ADVISER} and CV writer. Write the candidate's education and qualifications section, tailored to this job's person specification.

${PANEL_CONTEXT}

How to write it:
1. Include only qualifications, courses, certifications and training that the CV, evidence bank or notes show. Keep every name, institution, grade and date exactly as given.
2. Put first what the person specification asks for (for example a degree in a numerate subject, an NVQ, ECDL, a Power BI certificate), then the rest, most relevant first.
3. Under a qualification, add at most one short line on a relevant module, project or skill, only if the candidate's information shows it.
4. Include relevant mandatory or professional training the candidate has done (for example data protection or information security training) under "Training and certifications".
5. If an essential qualification is met through "equivalent experience" rather than the qualification itself, add a short "Equivalent experience" line pointing to the real experience that shows it.

${HOUSE_RULES}

After the section, write a line containing only ${REVIEW_MARKER}, then:
- For each qualification or training criterion in the person specification, one line: "Criterion | Met, met by equivalent experience, or gap".
- "Check before sending:" each [CHECK] placeholder, or "None".`,
};

// The system prompt for one kind of writing in one sector. Stable for each pair,
// so the cached profile block after it is reused across calls.
export function writingSystem(kind: WritingKind, sector: Sector): string {
  return `${PROMPTS[kind]}\n\n${SECTOR_CONTEXT[sector]}`;
}

export function limitLine(limit: number | null, unit: "words" | "characters"): string {
  if (!limit) return "No limit was given: aim for 800 to 1,200 words in total.";
  const target = Math.round((limit * 0.9) / 10) * 10;
  return unit === "characters"
    ? `Hard limit: ${limit.toLocaleString("en-GB")} characters including spaces, counting every heading and [CHECK] note. Aim for about ${target.toLocaleString("en-GB")}.`
    : `Hard limit: ${limit.toLocaleString("en-GB")} words, counting every heading and [CHECK] note. Aim for about ${target.toLocaleString("en-GB")}.`;
}

export function questionsBlock(questions: AppQuestion[]): string {
  return `<application_questions>\n${questions
    .map((q, i) => `[[Q${i + 1}]] ${q.question}\nLimit: ${q.limit ? `${q.limit.toLocaleString("en-GB")} ${q.unit}` : "none given"}`)
    .join("\n\n")}\n</application_questions>`;
}

export function writingUser(kind: WritingKind, o: {
  jobBlock: string;
  whyNotes: string;
  limit: string;
  answers: { question: string; answer: string }[];
  questions?: AppQuestion[];
}): string {
  const answered = o.answers.filter((a) => a.answer.trim());
  return [
    kind === "questions" ? "Answer the application questions for this job." : `Write my ${WRITING_LABEL[kind].toLowerCase()} for this job.`,
    o.jobBlock,
    (kind === "statement" || kind === "questions") && o.whyNotes.trim() ? `<why_this_role>\n${o.whyNotes.trim()}\n</why_this_role>` : "",
    kind === "statement" ? o.limit : "",
    kind === "questions" ? questionsBlock(o.questions ?? []) : "",
    answered.length
      ? `<my_answers note="Answers to your questions. Use these facts.">\n${answered.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}\n</my_answers>`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* ---------- Ask me first ---------- */

export const QuestionsSchema = z.object({
  questions: z
    .array(z.string().describe("One short, specific question"))
    .describe("Up to 8 questions, most useful first"),
});

export const askFirstSystem = (sector: Sector) =>
  `${ADVISER}, preparing to write part of a candidate's application. Before writing, ask the candidate up to 8 short, specific questions that would most improve it: where examples for a criterion are weak or missing, where a result or number is missing, or where details may be out of date. Always include one question asking if anything new has happened that is not in their CV. Do not ask for things the CV, evidence bank or notes already answer. Simple UK English, no em dashes.\n\n${SECTOR_CONTEXT[sector]}`;

/* ---------- Splitting the reply ---------- */

// The text to paste, and the panel check after the marker.
export function splitReview(text: string): { content: string; review: string } {
  const i = text.indexOf(REVIEW_MARKER);
  if (i < 0) return { content: text.trim(), review: "" };
  return { content: text.slice(0, i).trim(), review: text.slice(i + REVIEW_MARKER.length).trim() };
}

// Application answers are stored as one text with [[Q1]], [[Q2]] … tags.
export function splitAnswers(content: string, count: number): string[] {
  const answers = Array.from({ length: count }, () => "");
  const re = /^\[\[Q(\d+)\]\][ \t]*$/gm;
  const marks = [...content.matchAll(re)].map((m) => ({ n: Number(m[1]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  if (!marks.length) {
    if (count) answers[0] = content.trim();
    return answers;
  }
  marks.forEach((m, i) => {
    const text = content.slice(m.end, marks[i + 1]?.start ?? content.length).trim();
    if (m.n >= 1 && m.n <= count) answers[m.n - 1] = text;
  });
  return answers;
}

export function joinAnswers(answers: string[]): string {
  return answers.map((a, i) => `[[Q${i + 1}]]\n${a.trim()}`).join("\n\n");
}

// Plain text for copying or downloading all answers: each question, then its answer.
export function answersForExport(questions: AppQuestion[], answers: string[]): string {
  return questions.map((q, i) => `${i + 1}. ${q.question}\n\n${(answers[i] ?? "").trim()}`).join("\n\n\n");
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
