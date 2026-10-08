import { describe, expect, it } from "vitest";
import { jobBlock } from "@/lib/ai/prompts";
import { pickCv } from "@/lib/cvs";
import type { Cv } from "@/lib/db/schema";

const cv = (id: string, over: Partial<Cv> = {}): Cv => ({
  id,
  userId: "u",
  name: id,
  cvText: `CV ${id}`,
  filePath: null,
  focus: "",
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe("pickCv", () => {
  const all = [cv("main", { isDefault: true }), cv("data"), cv("empty", { cvText: "  " })];

  it("uses the CV asked for, then the job's CV, then the default", () => {
    expect(pickCv(all, "data")?.id).toBe("data");
    expect(pickCv(all, undefined, "data")?.id).toBe("data");
    expect(pickCv(all, null, null)?.id).toBe("main");
  });

  it("skips CVs with no text and unknown ids", () => {
    expect(pickCv(all, "empty")?.id).toBe("main");
    expect(pickCv(all, "gone")?.id).toBe("main");
  });

  it("falls back to the first usable CV when there is no default, or null when none", () => {
    expect(pickCv([cv("a", { cvText: "" }), cv("b")])?.id).toBe("b");
    expect(pickCv([cv("a", { cvText: "" })])).toBeNull();
    expect(pickCv([])).toBeNull();
  });
});

describe("jobBlock with documents", () => {
  const job = {
    title: "Data Analyst",
    employer: "Trust",
    band: "Band 5",
    salary: "",
    location: "",
    essential: ["SQL"],
    desirable: [],
    advertText: "Advert text",
  };

  it("adds each uploaded document", () => {
    const text = jobBlock({ ...job, documents: [{ name: "JD.pdf", text: "Duties: build reports" }, { name: "empty", text: " " }] });
    expect(text).toContain('<job_document name="JD.pdf">');
    expect(text).toContain("Duties: build reports");
    expect(text).not.toContain('name="empty"');
  });

  it("caps the total document text", () => {
    const big = "x".repeat(25_000);
    const text = jobBlock({ ...job, documents: [{ name: "a", text: big }, { name: "b", text: big }] });
    // Count only the long runs of x (the word "text" elsewhere has one too).
    const docChars = (text.match(/x{100,}/g) ?? []).reduce((n, run) => n + run.length, 0);
    expect(docChars).toBe(30_000);
  });

  it("works without documents", () => {
    expect(jobBlock(job)).not.toContain("job_document");
  });
});
