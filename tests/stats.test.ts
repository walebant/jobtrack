import { describe, expect, it } from "vitest";
import {
  applicationsPerWeek,
  computeStats,
  isApplied,
  normaliseBand,
  rate,
  scoreRange,
  weekStarts,
  type StatsJob,
} from "@/lib/stats";

const job = (over: Partial<StatsJob> = {}): StatsJob => ({
  status: "saved",
  submittedAt: null,
  band: "Band 5",
  cvName: "Main CV",
  score: null,
  reached: ["saved"],
  ...over,
});

// Thursday 8 October 2026, 17:00 UK time.
const now = new Date("2026-10-08T16:00:00Z");

describe("applied and reached stages", () => {
  it("counts a job as applied from its submitted date, stage or history", () => {
    expect(isApplied(job())).toBe(false);
    expect(isApplied(job({ submittedAt: new Date() }))).toBe(true);
    expect(isApplied(job({ status: "rejected" }))).toBe(true);
    expect(isApplied(job({ status: "withdrawn", reached: ["saved", "submitted", "withdrawn"] }))).toBe(true);
    expect(isApplied(job({ status: "withdrawn", reached: ["saved", "withdrawn"] }))).toBe(false);
  });

  it("counts shortlisting even after a later rejection", () => {
    const s = computeStats(
      [
        job({ status: "rejected", submittedAt: new Date(), reached: ["saved", "submitted", "shortlisted", "rejected"] }),
        job({ status: "rejected", submittedAt: new Date(), reached: ["saved", "submitted", "rejected"] }),
        job({ status: "offer", submittedAt: new Date(), reached: ["submitted", "interview", "offer"] }),
        job({ status: "saved" }),
      ],
      now,
    );
    expect(s).toMatchObject({ tracked: 4, applied: 3, shortlisted: 2, interviews: 1, offers: 1, shortlistRate: 67 });
    expect(s.funnel.map((f) => f.count)).toEqual([3, 2, 1, 1]);
    expect(s.byStage).toMatchObject({ rejected: 2, offer: 1, saved: 1, submitted: 0 });
  });
});

describe("averages and rates", () => {
  it("averages only scored jobs, to one decimal place", () => {
    const s = computeStats([job({ score: 8 }), job({ score: 7 }), job({ score: 7 }), job()], now);
    expect(s.avgScore).toBe(7.3);
    expect(s.scoredCount).toBe(3);
  });

  it("returns null rates and averages when there is nothing to measure", () => {
    const s = computeStats([], now);
    expect(s.shortlistRate).toBeNull();
    expect(s.avgScore).toBeNull();
    expect(rate(1, 3)).toBe(33);
  });
});

describe("grouping", () => {
  it("normalises bands", () => {
    expect(normaliseBand("Band 5")).toBe("Band 5");
    expect(normaliseBand(" band 8A ")).toBe("Band 8a");
    expect(normaliseBand("Grade 6")).toBe("Grade 6");
    expect(normaliseBand("")).toBe("No band");
  });

  it("groups fit scores into ranges", () => {
    expect([10, 8, 7, 6, 5, 1, null].map((s) => scoreRange(s))).toEqual([
      "8 to 10",
      "8 to 10",
      "6 to 7",
      "6 to 7",
      "1 to 5",
      "1 to 5",
      "Not scored",
    ]);
  });

  it("works out the shortlist rate by band for applied jobs only", () => {
    const applied = (band: string, shortlisted: boolean) =>
      job({ band, submittedAt: new Date(), status: shortlisted ? "shortlisted" : "submitted" });
    const s = computeStats([applied("Band 5", true), applied("band 5", false), applied("Band 6", true), job({ band: "Band 7" })], now);
    expect(s.byBand).toEqual([
      { label: "Band 5", applied: 2, shortlisted: 1, rate: 50 },
      { label: "Band 6", applied: 1, shortlisted: 1, rate: 100 },
    ]);
  });

  it("keeps fit score ranges in a fixed order", () => {
    const s = computeStats(
      [job({ score: 4, status: "submitted" }), job({ score: 9, status: "submitted" }), job({ status: "submitted" })],
      now,
    );
    expect(s.byScore.map((r) => r.label)).toEqual(["8 to 10", "1 to 5", "Not scored"]);
  });
});

describe("applications per week", () => {
  it("lists 8 Monday-start weeks ending this week", () => {
    const starts = weekStarts(now, 8);
    expect(starts).toHaveLength(8);
    expect(starts[7]).toBe("2026-10-05");
    expect(starts[0]).toBe("2026-08-17");
  });

  it("counts each application in its UK week", () => {
    const weeks = applicationsPerWeek(
      [
        job({ submittedAt: new Date("2026-10-05T08:00:00Z") }), // Mon this week
        job({ submittedAt: new Date("2026-10-04T23:30:00Z") }), // Mon 00:30 UK time, this week
        job({ submittedAt: new Date("2026-10-04T12:00:00Z") }), // Sun, last week
        job({ submittedAt: new Date("2026-06-01T12:00:00Z") }), // too old
      ],
      now,
    );
    expect(weeks[7]).toEqual({ weekStart: "2026-10-05", count: 2 });
    expect(weeks[6]).toEqual({ weekStart: "2026-09-28", count: 1 });
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(3);
  });
});
