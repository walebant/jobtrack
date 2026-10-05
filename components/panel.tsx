import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, hint, children, className }: { title?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 sm:p-[18px]", className)}>
      {title && <h2 className="text-[19px] font-bold">{title}</h2>}
      {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

// Status line under a form: errors in red, everything else muted. Announced to screen readers.
export function StatusLine({ message, error, className }: { message?: string; error?: boolean; className?: string }) {
  return (
    <p role="status" className={cn("mt-2 min-h-5 text-sm", error ? "text-destructive" : "text-muted-foreground", className)}>
      {message}
    </p>
  );
}
