import mammoth from "mammoth";

export const MAX_CV_BYTES = 10 * 1024 * 1024;
const MAX_CV_CHARS = 60_000;

export type CvKind = "pdf" | "docx";

// Decide by the file's first bytes, not its name: PDFs start with "%PDF",
// .docx files are zip archives starting with "PK".
export function detectCvKind(buf: Uint8Array): CvKind | null {
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "docx";
  return null;
}

// Plain text from an uploaded CV, tidied for the CV box.
export async function extractCvText(buf: Buffer): Promise<string> {
  const kind = detectCvKind(buf);
  if (!kind) throw new Error("unsupported");
  const raw = kind === "docx" ? (await mammoth.extractRawText({ buffer: buf })).value : await pdfText(buf);
  return tidyText(raw).slice(0, MAX_CV_CHARS);
}

async function pdfText(buf: Buffer): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed for PDF uploads.
  const { PDFParse } = await import("pdf-parse");
  const { CanvasFactory, getPath } = await import("pdf-parse/worker");
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: new Uint8Array(buf), CanvasFactory });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/[ \t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
