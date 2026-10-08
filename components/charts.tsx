import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small, single-series charts in plain HTML (no chart library). One brand colour,
// thin bars with 4px rounded ends, values in text colours, a native tooltip on
// every bar, and a table view for screen readers and exact numbers.

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-sans text-[28px] leading-tight font-semibold tabular-nums">{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

export function ChartCard({ title, hint, children, table }: { title: string; hint?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-[18px]">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          {head.map((h) => (
            <th key={h} className="border-b px-2 py-1.5 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {r.map((c, j) => (
              <td key={j} className={cn("px-2 py-1.5", j > 0 && "tabular-nums")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Vertical columns over a shared baseline, value on each non-zero cap.
export function ColumnChart({ data, label }: { data: { label: string; value: number; tooltip: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-36 items-end gap-1 border-b border-border">
        {data.map((d) => (
          <div key={d.label} title={d.tooltip} className="flex h-full flex-1 flex-col items-center justify-end">
            {d.value > 0 && <span className="mb-1 text-xs text-muted-foreground tabular-nums">{d.value}</span>}
            <div
              className="w-full max-w-6 rounded-t-[4px] bg-primary"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[11px] text-muted-foreground">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export type BarRow = {
  label: string;
  value: number; // drawn as a share of max
  valueLabel: string; // shown at the end of the bar
  tooltip: string;
  href?: string;
  note?: string;
};

// Horizontal bars: label, bar on a light track, value in text at the end.
export function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="space-y-2.5">
      {rows.map((r) => {
        const name = r.href ? (
          <Link href={r.href} className="underline-offset-2 hover:underline">
            {r.label}
          </Link>
        ) : (
          r.label
        );
        return (
          <li key={r.label} title={r.tooltip} className="grid grid-cols-[minmax(84px,34%)_1fr_7.5rem] items-center gap-2.5 text-sm">
            <span className="truncate">{name}</span>
            <span className="h-3 overflow-hidden rounded-[4px] bg-muted" aria-hidden>
              <span className="block h-full rounded-[4px] bg-primary" style={{ width: `${Math.min(100, (r.value / top) * 100)}%` }} />
            </span>
            <span className="text-right text-muted-foreground tabular-nums">
              {r.valueLabel}
              {r.note && <span className="block text-[11px]">{r.note}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
