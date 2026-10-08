import { describe, expect, it } from "vitest";
import { todayUk } from "@/lib/dates";
import { OverviewInput } from "@/lib/forms";

const base = {
  title: "Data Analyst",
  employer: "",
  band: "",
  salary: "",
  location: "",
  reference: "",
  closingDate: "",
  interviewDate: "",
  interviewTime: "",
  link: "",
  sponsorship: "unknown",
  sector: "council",
  contacts: "",
  notes: "",
};

describe("date applied", () => {
  it("accepts a past date, today, or blank", () => {
    expect(OverviewInput.parse({ ...base, appliedDate: "2026-09-15" }).appliedDate).toBe("2026-09-15");
    expect(OverviewInput.parse({ ...base, appliedDate: todayUk() }).appliedDate).toBe(todayUk());
    expect(OverviewInput.parse({ ...base, appliedDate: "" }).appliedDate).toBeNull();
  });

  it("refuses a future date or a date that does not exist", () => {
    const next = new Date();
    next.setDate(next.getDate() + 3);
    const result = OverviewInput.safeParse({ ...base, appliedDate: todayUk(next) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/future/);
    expect(OverviewInput.safeParse({ ...base, appliedDate: "2026-02-30" }).success).toBe(false);
  });
});
