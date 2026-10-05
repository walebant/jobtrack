import type { Metadata } from "next";
import Link from "next/link";
import { Chip, ClosingChip } from "@/components/chips";
import { EmptyState } from "@/components/empty-state";
import { FitChip, NotScoredChip, VERDICT_LABEL } from "@/components/fit";
import { getPipelineSummary, getSearch, listJobs } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { sortJobs } from "@/lib/jobs/sort";
import { ScoreAll } from "../pipeline/score-all";
import { DecisionButtons } from "./decision-buttons";
import { RunPanel } from "./run-panel";
import { SearchForm, type SearchValues } from "./search-form";

export const metadata: Metadata = { title: "Find jobs · Job Search Tracker" };
// Each step (a search, or reading and scoring one job) is its own call, well under this.
export const maxDuration = 120;

const NEW_SEARCH: SearchValues = {
  keywords: "",
  location: "",
  distance: 20,
  staffGroups: ["ADMINISTRATIVE_AND_CLERICAL"],
  bands: [],
  maxNew: 10,
};

export default async function FindPage() {
  const { search, suggestions, hasCv } = await userDb(async (tx) => ({
    search: await getSearch(tx),
    suggestions: await listJobs(tx, "suggested"),
    hasCv: (await getPipelineSummary(tx)).hasCv,
  }));
  const ranked = sortJobs(suggestions, "fit");
  const unscored = hasCv ? ranked.filter((j) => j.score === null && j.hasCriteria).map((j) => j.id) : [];

  return (
    <div className="space-y-3.5">
      <RunPanel ready={Boolean(search)} lastRunAt={search?.lastRunAt?.toISOString() ?? null} hasCv={hasCv} />

      <section aria-labelledby="suggested-heading">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <h2 id="suggested-heading" className="text-[19px] font-bold">
            Suggested jobs {ranked.length > 0 && <span className="font-sans text-base font-normal text-muted-foreground">({ranked.length})</span>}
          </h2>
          {unscored.length > 0 && <ScoreAll jobIds={unscored} />}
        </div>
        {ranked.length === 0 ? (
          <EmptyState title="No suggestions yet">
            {search ? "Press Find jobs now to search NHS Jobs." : "Save your search below, then press Find jobs now."}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {ranked.map((j) => (
              <li key={j.id} className="rounded-2xl border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <Link href={`/jobs/${j.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {j.title}
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground">{[j.employer, j.band, j.salary].filter(Boolean).join(" · ")}</p>
                    {j.location && <p className="text-[13px] text-muted-foreground">{j.location}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {j.score !== null ? (
                        <>
                          <FitChip score={j.score} />
                          {j.verdict && <span className="text-sm font-medium">{VERDICT_LABEL[j.verdict]}</span>}
                        </>
                      ) : j.advertRead ? (
                        <NotScoredChip hasCriteria={j.hasCriteria} />
                      ) : (
                        <Chip className="text-muted-foreground">Advert not read yet</Chip>
                      )}
                      <ClosingChip closingDate={j.closingDate} />
                    </div>
                  </div>
                  <DecisionButtons jobId={j.id} title={j.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SearchForm values={search ?? NEW_SEARCH} saved={Boolean(search)} />

      <p className="text-xs text-muted-foreground">
        Jobs come from NHS Jobs (jobs.nhs.uk), for your personal use only. Trac-only jobs can be added from Trac alert
        emails on the Add jobs page.
      </p>
    </div>
  );
}
