"use client";

import { useEffect } from "react";

export const PIPELINE_VIEW_COOKIE = "pipeline_view";

// Remembers the pipeline tab and sort, so coming back to the pipeline shows them again.
export function RememberView({ query }: { query: string }) {
  useEffect(() => {
    document.cookie = `${PIPELINE_VIEW_COOKIE}=${encodeURIComponent(query)}; path=/; max-age=31536000; samesite=lax`;
  }, [query]);
  return null;
}
