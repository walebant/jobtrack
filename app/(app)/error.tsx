"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState title="Something went wrong" action={<Button onClick={reset}>Try again</Button>}>
      We could not load this page. Check your connection and try again.
    </EmptyState>
  );
}
