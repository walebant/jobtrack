// Calls the real Anthropic API (costs a few pence per run). Run on purpose with
// `npm run test:ai`; skipped when ANTHROPIC_API_KEY is not set.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAdvert, readAlertEmail } from "@/lib/ai/client";

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
