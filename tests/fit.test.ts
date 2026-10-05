import { describe, expect, it } from "vitest";
import { FitSchema, normaliseFit, type FitReply } from "@/lib/ai/schemas";
import { parseSort, sortJobs } from "@/lib/jobs/sort";

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

  it("defaults to fit for unknown values", () => {
    expect(parseSort("closing")).toBe("closing");
    expect(parseSort("drop table")).toBe("fit");
    expect(parseSort(undefined)).toBe("fit");
  });
});
