// Splits text into plain parts and links, so links can be shown as clickable
// without injecting HTML. Only http(s) links and "www." links are recognised.
export type TextPart = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Punctuation that usually ends a sentence rather than the link.
const TRAILING = /[.,;:!?)\]}'"]+$/;

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    // Keep a closing bracket that belongs to the link, as in .../Foo_(bar).
    const keepBracket = trail.startsWith(")") && raw.includes("(");
    if (trail && !keepBracket) raw = raw.slice(0, raw.length - trail.length);
    const start = m.index ?? 0;
    if (start > last) parts.push({ type: "text", text: text.slice(last, start) });
    const href = raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw;
    parts.push({ type: "link", text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

// "jobs.nhs.uk" from a link, for a short label.
export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
