// Calls the real Anthropic API (costs a few pence per run). Run on purpose with
// `npm run test:ai`; skipped when ANTHROPIC_API_KEY is not set.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAdvert, readAlertEmail, scoreFit } from "@/lib/ai/client";

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
