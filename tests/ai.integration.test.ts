// Calls the real Anthropic API (costs a few pence per run). Run on purpose with
// `npm run test:ai`; skipped when ANTHROPIC_API_KEY is not set.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { askWritingQuestions, readAdvert, readAlertEmail, scoreFit, streamWriting } from "@/lib/ai/client";
import { jobBlock } from "@/lib/ai/prompts";
import { countWords, limitLine, splitReview, writingUser } from "@/lib/ai/writing";

const ready = Boolean(process.env.ANTHROPIC_API_KEY);
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

describe.skipIf(!ready)("AI extraction", { timeout: 120_000 }, () => {
  it("reads an NHS advert in under 60 seconds", async () => {
    const started = Date.now();
    const { advert, model } = await readAdvert(fixture("advert-band5-analyst.txt"));
    const seconds = (Date.now() - started) / 1000;
    console.log(`advert read by ${model} in ${seconds.toFixed(1)}s`, JSON.stringify(advert, null, 2));

    expect(seconds).toBeLessThan(60);
    expect(advert.title).toMatch(/information analyst/i);
    expect(advert.employer).toMatch(/northshire/i);
    expect(advert.band).toMatch(/5/);
    expect(advert.reference).toBe("342-INF-2026-118");
    expect(advert.closingDate).toBe("2026-10-19");
    expect(advert.sponsorship).toBe("yes");
    // The person specification has 6 essential and 4 desirable criteria.
    expect(advert.essential.length).toBeGreaterThanOrEqual(5);
    expect(advert.essential.length).toBeLessThanOrEqual(7);
    expect(advert.desirable.length).toBeGreaterThanOrEqual(3);
    expect(advert.desirable.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(advert)).not.toContain("—");
  });

  it("scores a CV against every criterion in under 60 seconds", async () => {
    const { advert } = await readAdvert(fixture("advert-band5-analyst.txt"));
    const profile = {
      cvText: fixture("cv-sample.txt"),
      notes: "Targeting Band 5 analyst roles.",
      evidence: [
        {
          title: "Cut outpatient data errors by 40%",
          tags: ["data quality", "SQL"],
          story: "I ran a monthly SQL check on 12,000 outpatient records and worked with clinics to fix missing codes. Errors fell 40% in six months.",
        },
      ],
    };
    const started = Date.now();
    const { fit, model } = await scoreFit(profile, { ...advert, advertText: fixture("advert-band5-analyst.txt") });
    const seconds = (Date.now() - started) / 1000;
    console.log(`scored by ${model} in ${seconds.toFixed(1)}s`, JSON.stringify(fit, null, 2));

    expect(seconds).toBeLessThan(60);
    expect(fit.score).toBeGreaterThanOrEqual(1);
    expect(fit.score).toBeLessThanOrEqual(10);
    expect(fit.criteria.length).toBe(advert.essential.length + advert.desirable.length);
    for (const c of fit.criteria) expect(c.evidence.length).toBeGreaterThan(10);
    // The CV shows SQL, so that essential criterion should not be a gap.
    const sql = fit.criteria.find((c) => /sql/i.test(c.text));
    expect(sql?.rating).not.toBe("gap");
    // Nothing in the CV shows the Power BI certification.
    const cert = fit.criteria.find((c) => /PL-300|certification/i.test(c.text));
    expect(cert?.rating).toBe("gap");
    expect(JSON.stringify(fit)).not.toContain("—");
  });

  it("asks questions, then writes a supporting statement with a panel check", { timeout: 300_000 }, async () => {
    const { advert } = await readAdvert(fixture("advert-band5-analyst.txt"));
    const profile = { cvText: fixture("cv-sample.txt"), notes: "", evidence: [] };
    const job = { ...advert, advertText: fixture("advert-band5-analyst.txt") };

    const questions = await askWritingQuestions("statement", profile, job);
    console.log("questions:", questions);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(8);

    const user = writingUser("statement", {
      jobBlock: jobBlock(job),
      whyNotes: "Northshire is my local trust and I want to move from admin reporting into analysis.",
      limit: limitLine(700, "words"),
      answers: [],
    });
    const started = Date.now();
    const claude = streamWriting("statement", profile, user, new AbortController().signal);
    let firstAt = 0;
    claude.on("text", () => (firstAt ||= Date.now()));
    const final = await claude.finalMessage();
    const raw = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const { content, review } = splitReview(raw);
    console.log(
      `first words after ${((firstAt - started) / 1000).toFixed(1)}s, done after ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
        `${countWords(content)} words, model ${final.model}, cache read ${final.usage.cache_read_input_tokens ?? 0}`,
    );
    console.log(content);
    console.log("--- panel check ---\n" + review);

    expect(final.stop_reason).toBe("end_turn");
    expect(review).not.toBe("");
    expect(countWords(content)).toBeGreaterThan(300);
    // The limit is 700 words, counting headings and [CHECK] notes.
    expect(countWords(content)).toBeLessThanOrEqual(700);
    expect(raw).not.toContain("—");
    // Nothing from outside the CV: the only employer in the CV is Riverside Hospitals.
    expect(content).toMatch(/Riverside/);
  });

  it("lists every job in an alert email", async () => {
    const started = Date.now();
    const jobs = await readAlertEmail(fixture("alert-email.txt"));
    console.log(`alert read in ${((Date.now() - started) / 1000).toFixed(1)}s`, JSON.stringify(jobs, null, 2));

    expect(jobs).toHaveLength(3);
    expect(jobs.map((j) => j.closingDate)).toEqual(["2026-10-19", "2026-10-24", "2026-10-15"]);
    expect(jobs[1]).toMatchObject({ employer: expect.stringMatching(/eastmoor/i), band: expect.stringMatching(/6/) });
    expect(jobs[2].link).toBe("https://www.jobs.nhs.uk/candidate/jobadvert/D1102-26-0093");
  });
});
