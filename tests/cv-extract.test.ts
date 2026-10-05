import { describe, expect, it } from "vitest";
import { detectCvKind, extractCvText, tidyText } from "@/lib/cv/extract";
import { makeDocx, makePdf } from "./helpers/make-files";

const lines = ["Jane Example", "Data Analyst, Northshire NHS Trust (2023 to now)", "Built Power BI dashboards for 12 services"];

describe("detectCvKind", () => {
  it("tells PDFs and .docx files apart by their first bytes", () => {
    expect(detectCvKind(makePdf(["x"]))).toBe("pdf");
    expect(detectCvKind(makeDocx(["x"]))).toBe("docx");
    expect(detectCvKind(Buffer.from("plain text"))).toBeNull();
  });
});

describe("extractCvText", () => {
  it("reads text from a .docx", async () => {
    const text = await extractCvText(makeDocx(lines));
    for (const l of lines) expect(text).toContain(l);
  });

  // The first PDF loads pdf.js, which can take several seconds on a cold start.
  it("reads text from a PDF", { timeout: 30_000 }, async () => {
    const text = await extractCvText(makePdf(lines));
    for (const l of lines) expect(text).toContain(l);
  });

  it("refuses other files", async () => {
    await expect(extractCvText(Buffer.from("not a cv"))).rejects.toThrow("unsupported");
  });
});

describe("tidyText", () => {
  it("normalises line breaks and spacing", () => {
    expect(tidyText("a  b \r\n\r\n\r\n\r\nc\t\t d \n")).toBe("a b\n\nc d");
  });
});
