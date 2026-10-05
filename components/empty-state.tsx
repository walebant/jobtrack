import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card px-6 py-10 text-center">
      <h2 className="mb-1.5 text-xl font-bold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
