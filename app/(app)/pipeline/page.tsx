import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getPipelineSummary } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";

export const metadata: Metadata = { title: "Pipeline · Job Search Tracker" };

export default async function PipelinePage() {
  const { jobCount, hasCv } = await userDb(getPipelineSummary);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-muted-foreground">
          {jobCount === 0 ? "No jobs tracked yet" : `${jobCount} job${jobCount === 1 ? "" : "s"} tracked`}
        </p>
        <Button asChild>
          <Link href="/add">Add a job</Link>
        </Button>
      </div>
      {jobCount === 0 ? (
        <EmptyState
          title="No jobs yet"
          action={
            <Button asChild>
              <Link href="/add">Add your first job</Link>
            </Button>
          }
        >
          <p>Paste an advert or a job alert email to start tracking.</p>
          {!hasCv && (
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
        <EmptyState title="The board arrives in milestone 3">Your jobs are saved and will show here.</EmptyState>
      )}
    </>
  );
}
