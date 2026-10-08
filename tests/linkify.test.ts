import { describe, expect, it } from "vitest";
import { hostOf, linkify } from "@/lib/linkify";

describe("linkify", () => {
  it("finds links in text and keeps the rest as text", () => {
    expect(linkify("Look at https://www.jobs.nhs.uk/candidate/jobadvert/C9232-26-0255 tomorrow")).toEqual([
      { type: "text", text: "Look at " },
      { type: "link", text: "https://www.jobs.nhs.uk/candidate/jobadvert/C9232-26-0255", href: "https://www.jobs.nhs.uk/candidate/jobadvert/C9232-26-0255" },
      { type: "text", text: " tomorrow" },
    ]);
  });

  it("leaves sentence punctuation out of the link", () => {
    const parts = linkify("Apply here: https://trac.jobs/job/123. Closes Friday.");
    expect(parts[1]).toEqual({ type: "link", text: "https://trac.jobs/job/123", href: "https://trac.jobs/job/123" });
    expect(parts[2]).toEqual({ type: "text", text: ". Closes Friday." });
  });

  it("adds https to www. links", () => {
    expect(linkify("www.nhsjobs.com")).toEqual([{ type: "link", text: "www.nhsjobs.com", href: "https://www.nhsjobs.com" }]);
  });

  it("never makes other schemes into links", () => {
    expect(linkify("javascript:alert(1) and ftp://x")).toEqual([{ type: "text", text: "javascript:alert(1) and ftp://x" }]);
  });

  it("handles text with no links and several links", () => {
    expect(linkify("Ask Priya about the Band 6 role")).toEqual([{ type: "text", text: "Ask Priya about the Band 6 role" }]);
    expect(linkify("https://a.uk https://b.uk").filter((p) => p.type === "link")).toHaveLength(2);
  });

  it("gets a short host name", () => {
    expect(hostOf("https://www.jobs.nhs.uk/x")).toBe("jobs.nhs.uk");
    expect(hostOf("not a url")).toBe("");
  });
});
