// PRD writing rule: no em dashes anywhere. Prompts ask for this, and every
// AI string goes through here before it is saved, in case one slips through.
// Spaces and tabs only, so line breaks around a dash are kept.
const EM_DASH = /[ \t]*—[ \t]*/g;

export function noDash(text: string): string {
  if (!text.includes("—")) return text;
  return text
    .replace(EM_DASH, ", ")
    .replace(/,[ \t]*,/g, ",") // "word, — next" -> "word, next"
    .replace(/,[ \t]*([.!?;:])/g, "$1") // "word —." -> "word."
    .replace(/^,[ \t]*/gm, "") // a dash at the start of a line
    .replace(/,[ \t]*$/gm, "") // a dash at the end of a line
    .replace(/ {2,}/g, " ");
}

// Cleans every string inside an AI reply (objects, arrays, nested values).
export function cleanDeep<T>(value: T): T {
  if (typeof value === "string") return noDash(value) as T;
  if (Array.isArray(value)) return value.map(cleanDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanDeep(v)])) as T;
  }
  return value;
}
