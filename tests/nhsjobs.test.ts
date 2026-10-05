// The pages below are small made-up pages shaped like NHS Jobs, not copies of real
// adverts (NHS Jobs content may not be republished).
import { describe, expect, it } from "vitest";
import { parseAdvert } from "@/lib/nhsjobs/advert";
import { advertRef, buildSearchUrl, parseSearchResults, parseUkLongDate } from "@/lib/nhsjobs/search";

const result = (ref: string, title: string, employer: string, closing: string) => `
<li class="nhsuk-list-panel search-result" data-test="search-result">
  <h2><a href="/candidate/jobadvert/${ref}?keyword=x&amp;language=en" data-test="search-result-job-title"> ${title} </a></h2>
  <div data-test="search-result-location"><h3 class="nhsuk-u-font-weight-bold"> ${employer} <div class="location-font-size"> Sutton SM1 1AA </div></h3></div>
  <ul>
    <li data-test="search-result-salary"> Salary: <strong> £31,049 to £37,796 a year </strong></li>
    <li data-test="search-result-publicationDate"> Date posted: <strong> 1 October 2026 </strong></li>
    <li data-test="search-result-closingDate"> Closing date: <strong> ${closing} </strong></li>
    <li data-test="search-result-jobType"> Contract type: <strong> Permanent </strong></li>
    <li data-test="search-result-workingPattern"> Working pattern: <strong> Full time </strong></li>
  </ul>
</li>`;

const searchPage = (next: boolean) => `<html><body><main>
  <p>23 jobs found</p>
  <ul class="search-results">
    ${result("C1111-26-0001", "Data Analyst", "Example Hospitals NHS Trust", "20 October 2026")}
    ${result("C2222-26-0002", "Systems Officer", "Example Community NHS Trust", "3 November 2026")}
  </ul>
  ${next ? '<a href="?page=2" data-test="search-next-page">Next</a>' : ""}
</main></body></html>`;

const spec = `
<h2>Person Specification</h2>
<h3 id="skill_category_1">Qualifications</h3>
<h4>Essential</h4><ul><li id="essential_skill_1_criteria_1">Degree or equivalent experience</li></ul>
<h3 id="skill_category_2">Experience</h3>
<h4>Essential</h4><ul><li id="essential_skill_2_criteria_1">Experience of SQL</li><li id="essential_skill_2_criteria_2">Experience of reporting</li></ul>
<h4>Desirable</h4><ul><li id="desirable_skill_2_criteria_1">Experience of Power BI</li></ul>`;

const advertPage = (sponsorText: string) => `<html><body><main id="maincontent">
  <span id="employer_name">Example Hospitals NHS Trust</span>
  <h1>Data Analyst</h1>
  <p id="closing_date">The closing date is 20 October 2026</p>
  <h2>Job summary</h2><p>Build reports for services.</p>
  <h3>Pay scheme</h3><p>Agenda for change</p>
  <h3>Band</h3><p id="payscheme-band">Band 5</p>
  <h3>Salary</h3><p id="range_salary">£31,049 to £37,796 a year</p>
  <h3>Reference number</h3><p id="trac-job-reference">123-ABC-456</p>
  <p id="employer_town">Sutton</p><p id="employer_postcode">SM1 1AA</p>
  ${spec}
  <details><summary>Person Specification</summary><div>${spec}</div></details>
  <h3 id="tier-two-sponsorship">Certificate of Sponsorship</h3><p>${sponsorText}</p>
</main></body></html>`;

describe("buildSearchUrl", () => {
  it("adds the filters, newest first", () => {
    const url = new URL(
      buildSearchUrl(
        { keywords: " data ", location: "Sutton", distance: 20, staffGroups: ["ADMINISTRATIVE_AND_CLERICAL"], bands: ["BAND_5", "BAND_8A"] },
        2,
      ),
    );
    expect(url.origin).toBe("https://www.jobs.nhs.uk");
    expect(url.searchParams.get("keyword")).toBe("data");
    expect(url.searchParams.get("location")).toBe("Sutton");
    expect(url.searchParams.get("distance")).toBe("20");
    expect(url.searchParams.getAll("staffGroup")).toEqual(["ADMINISTRATIVE_AND_CLERICAL"]);
    // One comma-separated parameter: NHS Jobs returns a 400 if it is repeated.
    expect(url.searchParams.getAll("payBand")).toEqual(["BAND_5,BAND_8A"]);
    expect(url.searchParams.get("sort")).toBe("publicationDateDesc");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("leaves out empty filters and unknown values", () => {
    const url = new URL(buildSearchUrl({ keywords: "", location: "", distance: 20, staffGroups: ["NOPE"], bands: ["BAND_99"] }));
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("distance")).toBe(false);
    expect(url.searchParams.has("staffGroup")).toBe(false);
    expect(url.searchParams.has("payBand")).toBe(false);
    expect(url.searchParams.has("page")).toBe(false);
  });
});

describe("parseSearchResults", () => {
  it("reads each result", () => {
    const { results, total, hasNext } = parseSearchResults(searchPage(true));
    expect(total).toBe(23);
    expect(hasNext).toBe(true);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      ref: "C1111-26-0001",
      title: "Data Analyst",
      employer: "Example Hospitals NHS Trust",
      location: "Sutton SM1 1AA",
      salary: "£31,049 to £37,796 a year",
      closingDate: "2026-10-20",
      postedDate: "2026-10-01",
      contractType: "Permanent",
      workingPattern: "Full time",
      url: "https://www.jobs.nhs.uk/candidate/jobadvert/C1111-26-0001",
    });
  });

  it("knows when there is no next page", () => {
    expect(parseSearchResults(searchPage(false)).hasNext).toBe(false);
  });

  it("returns nothing for an unrelated page", () => {
    expect(parseSearchResults("<html><body>Site unavailable</body></html>")).toEqual({ results: [], total: null, hasNext: false });
  });
});

describe("parseAdvert", () => {
  it("reads the fields and de-duplicates the person specification", () => {
    const a = parseAdvert(advertPage("Applications from job seekers who require Skilled worker sponsorship are welcome."));
    expect(a).toMatchObject({
      title: "Data Analyst",
      employer: "Example Hospitals NHS Trust",
      band: "Band 5",
      salary: "£31,049 to £37,796 a year",
      location: "Sutton, SM1 1AA",
      reference: "123-ABC-456",
      closingDate: "2026-10-20",
      sponsorship: "yes",
      essential: ["Degree or equivalent experience", "Experience of SQL", "Experience of reporting"],
      desirable: ["Experience of Power BI"],
    });
    expect(a.advertText).toContain("Build reports for services.");
    // The mobile copy inside <details> is not stored twice.
    expect(a.advertText.match(/Experience of SQL/g)).toHaveLength(1);
  });

  it("reads when sponsorship is ruled out or not mentioned", () => {
    expect(parseAdvert(advertPage("This post is not eligible for sponsorship.")).sponsorship).toBe("no");
    expect(parseAdvert(advertPage("")).sponsorship).toBe("unknown");
  });
});

describe("helpers", () => {
  it("parses long UK dates", () => {
    expect(parseUkLongDate("5 October 2026")).toBe("2026-10-05");
    expect(parseUkLongDate("The closing date is 07 October 2026")).toBe("2026-10-07");
    expect(parseUkLongDate("Smarch 5 2026")).toBeNull();
  });

  it("gets the advert id from a link", () => {
    expect(advertRef("/candidate/jobadvert/C9232-26-0255?keyword=x")).toBe("C9232-26-0255");
    expect(advertRef("/candidate/search")).toBeNull();
  });
});
