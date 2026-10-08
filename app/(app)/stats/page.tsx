import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getStatsJobs } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { computeStats } from "@/lib/stats";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Stats · Job Search Tracker" };

export default async function StatsPage() {
  const now = new Date();
  const jobs = await userDb((tx) => getStatsJobs(tx));
  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No stats yet"
        action={
          <Button asChild>
            <Link href="/find">Find jobs</Link>
          </Button>
        }
      >
        Stats will appear once you start tracking jobs.
      </EmptyState>
    );
  }
  return <StatsView s={computeStats(jobs, now)} />;
}
