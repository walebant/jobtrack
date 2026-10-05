// Dates are worked out in UK time, not the server's or browser's time zone.
export const UK_TZ = "Europe/London";

// Today's date in the UK as YYYY-MM-DD.
export function todayUk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: UK_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// "5 Oct 2026" from YYYY-MM-DD (or an ISO timestamp).
export function formatUkDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" && value.length === 10 ? new Date(value + "T12:00:00Z") : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
}
