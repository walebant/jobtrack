// Calls the real NHS Jobs site (2 requests). Run on purpose with `npm run test:nhs`.
import { describe, expect, it } from "vitest";
import { parseAdvert } from "@/lib/nhsjobs/advert";
import { REQUEST_GAP_MS, fetchNhsJobsPage, sleep } from "@/lib/nhsjobs/fetch";
import { buildSearchUrl, parseSearchResults } from "@/lib/nhsjobs/search";

describe.skipIf(!process.env.NHS_LIVE)("NHS Jobs (live)", { timeout: 60_000 }, () => {
  it("searches and reads the first advert", async () => {
    const url = buildSearchUrl({
      keywords: "",
      location: "Sutton",
      distance: 20,
      staffGroups: ["ADMINISTRATIVE_AND_CLERICAL"],
      bands: ["BAND_5", "BAND_6", "BAND_7", "BAND_8A", "BAND_8B", "BAND_8C", "BAND_8D"],
    });
    const search = parseSearchResults(await fetchNhsJobsPage(url));
    console.log(`${search.total} jobs found; first page:`, search.results.map((r) => `${r.title} | ${r.employer} | closes ${r.closingDate}`));
    expect(search.results.length).toBeGreaterThan(0);
    for (const r of search.results) {
      expect(r.ref).toMatch(/^[A-Z0-9-]+$/);
      expect(r.title).not.toBe("");
    }

    await sleep(REQUEST_GAP_MS);
    const advert = parseAdvert(await fetchNhsJobsPage(search.results[0].url));
    console.log({ ...advert, advertText: `${advert.advertText.length} chars` });
    expect(advert.title).not.toBe("");
    expect(advert.band).toMatch(/band|grade|/i);
    expect(advert.essential.length + advert.desirable.length).toBeGreaterThan(0);
  });
});
