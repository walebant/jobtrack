import { and, asc, eq } from "drizzle-orm";
import { todayUk } from "@/lib/dates";
import { jobSearches, jobs } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";
import { jobKey } from "@/lib/jobs/duplicates";
import { scoreJob } from "@/lib/jobs/score";
import { parseAdvert } from "@/lib/nhsjobs/advert";
import { NhsJobsError, REQUEST_GAP_MS, fetchNhsJobsPage, sleep } from "@/lib/nhsjobs/fetch";
import { buildSearchUrl, parseSearchResults, type SearchResult } from "@/lib/nhsjobs/search";

// At most this many result pages (10 jobs each) are read per run.
const MAX_PAGES = 3;

export type StartOutcome =
  | { ok: true; listed: number; total: number | null; added: number; pending: string[] }
  | { ok: false; message: string };

// Step 1 of a run: search NHS Jobs, skip jobs already seen or closed, and add the
// new ones as suggestions (title, employer, salary, dates from the results list).
// Returns every suggestion still waiting for its advert to be read and scored.
export async function startDiscovery(userId: string): Promise<StartOutcome> {
  const { search, known } = await userDb(async (tx) => ({
    search: (await tx.select().from(jobSearches).where(eq(jobSearches.userId, userId)))[0],
    known: await tx.select({ ref: jobs.externalRef, title: jobs.title, employer: jobs.employer, link: jobs.link }).from(jobs),
  }));
  if (!search) return { ok: false, message: "Save your search settings first." };
  if (!search.location.trim() && !search.keywords.trim() && search.staffGroups.length === 0) {
    return { ok: false, message: "Add a location, keywords or a staff group to search for." };
  }

  const seenRefs = new Set(known.map((k) => k.ref).filter(Boolean));
  const seenKeys = new Set(known.map((k) => jobKey(k.title, k.employer)));
  const seenLinks = known.map((k) => k.link).filter(Boolean);
  const today = todayUk();
  const fresh: SearchResult[] = [];
  let listed = 0;
  let total: number | null = null;

  try {
    for (let page = 1; page <= MAX_PAGES && fresh.length < search.maxNew; page++) {
      if (page > 1) await sleep(REQUEST_GAP_MS);
      const result = parseSearchResults(await fetchNhsJobsPage(buildSearchUrl(search, page)));
      total ??= result.total;
      listed += result.results.length;
      for (const r of result.results) {
        const key = jobKey(r.title, r.employer);
        const seen = seenRefs.has(r.ref) || seenKeys.has(key) || seenLinks.some((l) => l.includes(r.ref));
        const closed = r.closingDate !== null && r.closingDate < today;
        if (seen || closed) continue;
        seenRefs.add(r.ref);
        seenKeys.add(key);
        fresh.push(r);
        if (fresh.length >= search.maxNew) break;
      }
      if (!result.hasNext) break;
    }
  } catch (e) {
    return { ok: false, message: e instanceof NhsJobsError ? e.message : "The NHS Jobs search failed. Try again later." };
  }

  const pending = await userDb(async (tx) => {
    if (fresh.length) {
      await tx
        .insert(jobs)
        .values(
          fresh.map((r) => ({
            title: r.title,
            employer: r.employer,
            location: r.location,
            salary: r.salary,
            closingDate: r.closingDate,
            link: r.url,
            externalRef: r.ref,
            source: "nhs_jobs" as const,
            inbox: "suggested" as const,
          })),
        )
        .onConflictDoNothing();
    }
    await tx.update(jobSearches).set({ lastRunAt: new Date() }).where(eq(jobSearches.userId, userId));
    // New suggestions plus any left over from an earlier run that stopped part way.
    const waiting = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.inbox, "suggested"), eq(jobs.source, "nhs_jobs"), eq(jobs.advertText, "")))
      .orderBy(asc(jobs.createdAt));
    return waiting.map((w) => w.id).slice(0, search.maxNew);
  });

  return { ok: true, listed, total, added: fresh.length, pending };
}

export type ProcessOutcome =
  | { ok: true; title: string; score: number | null; note?: string }
  | { ok: false; stop: boolean; message: string };

// Step 2, once per suggestion: read the full advert from NHS Jobs, then score it.
// stop = true means later jobs would fail the same way (daily AI limit, no CV).
export async function processSuggestion(userId: string, jobId: string): Promise<ProcessOutcome> {
  const [job] = await userDb((tx) =>
    tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId), eq(jobs.source, "nhs_jobs"), eq(jobs.inbox, "suggested"))),
  );
  if (!job) return { ok: false, stop: false, message: "That suggestion could not be found." };

  if (!job.advertText) {
    try {
      const advert = parseAdvert(await fetchNhsJobsPage(job.link));
      await userDb((tx) =>
        tx
          .update(jobs)
          .set({
            title: advert.title || job.title,
            employer: advert.employer || job.employer,
            band: advert.band,
            salary: advert.salary || job.salary,
            location: advert.location || job.location,
            reference: advert.reference,
            closingDate: advert.closingDate ?? job.closingDate,
            sponsorship: advert.sponsorship,
            essential: advert.essential,
            desirable: advert.desirable,
            // A single space marks the advert as read even if the page had no text.
            advertText: advert.advertText || " ",
          })
          .where(eq(jobs.id, jobId)),
      );
    } catch (e) {
      if (e instanceof NhsJobsError && /no longer/.test(e.message)) {
        // The advert has gone; dismiss it so it is not tried again.
        await userDb((tx) => tx.update(jobs).set({ inbox: "dismissed", advertText: " " }).where(eq(jobs.id, jobId)));
        return { ok: true, title: job.title, score: null, note: "Advert removed from NHS Jobs" };
      }
      return { ok: false, stop: true, message: e instanceof NhsJobsError ? e.message : "Could not read the advert." };
    }
  }

  const scored = await scoreJob(userId, jobId);
  if (scored.ok) return { ok: true, title: job.title, score: scored.score };
  if (scored.reason === "no_criteria") return { ok: true, title: job.title, score: null, note: "No person specification" };
  return { ok: false, stop: scored.reason === "no_cv" || scored.reason === "ai", message: scored.message };
}

