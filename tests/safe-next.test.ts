import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("keeps paths inside the app", () => {
    expect(safeNext("/stats")).toBe("/stats");
    expect(safeNext("/jobs/abc?tab=fit")).toBe("/jobs/abc?tab=fit");
  });

  it("falls back when empty", () => {
    expect(safeNext(null)).toBe("/pipeline");
    expect(safeNext("")).toBe("/pipeline");
    expect(safeNext(undefined, "/profile")).toBe("/profile");
  });

  it("rejects other sites", () => {
    expect(safeNext("https://evil.example")).toBe("/pipeline");
    expect(safeNext("//evil.example")).toBe("/pipeline");
    expect(safeNext("/\\evil.example")).toBe("/pipeline");
    expect(safeNext("javascript:alert(1)")).toBe("/pipeline");
    expect(safeNext("/ok\nSet-Cookie:x")).toBe("/pipeline");
  });
});
