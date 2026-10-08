import { describe, expect, it } from "vitest";
import { FitSchema, normaliseFit, type FitReply } from "@/lib/ai/schemas";
import { parseDir, parseSort, sortJobs } from "@/lib/jobs/sort";

const reply = (over: Partial<FitReply> = {}): FitReply => ({
  score: 8,
  verdict: "apply",
  summary: "Strong fit. ",
  criteria: [
    { text: "SQL", type: "essential", rating: "met", evidence: "Wrote SQL daily at Trust A." },
    { text: "Power BI", type: "desirable", rating: "gap", evidence: "No Power BI shown." },
  ],
  ...over,
});

describe("FitSchema", () => {
  it("accepts a full reply and rejects a bad rating", () => {
    expect(FitSchema.safeParse(reply()).success).toBe(true);
    const bad = reply({ criteria: [{ text: "SQL", type: "essential", rating: "strong" as "met", evidence: "" }] });
    expect(FitSchema.safeParse(bad).success).toBe(false);
  });
});

describe("normaliseFit", () => {
  it("keeps a score when every essential criterion is at least partly met", () => {
    expect(normaliseFit(reply())).toMatchObject({ score: 8, verdict: "apply", capped: false, summary: "Strong fit." });
  });

  it("caps the score at 6 when an essential criterion is a gap", () => {
    const f = normaliseFit(
      reply({ criteria: [{ text: "Degree", type: "essential", rating: "gap", evidence: "No degree shown." }] }),
    );
    expect(f).toMatchObject({ score: 6, verdict: "maybe", capped: true });
  });

  it("does not raise a low score or mark it capped", () => {
    const f = normaliseFit(
      reply({ score: 4, verdict: "skip", criteria: [{ text: "Degree", type: "essential", rating: "gap", evidence: "" }] }),
    );
    expect(f).toMatchObject({ score: 4, verdict: "skip", capped: false });
  });

  it("keeps scores between 1 and 10", () => {
    expect(normaliseFit(reply({ score: 14 })).score).toBe(10);
    expect(normaliseFit(reply({ score: 0, verdict: "skip" })).score).toBe(1);
  });

  it("drops criteria with no text", () => {
    const f = normaliseFit(reply({ criteria: [{ text: "  ", type: "essential", rating: "gap", evidence: "" }] }));
    expect(f.criteria).toHaveLength(0);
    expect(f.capped).toBe(false);
  });
});

describe("sortJobs", () => {
  const d = (s: string) => new Date(s);
  const jobs = [
    { id: "a", score: 6, closingDate: "2026-10-20", createdAt: d("2026-10-01") },
    { id: "b", score: null, closingDate: "2026-10-07", createdAt: d("2026-10-04") },
    { id: "c", score: 9, closingDate: null, createdAt: d("2026-10-02") },
    { id: "d", score: 6, closingDate: "2026-10-10", createdAt: d("2026-10-03") },
  ];
  const ids = (list: { id: string }[]) => list.map((j) => j.id).join("");

  it("ranks by fit score, unscored last, ties by closing date", () => {
    expect(ids(sortJobs(jobs, "fit"))).toBe("cdab");
  });

  it("sorts by soonest closing date, no date last", () => {
    expect(ids(sortJobs(jobs, "closing"))).toBe("bdac");
  });

  it("sorts newest first", () => {
    expect(ids(sortJobs(jobs, "newest"))).toBe("bdca");
  });

  it("reverses a column but keeps missing values last", () => {
    // Lowest fit first, unscored (b) still last.
    expect(ids(sortJobs(jobs, "fit", "reversed"))).toBe("dacb");
    // Latest closing first, no closing date (c) still last.
    expect(ids(sortJobs(jobs, "closing", "reversed"))).toBe("adbc");
    expect(ids(sortJobs(jobs, "newest", "reversed"))).toBe("acdb");
  });

  it("sorts by title and by stage", () => {
    const named = [
      { id: "x", title: "systems officer", status: "interview" as const, score: null, closingDate: null, createdAt: d("2026-10-01") },
      { id: "y", title: "Analyst 10", status: "saved" as const, score: null, closingDate: null, createdAt: d("2026-10-02") },
      { id: "z", title: "Analyst 9", status: "submitted" as const, score: null, closingDate: null, createdAt: d("2026-10-03") },
    ];
    expect(ids(sortJobs(named, "title"))).toBe("zyx");
    expect(ids(sortJobs(named, "title", "reversed"))).toBe("xyz");
    expect(ids(sortJobs(named, "stage"))).toBe("yzx");
    expect(ids(sortJobs(named, "stage", "reversed"))).toBe("xzy");
  });

  it("defaults to fit for unknown values", () => {
    expect(parseSort("closing")).toBe("closing");
    expect(parseSort("drop table")).toBe("fit");
    expect(parseSort(undefined)).toBe("fit");
    expect(parseSort("stage")).toBe("stage");
    expect(parseDir("reversed")).toBe("reversed");
    expect(parseDir("sideways")).toBe("natural");
  });
});

describe("score cap and when criteria are assessed", () => {
  const gapAt = (text: string) =>
    reply({ score: 8, verdict: "apply", criteria: [{ text, type: "essential", rating: "gap", evidence: "Not shown." }] });

  it("does not cap the score for a gap assessed only at interview or by a test", () => {
    const f = normaliseFit(gapAt("Presentation skills"), { "Presentation skills": ["interview"] });
    expect(f).toMatchObject({ score: 8, verdict: "apply", capped: false });
    const t = normaliseFit(gapAt("Excel test"), { "excel  TEST": ["test"] });
    expect(t.capped).toBe(false);
  });

  it("still caps a gap assessed at application, or with no marker", () => {
    expect(normaliseFit(gapAt("SQL"), { SQL: ["application", "interview"] }).score).toBe(6);
    expect(normaliseFit(gapAt("SQL"), {}).score).toBe(6);
  });
});
