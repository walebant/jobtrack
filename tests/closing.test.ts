import { describe, expect, it } from "vitest";
import { todayUk } from "@/lib/dates";
import { closingInfo, daysLeft } from "@/lib/jobs/closing";
import { closingDateMatters } from "@/lib/jobs/status";

const today = "2026-10-05";

describe("daysLeft", () => {
  it("counts whole days from today", () => {
    expect(daysLeft("2026-10-05", today)).toBe(0);
    expect(daysLeft("2026-10-06", today)).toBe(1);
    expect(daysLeft("2026-10-04", today)).toBe(-1);
    expect(daysLeft("2026-11-05", today)).toBe(31);
  });

  it("is not thrown by the clocks changing", () => {
    // UK clocks go back on 25 October 2026.
    expect(daysLeft("2026-10-26", "2026-10-24")).toBe(2);
  });

  it("returns null without a date", () => {
    expect(daysLeft(null, today)).toBeNull();
    expect(daysLeft("not a date", today)).toBeNull();
  });
});

describe("closingInfo", () => {
  it("is red at 3 days or fewer, amber at 7 or fewer", () => {
    expect(closingInfo("2026-10-05", today)).toEqual({ label: "Closes today", tone: "bad" });
    expect(closingInfo("2026-10-06", today)).toEqual({ label: "Closes tomorrow", tone: "bad" });
    expect(closingInfo("2026-10-08", today)).toEqual({ label: "Closes in 3 days", tone: "bad" });
    expect(closingInfo("2026-10-09", today)).toEqual({ label: "Closes in 4 days", tone: "mid" });
    expect(closingInfo("2026-10-12", today)).toEqual({ label: "Closes in 7 days", tone: "mid" });
    expect(closingInfo("2026-10-13", today)).toEqual({ label: "Closes in 8 days", tone: "neutral" });
  });

  it("says closed once the date has passed", () => {
    expect(closingInfo("2026-10-01", today)).toEqual({ label: "Closed", tone: "neutral" });
  });
});

describe("closingDateMatters", () => {
  it("hides closing dates once applied or withdrawn", () => {
    expect(closingDateMatters("saved")).toBe(true);
    expect(closingDateMatters("applying")).toBe(true);
    expect(closingDateMatters("submitted")).toBe(false);
    expect(closingDateMatters("interview")).toBe(false);
    expect(closingDateMatters("withdrawn")).toBe(false);
  });
});

describe("todayUk", () => {
  it("uses the UK date, not UTC", () => {
    // 23:30 UTC on 5 October is 00:30 on 6 October in the UK (BST).
    expect(todayUk(new Date("2026-10-05T23:30:00Z"))).toBe("2026-10-06");
    // In winter the UK is on UTC.
    expect(todayUk(new Date("2026-12-05T23:30:00Z"))).toBe("2026-12-05");
  });
});
