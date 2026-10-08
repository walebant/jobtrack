// Browser-side downloads of a draft as .docx or .txt.

export function fileStem(title: string, kind: string) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${slug(title) || "job"}-${slug(kind)}`;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadTxt(text: string, stem: string) {
  save(new Blob([text.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" }), `${stem}.txt`);
}

// A line on its own that is short and does not end like a sentence reads as a heading.
export function isHeading(line: string, next: string | undefined) {
  const t = line.trim();
  return t.length > 0 && t.length <= 80 && !t.startsWith("- ") && !/[.,;:!?]$/.test(t) && next !== undefined && next.trim() !== "";
}

export async function downloadDocx(text: string, stem: string) {
  // Loaded only when needed: the docx library is large.
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const children = lines.map((line, i) => {
    const t = line.trim();
    if (!t) return new Paragraph({ children: [] });
    if (t.startsWith("- ")) return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(t.slice(2))] });
    if (isHeading(t, lines[i + 1])) return new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: t, bold: true })] });
    return new Paragraph({ spacing: { after: 120 }, children: [new TextRun(t)] });
  });
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{ children }],
  });
  save(await Packer.toBlob(doc), `${stem}.docx`);
}
