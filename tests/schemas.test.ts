import { describe, expect, it } from "vitest";
import {
  AdvertSchema,
  AlertSchema,
  normaliseAdvert,
  normaliseAlertJob,
  toHttpUrl,
  toIsoDate,
  type AdvertReply,
} from "@/lib/ai/schemas";

const advert: AdvertReply = {
  title: "  Data   Analyst ",
  employer: "Leeds Teaching Hospitals NHS Trust",
  band: "Band 5",
  salary: "£31,049 to £37,796 a year",
  location: "Leeds",
  reference: "C9123-25-0456",
  closingDate: "2026-10-20",
  link: "https://www.jobs.nhs.uk/candidate/jobadvert/C9123-25-0456",
  sector: "nhs",
  sponsorship: "unknown",
  essential: [
    { text: "- Degree or equivalent experience", assessedAt: ["application"] },
    { text: "SQL", assessedAt: ["application", "interview", "interview"] },
    { text: "sql", assessedAt: [] },
    { text: "  ", assessedAt: [] },
  ],
  desirable: [{ text: "• Power BI", assessedAt: [] }],
  applicationQuestions: [],
};

describe("assessment markers and application questions", () => {
  it("collects how each criterion is assessed, without duplicates", () => {
    const n = normaliseAdvert(advert);
    expect(n.assessment).toEqual({
      "Degree or equivalent experience": ["application"],
      SQL: ["application", "interview"],
    });
    expect(n.sector).toBe("nhs");
  });

  it("keeps application questions with sensible limits", () => {
    const n = normaliseAdvert({
      ...advert,
      applicationQuestions: [
        { question: "  Describe a time you improved a service. ", limit: 250, unit: "words" },
        { question: "Why this council?", limit: 0, unit: "words" },
        { question: "  ", limit: 100, unit: "words" },
      ],
    });
    expect(n.appQuestions).toEqual([
      { question: "Describe a time you improved a service.", limit: 250, unit: "words" },
      { question: "Why this council?", limit: null, unit: "words" },
    ]);
  });
});

describe("AdvertSchema", () => {
  it("accepts a full reply", () => {
    expect(AdvertSchema.safeParse(advert).success).toBe(true);
  });

  it("rejects a reply with a missing field or a bad sponsorship value", () => {
    const missing: Partial<AdvertReply> = { ...advert };
    delete missing.essential;
    expect(AdvertSchema.safeParse(missing).success).toBe(false);
    expect(AdvertSchema.safeParse({ ...advert, sponsorship: "maybe" }).success).toBe(false);
  });
});

describe("AlertSchema", () => {
  it("accepts a list of jobs and an empty list", () => {
    const job = { title: "A", employer: "B", band: "", salary: "", location: "", closingDate: "", link: "" };
    expect(AlertSchema.safeParse({ jobs: [job] }).success).toBe(true);
    expect(AlertSchema.safeParse({ jobs: [] }).success).toBe(true);
    expect(AlertSchema.safeParse([job]).success).toBe(false);
  });
});

describe("normaliseAdvert", () => {
  it("tidies fields and criteria", () => {
    const n = normaliseAdvert(advert);
    expect(n.title).toBe("Data Analyst");
    expect(n.closingDate).toBe("2026-10-20");
    expect(n.essential).toEqual(["Degree or equivalent experience", "SQL"]);
    expect(n.desirable).toEqual(["Power BI"]);
  });

  it("drops bad dates and links", () => {
    const n = normaliseAdvert({ ...advert, closingDate: "20 October", link: "javascript:alert(1)" });
    expect(n.closingDate).toBeNull();
    expect(n.link).toBe("");
  });
});

describe("normaliseAlertJob", () => {
  it("keeps valid values and blanks invalid ones", () => {
    const j = normaliseAlertJob({
      title: "Systems Officer",
      employer: "Trust B",
      band: "Band 4",
      salary: "",
      location: "York",
      closingDate: "2026-02-30",
      link: "www.example.com",
    });
    expect(j).toMatchObject({ title: "Systems Officer", closingDate: null, link: "" });
  });
});

describe("toIsoDate and toHttpUrl", () => {
  it("accepts only real dates", () => {
    expect(toIsoDate("2028-02-29")).toBe("2028-02-29");
    expect(toIsoDate("2026-02-29")).toBeNull();
    expect(toIsoDate("")).toBeNull();
  });

  it("accepts only http and https links", () => {
    expect(toHttpUrl("https://www.jobs.nhs.uk/x")).toBe("https://www.jobs.nhs.uk/x");
    expect(toHttpUrl("http://trac.jobs/y")).toBe("http://trac.jobs/y");
    expect(toHttpUrl("ftp://x")).toBe("");
    expect(toHttpUrl("not a url")).toBe("");
  });
});
