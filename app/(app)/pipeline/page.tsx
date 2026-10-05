import type { Metadata } from "next";
import Link from "next/link";
import { ClosingChip } from "@/components/chips";
import { EmptyState } from "@/components/empty-state";
import { FitChip, NotScoredChip } from "@/components/fit";
import { Button } from "@/components/ui/button";
import { formatUkDate } from "@/lib/dates";
import { getPipelineSummary, listJobs, type JobListItem } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { parseSort, sortJobs, type JobSort } from "@/lib/jobs/sort";
import { STATUS_LABEL, closingDateMatters } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import { ScoreAll } from "./score-all";

export const metadata: Metadata = { title: "Pipeline · Job Search Tracker" };
// Scoring several jobs in a row calls Claude once per job.
export const maxDuration = 120;

const SORT_LABEL: Record<JobSort, string> = { fit: "Best fit", closing: "Closing soonest", newest: "Newest" };
const SOURCE_LABEL = { paste: "Advert", alert: "Alert email", manual: "Manual", gmail: "Gmail", nhs_jobs: "Find jobs" } as const;

export default async function PipelinePage(props: PageProps<"/pipeline">) {
  const sort = parseSort((await props.searchParams).sort);
  const { summary, jobs } = await userDb(async (tx) => ({
    summary: await getPipelineSummary(tx),
    jobs: await listJobs(tx),
  }));
  const sorted = sortJobs(jobs, sort);
  // Unscored jobs that can be scored, best candidates (soonest closing) first.
  const unscored = summary.hasCv
    ? sortJobs(
        jobs.filter((j) => j.score === null && j.hasCriteria && closingDateMatters(j.status)),
        "closing",
      ).map((j) => j.id)
    : [];

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-muted-foreground">
          {jobs.length === 0 ? "No jobs tracked yet" : `${jobs.length} job${jobs.length === 1 ? "" : "s"} tracked`}
        </p>
        <Button asChild>
          <Link href="/add">Add a job</Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          action={
            <Button asChild>
              <Link href="/add">Add your first job</Link>
            </Button>
          }
        >
          <p>Paste an advert or a job alert email to start tracking.</p>
          {!summary.hasCv && <CvTip />}
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <nav aria-label="Sort jobs" className="flex gap-1 rounded-xl bg-muted p-1 text-sm">
              {(Object.keys(SORT_LABEL) as JobSort[]).map((s) => (
                <Link
                  key={s}
                  href={s === "fit" ? "/pipeline" : `/pipeline?sort=${s}`}
                  aria-current={sort === s ? "page" : undefined}
                  className={cn(
                    "rounded-[9px] px-3 py-1.5 font-medium whitespace-nowrap text-muted-foreground",
                    sort === s && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {SORT_LABEL[s]}
                </Link>
              ))}
            </nav>
            {unscored.length > 0 && <ScoreAll jobIds={unscored} />}
          </div>
          {!summary.hasCv && (
            <p className="mb-3 text-sm text-mid">
              Jobs cannot be scored until your CV is saved. <CvTip inline />
            </p>
          )}
          <JobTable jobs={sorted} />
        </>
      )}
    </>
  );
}

function CvTip({ inline }: { inline?: boolean }) {
  const link = (
    <Link href="/profile" className="underline underline-offset-2">
      My profile
    </Link>
  );
  return inline ? <>Add it in {link}.</> : <p className="mt-2 text-sm">Tip: add your CV in {link} first so jobs can be scored.</p>;
}

function JobTable({ jobs }: { jobs: JobListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card px-2.5 py-1.5">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-2.5 py-2 font-semibold">Job</th>
            <th className="px-2.5 py-2 font-semibold">Fit</th>
            <th className="px-2.5 py-2 font-semibold">Band</th>
            <th className="px-2.5 py-2 font-semibold">Status</th>
            <th className="px-2.5 py-2 font-semibold">Closing date</th>
            <th className="hidden px-2.5 py-2 font-semibold md:table-cell">Added</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t align-top hover:bg-muted/50">
              <td className="min-w-48 px-2.5 py-2.5">
                <Link href={`/jobs/${j.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {j.title || "Untitled job"}
                </Link>
                <div className="text-[13px] text-muted-foreground">{j.employer}</div>
              </td>
              <td className="px-2.5 py-2.5 whitespace-nowrap">
                {j.score !== null ? <FitChip score={j.score} /> : <NotScoredChip hasCriteria={j.hasCriteria} />}
              </td>
              <td className="px-2.5 py-2.5 whitespace-nowrap">{j.band || "–"}</td>
              <td className="px-2.5 py-2.5 whitespace-nowrap">{STATUS_LABEL[j.status]}</td>
              <td className="px-2.5 py-2.5 whitespace-nowrap">
                {j.closingDate ? formatUkDate(j.closingDate) : "–"}
                {closingDateMatters(j.status) && (
                  <div className="mt-1">
                    <ClosingChip closingDate={j.closingDate} />
                  </div>
                )}
              </td>
              <td className="hidden px-2.5 py-2.5 whitespace-nowrap text-muted-foreground md:table-cell">
                {formatUkDate(j.createdAt)}
                <div className="text-[13px]">{SOURCE_LABEL[j.source]}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
