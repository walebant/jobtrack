import { describe, expect, it } from "vitest";
import { assessedFor, assessedLetters, guessSector, judgedAtApplication } from "@/lib/ai/sector";
import { WRITING_KINDS, answersForExport, joinAnswers, questionsBlock, splitAnswers, writingSystem } from "@/lib/ai/writing";

describe("guessSector", () => {
  it("recognises NHS bodies and councils from the employer's name", () => {
    expect(guessSector("Whittington Health NHS Trust")).toBe("nhs");
    expect(guessSector("South West London ICB")).toBe("nhs");
    expect(guessSector("London Borough of Merton")).toBe("council");
    expect(guessSector("Ealing Council")).toBe("council");
    expect(guessSector("Surrey County Council")).toBe("council");
    expect(guessSector("Breast Cancer UK")).toBe("other");
  });
});

describe("assessment markers", () => {
  const assessment = { "Experience of SQL": ["application", "interview"] as const, "Presentation skills": ["interview"] as const };
  const a = assessment as unknown as Record<string, ("application" | "interview" | "test")[]>;

  it("matches criteria loosely and reads them as letters", () => {
    expect(assessedFor("experience of SQL.", a)).toEqual(["application", "interview"]);
    expect(assessedLetters(["application", "interview", "test"])).toBe("A/I/T");
    expect(assessedFor("Unknown", a)).toEqual([]);
  });

  it("treats unmarked criteria as judged at application", () => {
    expect(judgedAtApplication("Presentation skills", a)).toBe(false);
    expect(judgedAtApplication("Experience of SQL", a)).toBe(true);
    expect(judgedAtApplication("Something else", a)).toBe(true);
  });
});

describe("sector-aware prompts", () => {
  it("never calls a council job an NHS job", () => {
    for (const kind of WRITING_KINDS) {
      const council = writingSystem(kind, "council");
      expect(council).toContain("Sector: UK local government");
      expect(council).not.toMatch(/expert NHS|NHS recruitment/);
    }
    expect(writingSystem("statement", "nhs")).toContain("Sector: NHS");
  });
});

describe("application answers", () => {
  it("splits tagged answers and joins them back", () => {
    const text = "[[Q1]]\nFirst answer.\n\n[[Q2]]\nSecond answer\nover two lines.";
    expect(splitAnswers(text, 2)).toEqual(["First answer.", "Second answer\nover two lines."]);
    expect(splitAnswers(joinAnswers(["A", "B"]), 2)).toEqual(["A", "B"]);
  });

  it("copes with missing or extra answers", () => {
    expect(splitAnswers("[[Q2]]\nOnly the second.", 3)).toEqual(["", "Only the second.", ""]);
    expect(splitAnswers("No tags at all", 2)).toEqual(["No tags at all", ""]);
    expect(splitAnswers("[[Q5]]\nOut of range", 2)).toEqual(["", ""]);
  });

  it("lists questions with their limits for Claude and for export", () => {
    const qs = [
      { question: "Why this role?", limit: 250, unit: "words" as const },
      { question: "Tell us about teamwork", limit: null, unit: "words" as const },
    ];
    expect(questionsBlock(qs)).toContain("[[Q1]] Why this role?\nLimit: 250 words");
    expect(questionsBlock(qs)).toContain("Limit: none given");
    expect(answersForExport(qs, ["Because.", "Together."])).toBe("1. Why this role?\n\nBecause.\n\n\n2. Tell us about teamwork\n\nTogether.");
  });
});
