import { NHS_JOBS_ORIGIN } from "./search";

// An honest name, so NHS Jobs can see what is calling it.
const USER_AGENT = "JobSearchTracker/1.0 (personal job search tool; https://jobtrackit.vercel.app)";

// Gap between requests to NHS Jobs, to stay polite.
export const REQUEST_GAP_MS = 1_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NhsJobsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NhsJobsError";
  }
}

// Fetches a page from NHS Jobs only (never any other host).
export async function fetchNhsJobsPage(url: string): Promise<string> {
  if (!url.startsWith(NHS_JOBS_ORIGIN + "/")) throw new NhsJobsError("Only NHS Jobs pages can be fetched.");
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new NhsJobsError("NHS Jobs did not respond. Try again in a few minutes.");
  }
  if (res.status === 404) throw new NhsJobsError("This advert is no longer on NHS Jobs.");
  if (!res.ok) throw new NhsJobsError(`NHS Jobs returned an error (${res.status}). Try again later.`);
  const html = await res.text();
  if (/captcha|cf-chl|challenge-platform/i.test(html)) {
    throw new NhsJobsError("NHS Jobs asked for a CAPTCHA, so the search was stopped. Try again later.");
  }
  return html;
}
