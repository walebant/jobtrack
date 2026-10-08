import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getPipelineSummary, listJobs } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { parseDir, parseSort, sortJobs } from "@/lib/jobs/sort";
import {
  STAGE_GROUPS,
  closingDateMatters,
  countByGroup,
  inStageGroup,
  parseStageGroup,
  type StageGroup,
} from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import { JobTable, pipelineHref } from "./job-table";
import { ScoreAll } from "./score-all";

export const metadata: Metadata = { title: "Pipeline · Job Search Tracker" };
// Scoring several jobs in a row calls Claude once per job.
export const maxDuration = 120;

export default async function PipelinePage(props: PageProps<"/pipeline">) {
  const params = await props.searchParams;
  const sort = parseSort(params.sort);
  const dir = parseDir(params.dir);
  const stage = parseStageGroup(params.stage);
  const { summary, jobs } = await userDb(async (tx) => ({
    summary: await getPipelineSummary(tx),
    jobs: await listJobs(tx),
  }));
  const counts = countByGroup(jobs.map((j) => j.status));
  const shown = sortJobs(
    jobs.filter((j) => inStageGroup(j.status, stage)),
    sort,
    dir,
  );
  // Unscored jobs that can still be applied for, soonest closing first.
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
          <p>Paste an advert or a job alert email, or use Find jobs, to start tracking.</p>
          {!summary.hasCv && <CvTip />}
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Filter by stage" className="scroll-row mb-3 flex gap-1 border-b">
            {(Object.keys(STAGE_GROUPS) as StageGroup[]).map((g) => (
              <Link
                key={g}
                href={pipelineHref({ stage: g, sort, dir })}
                aria-current={stage === g ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground",
                  stage === g && "border-primary text-foreground",
                )}
              >
                {STAGE_GROUPS[g].label} <span className="text-muted-foreground">({counts[g]})</span>
              </Link>
            ))}
          </nav>

          {unscored.length > 0 && (
            <div className="mb-3 flex justify-end">
              <ScoreAll jobIds={unscored} />
            </div>
          )}
          {!summary.hasCv && (
            <p className="mb-3 text-sm text-mid">
              Jobs cannot be scored until your CV is saved. <CvTip inline />
            </p>
          )}
          {shown.length === 0 ? (
            <EmptyState title={`Nothing in ${STAGE_GROUPS[stage].label} yet`}>
              Change a job&apos;s stage from its row or its page and it will show here.
            </EmptyState>
          ) : (
            <JobTable jobs={shown} view={{ stage, sort, dir }} />
          )}
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
