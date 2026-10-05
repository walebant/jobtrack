import { parse } from "node-html-parser";
import { clean, parseUkLongDate } from "./search";

export type ParsedAdvert = {
  title: string;
  employer: string;
  band: string;
  salary: string;
  location: string;
  reference: string;
  closingDate: string | null;
  sponsorship: "yes" | "no" | "unknown";
  essential: string[];
  desirable: string[];
  advertText: string;
};

// Reads an NHS Jobs advert page. The page shows the person specification twice
// (desktop and mobile), so criteria are de-duplicated by their element id.
export function parseAdvert(html: string): ParsedAdvert {
  const root = parse(html);
  const byId = (id: string) => clean(root.querySelector(`[id="${id}"]`)?.text);

  const criteria = (kind: "essential" | "desirable") => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const li of root.querySelectorAll(`li[id^="${kind}_skill_"]`)) {
      const text = clean(li.text);
      if (!text || seen.has(li.id)) continue;
      seen.add(li.id);
      if (!out.includes(text)) out.push(text);
    }
    return out;
  };

  // The text under "Certificate of Sponsorship" says whether sponsorship is possible.
  const sponsorHeading = root.querySelector('[id="tier-two-sponsorship"]');
  const sponsorText = clean(sponsorHeading?.nextElementSibling?.text).toLowerCase();
  const sponsorship: ParsedAdvert["sponsorship"] = !sponsorText
    ? "unknown"
    : /\b(not|unable|cannot|can't)\b/.test(sponsorText)
      ? "no"
      : /welcome|considered|eligible|can apply|may be able/.test(sponsorText)
        ? "yes"
        : "unknown";

  const town = byId("employer_town");
  const postcode = byId("employer_postcode");
  const main = root.querySelector("#maincontent") ?? root;
  // Drop the duplicated mobile copy of the person specification from the stored text.
  main.querySelectorAll("details").forEach((d) => d.remove());
  main.querySelectorAll("script, style, nav, form, button").forEach((d) => d.remove());
  const advertText = main.structuredText.replace(/\n{3,}/g, "\n\n").trim().slice(0, 40_000);

  return {
    title: clean(root.querySelector("h1")?.text),
    employer: byId("employer_name"),
    band: byId("payscheme-band"),
    salary: byId("range_salary"),
    location: [town, postcode].filter(Boolean).join(", "),
    reference: byId("trac-job-reference"),
    closingDate: parseUkLongDate(byId("closing_date")),
    sponsorship,
    essential: criteria("essential"),
    desirable: criteria("desirable"),
    advertText,
  };
}
