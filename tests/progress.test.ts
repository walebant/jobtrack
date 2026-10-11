import { describe, expect, it } from "vitest";
import { progressOf, replayHistory } from "@/lib/jobs/progress";

describe("replayHistory", () => {
  it("follows the ladder forward", () => {
    expect(replayHistory(["saved", "submitted", "interview", "offer"])).toEqual({ furthest: 3, outcome: null });
  });

  it("treats moving back as a correction", () => {
    expect(replayHistory(["saved", "submitted", "interview", "offer", "interview"]).furthest).toBe(2);
    expect(replayHistory(["submitted", "saved", "interview", "offer", "interview"]).furthest).toBe(2);
    expect(replayHistory(["saved", "submitted", "saved"]).furthest).toBe(0);
  });

  it("keeps how far it got when it ends", () => {
    expect(replayHistory(["saved", "submitted", "interview", "rejected"])).toEqual({ furthest: 2, outcome: "rejected" });
    expect(replayHistory(["saved", "closed"])).toEqual({ furthest: 0, outcome: "closed" });
  });

  it("reopens after an outcome is undone", () => {
    expect(replayHistory(["saved", "withdrawn", "saved"])).toEqual({ furthest: 0, outcome: null });
  });

  it("reads retired stages as their replacements", () => {
    expect(replayHistory(["applying", "submitted", "shortlisted"]).furthest).toBe(2);
  });
});

describe("progressOf", () => {
  it("falls back to the current stage when history is missing", () => {
    expect(progressOf({ status: "interview", reached: [] }).furthest).toBe(2);
    expect(progressOf({ status: "rejected", reached: [] }).furthest).toBe(1);
    expect(progressOf({ status: "withdrawn", reached: [] }).furthest).toBe(0);
  });
});
