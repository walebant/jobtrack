import { describe, expect, it } from "vitest";
import { REVIEW_MARKER, countWords, limitLine, splitReview, writingUser } from "@/lib/ai/writing";
import { WritingInputs } from "@/lib/forms";
import { fileStem, isHeading } from "@/lib/writing/download";

describe("splitReview", () => {
  it("separates the text to paste from the panel check", () => {
    const { content, review } = splitReview(`Opening.\n\nBody.\n${REVIEW_MARKER}\nSQL | Data section | 3\nWord count: 2`);
    expect(content).toBe("Opening.\n\nBody.");
    expect(review).toBe("SQL | Data section | 3\nWord count: 2");
  });

  it("keeps everything as content when there is no marker", () => {
    expect(splitReview("  Just text  ")).toEqual({ content: "Just text", review: "" });
  });
});

describe("limitLine", () => {
  it("states the limit in words or characters", () => {
    expect(limitLine(1500, "words")).toBe(
      "Hard limit: 1,500 words, counting every heading and [CHECK] note. Aim for about 1,350.",
    );
    expect(limitLine(4000, "characters")).toMatch(/^Hard limit: 4,000 characters including spaces.*Aim for about 3,600\.$/);
    expect(limitLine(null, "words")).toMatch(/800 to 1,200 words/);
  });
});

describe("writingUser", () => {
  const base = { jobBlock: "<job>…</job>", whyNotes: "Close to home", limit: "Stay within 1,000 words.", answers: [] as { question: string; answer: string }[] };

  it("adds the why notes and limit only to the statement", () => {
    const statement = writingUser("statement", base);
    expect(statement).toContain("<why_this_role>");
    expect(statement).toContain("Stay within 1,000 words.");
    const experience = writingUser("cv_experience", base);
    expect(experience).not.toContain("<why_this_role>");
    expect(experience).not.toContain("Stay within");
  });

  it("includes only answered questions", () => {
    const text = writingUser("education", {
      ...base,
      answers: [
        { question: "Grade?", answer: "2:1" },
        { question: "Year?", answer: " " },
      ],
    });
    expect(text).toContain("Q: Grade?\nA: 2:1");
    expect(text).not.toContain("Year?");
  });
});

describe("WritingInputs", () => {
  it("accepts a blank or sensible limit and rejects nonsense", () => {
    expect(WritingInputs.parse({ whyNotes: "", writeLimit: "", writeLimitUnit: "words" }).writeLimit).toBeNull();
    expect(WritingInputs.parse({ whyNotes: "", writeLimit: "1,500", writeLimitUnit: "words" }).writeLimit).toBe(1500);
    expect(WritingInputs.safeParse({ whyNotes: "", writeLimit: "10", writeLimitUnit: "words" }).success).toBe(false);
    expect(WritingInputs.safeParse({ whyNotes: "", writeLimit: "lots", writeLimitUnit: "words" }).success).toBe(false);
    expect(WritingInputs.safeParse({ whyNotes: "", writeLimit: "500", writeLimitUnit: "pages" }).success).toBe(false);
  });
});

describe("download helpers", () => {
  it("treats short standalone lines as headings, not sentences or bullets", () => {
    expect(isHeading("Data and reporting skills", "I built…")).toBe(true);
    expect(isHeading("I built a tool that saved time.", "Next")).toBe(false);
    expect(isHeading("- Built a tool", "Next")).toBe(false);
    expect(isHeading("Closing", undefined)).toBe(false);
  });

  it("makes safe file names", () => {
    expect(fileStem("Data Analyst (Band 5) / BI", "Supporting statement")).toBe("data-analyst-band-5-bi-supporting-statement");
  });

  it("counts words", () => {
    expect(countWords("  one two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});
