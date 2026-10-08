"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { formatUkDate } from "@/lib/dates";
import { FileDrop } from "@/components/file-drop";
import { createClient } from "@/lib/supabase/client";
import { addJobDocument, deleteJobDocument, getJobDocumentLink, readCriteriaFromDocuments } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Doc = { id: string; name: string; chars: number; createdAt: string };

export function JobDocuments({ jobId, userId, documents, hasCriteria }: { jobId: string; userId: string; documents: Doc[]; hasCriteria: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [working, start] = useTransition();

  // Uploads one file; returns false if it was refused or failed.
  async function onFile(file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!TYPES[ext]) {
      setMessage({ text: `"${file.name}" is not a .pdf or .docx file.`, error: true });
      return false;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ text: `"${file.name}" is over 10 MB.`, error: true });
      return false;
    }
    setUploading(true);
    setMessage({ text: `Uploading and reading "${file.name}"…` });
    try {
      const path = `${userId}/${jobId}/${Date.now()}.${ext}`;
      const { error } = await createClient().storage.from("job-docs").upload(path, file, { contentType: TYPES[ext], upsert: false });
      if (error) throw error;
      const result = await addJobDocument(jobId, path, file.name);
      if (!result.ok) {
        setMessage({ text: result.message, error: true });
        return false;
      }
      setMessage({
        text: hasCriteria
          ? "Document added. It will be used when this job is scored and written about."
          : "Document added. Press Read criteria from documents to pull out the person specification.",
      });
      return true;
    } catch {
      setMessage({ text: "The upload failed. Check your connection and try again.", error: true });
      return false;
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Several files (dropped or picked) upload one after another, stopping at the first problem.
  async function uploadMany(files: File[]) {
    for (const file of files) if (!(await onFile(file))) break;
  }

  function download(doc: Doc) {
    start(async () => {
      const result = await getJobDocumentLink(doc.id);
      if (!result.ok) return void toast(result.message);
      // The link carries a download name, so the browser saves the file instead of navigating.
      const a = document.createElement("a");
      a.href = result.url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function remove(doc: Doc) {
    if (!confirm(`Remove "${doc.name}"?`)) return;
    start(async () => {
      const { ok } = await deleteJobDocument(doc.id);
      toast(ok ? "Document removed" : "Could not remove that document.");
    });
  }

  function readCriteria() {
    setMessage({ text: "Reading the documents and scoring. This can take up to a minute…" });
    start(async () => {
      const result = await readCriteriaFromDocuments(jobId);
      setMessage({ text: result.message ?? "", error: result.status === "error" });
    });
  }

  return (
    <FileDrop onFiles={uploadMany} disabled={uploading || working} label="Drop to upload (.pdf or .docx)" className="mb-6">
    <section aria-labelledby="docs-heading" className="rounded-2xl border bg-card p-4">
      <h3 id="docs-heading" className="text-base font-bold">
        Job description and person specification
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag the JD or person specification here, or upload it (.pdf or .docx). Its text is used to score this job and to tailor your writing.
      </p>

      {documents.length > 0 && (
        <ul className="mt-3 divide-y rounded-xl border bg-background">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="text-muted-foreground">
                  {Math.round(d.chars / 6).toLocaleString("en-GB")} words · added {formatUkDate(d.createdAt)}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => download(d)} disabled={working}>
                  Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(d)} disabled={working}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label="Job document file"
          multiple
          onChange={(e) => uploadMany(Array.from(e.target.files ?? []))}
          disabled={uploading}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading || working}>
          {uploading ? "Reading…" : "Upload a document"}
        </Button>
        {documents.length > 0 && (
          <Button onClick={readCriteria} disabled={uploading || working}>
            {working ? "Reading…" : "Read criteria from documents"}
          </Button>
        )}
      </div>
      {message && <StatusLine message={message.text} error={message.error} />}
    </section>
    </FileDrop>
  );
}
