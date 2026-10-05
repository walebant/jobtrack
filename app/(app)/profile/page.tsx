import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "My profile · Job Search Tracker" };

export default function ProfilePage() {
  return (
    <EmptyState title="My profile">
      Your master CV, notes and evidence bank will live here. Scoring and drafting use them. This page arrives in
      milestone 2.
    </EmptyState>
  );
}
