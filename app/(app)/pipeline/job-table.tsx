import Link from "next/link";
import { ClosingChip, InterviewChip } from "@/components/chips";
import { FitChip, NotScoredChip } from "@/components/fit";
import { StatusSelect } from "@/components/status-select";
import { formatUkDate } from "@/lib/dates";
import type { JobListItem } from "@/lib/db/queries";
import type { JobSort, SortDir } from "@/lib/jobs/sort";
import { closingDateMatters, interviewInfo, type StageGroup } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";

const SOURCE_LABEL = { paste: "Advert", alert: "Alert email", manual: "Manual", gmail: "Gmail", nhs_jobs: "Find jobs" } as const;

export type View = { stage: StageGroup; sort: JobSort; dir: SortDir };

export function pipelineHref({ stage, sort, dir }: View) {
  const q = new URLSearchParams();
  if (stage !== "all") q.set("stage", stage);
  if (sort !== "fit") q.set("sort", sort);
  if (dir !== "natural") q.set("dir", dir);
  const s = q.toString();
  return s ? `/pipeline?${s}` : "/pipeline";
}

// Each column's first-click order, in plain words and as an aria-sort value.
const COLUMN: Record<JobSort, { label: string; natural: string; reversed: string; ascendingWhenNatural: boolean }> = {
  title: { label: "Job", natural: "A to Z", reversed: "Z to A", ascendingWhenNatural: true },
  fit: { label: "Fit", natural: "best fit first", reversed: "lowest fit first", ascendingWhenNatural: false },
  stage: { label: "Stage", natural: "earliest stage first", reversed: "latest stage first", ascendingWhenNatural: true },
  closing: { label: "Dates", natural: "closing soonest first", reversed: "closing latest first", ascendingWhenNatural: true },
  newest: { label: "Added", natural: "newest first", reversed: "oldest first", ascendingWhenNatural: false },
};

// A column header that sorts the table: first click sorts it, a second click reverses it.
function SortHeader({ column, view, className }: { column: JobSort; view: View; className?: string }) {
  const c = COLUMN[column];
  const active = view.sort === column;
  const nextDir: SortDir = active && view.dir === "natural" ? "reversed" : "natural";
  const ascending = active ? (view.dir === "natural") === c.ascendingWhenNatural : undefined;
  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={cn("bg-muted px-2.5 py-3 font-semibold first:rounded-l-lg last:rounded-r-lg", className)}
    >
      <Link
        href={pipelineHref({ ...view, sort: column, dir: nextDir })}
        title={`Sort by ${c.label.toLowerCase()}, ${nextDir === "natural" ? c.natural : c.reversed}`}
        className={cn("group inline-flex items-center gap-1.5 rounded-md hover:text-primary", active && "text-primary")}
      >
        {c.label}
        {/* Every column shows it can be sorted; the sorted one shows its direction. */}
        <span aria-hidden className={cn("text-[11px]", active ? "opacity-100" : "opacity-35 group-hover:opacity-70")}>
          {active ? (ascending ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export function JobTable({ jobs, view }: { jobs: JobListItem[]; view: View }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card p-2">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Your jobs, sorted by {COLUMN[view.sort].label.toLowerCase()}, {view.dir === "natural" ? COLUMN[view.sort].natural : COLUMN[view.sort].reversed}.
          Select a column heading to sort by it.
        </caption>
        <thead>
          <tr className="text-left text-sm text-foreground">
            <SortHeader column="title" view={view} />
            <SortHeader column="fit" view={view} />
            <SortHeader column="stage" view={view} />
            <SortHeader column="closing" view={view} />
            <SortHeader column="newest" view={view} className="hidden md:table-cell" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const interview = interviewInfo(j.interviewDate, j.interviewTime);
            return (
              <tr key={j.id} className="border-t align-top first:border-t-0 hover:bg-muted/50">
                <td className="min-w-48 px-2.5 py-2.5">
                  <Link href={`/jobs/${j.id}`} className="font-semibold underline-offset-2 hover:underline">
                    {j.title || "Untitled job"}
                  </Link>
                  <div className="text-[13px] text-muted-foreground">{[j.employer, j.band].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-2.5 py-2.5 whitespace-nowrap">
                  {j.score !== null ? <FitChip score={j.score} /> : <NotScoredChip hasCriteria={j.hasCriteria} />}
                </td>
                <td className="px-2.5 py-2.5 whitespace-nowrap">
                  <StatusSelect key={j.status} jobId={j.id} status={j.status} title={j.title} compact />
                </td>
                <td className="px-2.5 py-2.5 whitespace-nowrap">
                  {interview && j.status === "interview" ? (
                    <InterviewChip info={interview} />
                  ) : closingDateMatters(j.status) ? (
                    <>
                      {j.closingDate ? `Closes ${formatUkDate(j.closingDate)}` : "–"}
                      <div className="mt-1">
                        <ClosingChip closingDate={j.closingDate} />
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{interview ? interview.label : "–"}</span>
                  )}
                </td>
                <td className="hidden px-2.5 py-2.5 whitespace-nowrap text-muted-foreground md:table-cell">
                  {formatUkDate(j.createdAt)}
                  <div className="text-[13px]">{SOURCE_LABEL[j.source]}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
