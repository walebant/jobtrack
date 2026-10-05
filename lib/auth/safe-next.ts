// Only allow redirects to paths inside this app, so a crafted
// magic link cannot send someone to another site after sign-in.
export function safeNext(next: string | null | undefined, fallback = "/pipeline"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
