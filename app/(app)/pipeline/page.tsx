import type { Metadata } from "next";
import Link from "next/link";
import { ClosingChip } from "@/components/chips";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatUkDate } from "@/lib/dates";
import { getPipelineSummary, listJobs, type JobListItem } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { STATUS_LABEL, closingDateMatters } from "@/lib/jobs/status";

export const metadata: Metadata = { title: "Pipeline · Job Search Tracker" };

const SOURCE_LABEL = { paste: "Advert", alert: "Alert email", manual: "Manual", gmail: "Gmail" } as const;

export default async function PipelinePage() {
  const { summary, jobs } = await userDb(async (tx) => ({
    summary: await getPipelineSummary(tx),
    jobs: await listJobs(tx),
  }));

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
          {!summary.hasCv && (
            <p className="mt-2 text-sm">
              Tip: add your CV in{" "}
              <Link href="/profile" className="underline underline-offset-2">
                My profile
              </Link>{" "}
              first so jobs can be scored.
            </p>
          )}
        </EmptyState>
      ) : (
        <JobTable jobs={jobs} />
      )}
    </>
  );
}

function JobTable({ jobs }: { jobs: JobListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card px-2.5 py-1.5">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-2.5 py-2 font-semibold">Job</th>
            <th className="px-2.5 py-2 font-semibold">Band</th>
            <th className="px-2.5 py-2 font-semibold">Status</th>
            <th className="px-2.5 py-2 font-semibold">Closing date</th>
            <th className="hidden px-2.5 py-2 font-semibold sm:table-cell">Added</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t align-top">
              <td className="min-w-48 px-2.5 py-2.5">
                <div className="font-semibold">{j.title || "Untitled job"}</div>
                <div className="text-[13px] text-muted-foreground">{j.employer}</div>
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
              <td className="hidden px-2.5 py-2.5 whitespace-nowrap text-muted-foreground sm:table-cell">
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
