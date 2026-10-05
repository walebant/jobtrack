import { describe, expect, it } from "vitest";
import { cleanDeep, noDash } from "@/lib/ai/clean";

describe("noDash", () => {
  it("replaces em dashes with commas", () => {
    expect(noDash("I led the project — and it shipped")).toBe("I led the project, and it shipped");
    expect(noDash("data—driven")).toBe("data, driven");
  });

  it("does not leave doubled or stray commas", () => {
    expect(noDash("First, — then")).toBe("First, then");
    expect(noDash("It worked —.")).toBe("It worked.");
    expect(noDash("— Starts here")).toBe("Starts here");
    expect(noDash("Ends here —")).toBe("Ends here");
    expect(noDash("Line one —\nLine two")).toBe("Line one\nLine two");
  });

  it("leaves en dashes and hyphens alone", () => {
    expect(noDash("£25,000 – £30,000")).toBe("£25,000 – £30,000");
    expect(noDash("full-time, 9-5")).toBe("full-time, 9-5");
  });

  it("returns text without dashes unchanged", () => {
    const s = "Plain text, nothing to do.";
    expect(noDash(s)).toBe(s);
  });
});

describe("cleanDeep", () => {
  it("cleans nested strings and keeps other values", () => {
    const input = { title: "Analyst — Band 5", list: ["a — b"], n: 3, ok: true, none: null };
    expect(cleanDeep(input)).toEqual({ title: "Analyst, Band 5", list: ["a, b"], n: 3, ok: true, none: null });
  });
});
