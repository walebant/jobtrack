import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Add jobs · Job Search Tracker" };

export default function AddJobsPage() {
  return (
    <EmptyState title="Add jobs">
      Paste an advert or a job alert email to start tracking. This page arrives in milestone 2.
    </EmptyState>
  );
}
