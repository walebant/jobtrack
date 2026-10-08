import { describe, expect, it } from "vitest";
import { countByGroup, inStageGroup, interviewInfo, isJobStatus, parseStageGroup } from "@/lib/jobs/status";

describe("stage groups", () => {
  it("puts each stage in the right group", () => {
    expect(inStageGroup("saved", "active")).toBe(true);
    expect(inStageGroup("applying", "active")).toBe(true);
    expect(inStageGroup("submitted", "applied")).toBe(true);
    expect(inStageGroup("interview", "applied")).toBe(true);
    expect(inStageGroup("offer", "offers")).toBe(true);
    expect(inStageGroup("rejected", "closed")).toBe(true);
    expect(inStageGroup("withdrawn", "closed")).toBe(true);
    expect(inStageGroup("offer", "applied")).toBe(false);
    expect(inStageGroup("rejected", "all")).toBe(true);
  });

  it("counts jobs per group", () => {
    expect(countByGroup(["saved", "saved", "submitted", "interview", "offer", "rejected"])).toEqual({
      all: 6,
      active: 2,
      applied: 2,
      offers: 1,
      closed: 1,
    });
  });

  it("only accepts known values", () => {
    expect(parseStageGroup("applied")).toBe("applied");
    expect(parseStageGroup("nope")).toBe("all");
    expect(isJobStatus("shortlisted")).toBe(true);
    expect(isJobStatus("hired")).toBe(false);
  });
});

describe("interviewInfo", () => {
  const today = "2026-10-08";

  it("labels upcoming interviews and flags the next 7 days", () => {
    expect(interviewInfo("2026-10-08", "10:30", today)).toEqual({ label: "Interview today, 10:30", soon: true, past: false });
    expect(interviewInfo("2026-10-09", "", today)).toEqual({ label: "Interview tomorrow", soon: true, past: false });
    expect(interviewInfo("2026-10-15", "14:00", today)).toEqual({ label: "Interview 15 Oct, 14:00", soon: true, past: false });
    expect(interviewInfo("2026-10-21", "", today)).toEqual({ label: "Interview 21 Oct", soon: false, past: false });
  });

  it("says interviewed once the date has passed", () => {
    expect(interviewInfo("2026-10-01", "09:00", today)).toEqual({ label: "Interviewed 1 Oct", soon: false, past: true });
  });

  it("returns null without a date", () => {
    expect(interviewInfo(null, "10:00", today)).toBeNull();
  });
});
