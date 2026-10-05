import { describe, expect, it } from "vitest";
import { jobKey, markDuplicates } from "@/lib/jobs/duplicates";

describe("jobKey", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(jobKey("Data Analyst ", "Leeds Teaching Hospitals NHS Trust")).toBe(
      jobKey("data  analyst", "Leeds Teaching Hospitals NHS Trust."),
    );
    expect(jobKey("BI & Reporting Officer", "Leeds City Council")).toBe(
      jobKey("BI and Reporting Officer", "leeds city council"),
    );
  });

  it("keeps different jobs apart", () => {
    expect(jobKey("Data Analyst", "Trust A")).not.toBe(jobKey("Data Analyst", "Trust B"));
    expect(jobKey("Senior Data Analyst", "Trust A")).not.toBe(jobKey("Data Analyst", "Trust A"));
  });
});

describe("markDuplicates", () => {
  const existing = [{ title: "Data Analyst", employer: "Trust A" }];

  it("unticks jobs already tracked and ticks new ones", () => {
    const found = [
      { title: "data analyst", employer: "TRUST A" },
      { title: "Systems Officer", employer: "Trust B" },
    ];
    expect(markDuplicates(found, existing).map((j) => j.pick)).toEqual([false, true]);
  });

  it("unticks a job repeated within the same email", () => {
    const found = [
      { title: "Systems Officer", employer: "Trust B" },
      { title: "Systems Officer", employer: "Trust B" },
    ];
    expect(markDuplicates(found, []).map((j) => j.pick)).toEqual([true, false]);
  });

  it("keeps the other fields", () => {
    const [j] = markDuplicates([{ title: "X", employer: "Y", band: "Band 5" }], []);
    expect(j).toEqual({ title: "X", employer: "Y", band: "Band 5", pick: true });
  });
});
