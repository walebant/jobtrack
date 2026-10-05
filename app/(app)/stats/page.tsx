import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Stats · Job Search Tracker" };

export default function StatsPage() {
  return <EmptyState title="Stats">Stats will appear once you start adding jobs.</EmptyState>;
}
