import { cn } from "@/lib/utils";
import { closingInfo, type ClosingTone } from "@/lib/jobs/closing";

const TONE: Record<ClosingTone, string> = {
  bad: "bg-bad-bg text-bad",
  mid: "bg-mid-bg text-mid",
  neutral: "bg-muted text-foreground",
};

export function Chip({ tone = "neutral", children, className }: { tone?: ClosingTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap", TONE[tone], className)}>{children}</span>
  );
}

export function ClosingChip({ closingDate }: { closingDate: string | null }) {
  const info = closingInfo(closingDate);
  return info ? <Chip tone={info.tone}>{info.label}</Chip> : null;
}
