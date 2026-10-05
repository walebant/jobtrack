"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import { Panel, StatusLine } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUkDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { submitWithoutReset } from "@/lib/forms-client";
import { extractUploadedCv, saveProfile, type FormState } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Props = { userId: string; cvText: string; notes: string; hasUpload: boolean; updatedAt: string | null };

export function CvPanel({ userId, cvText, notes, hasUpload, updatedAt }: Props) {
  const [state, action, saving] = useActionState<FormState, FormData>(saveProfile, { status: "idle" });
  const [cv, setCv] = useState(cvText);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; error?: boolean }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const words = cv.trim() ? cv.trim().split(/\s+/).length : 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!TYPES[ext]) return setUploadMsg({ text: "Upload a .pdf or .docx file.", error: true });
    if (file.size > MAX_BYTES) return setUploadMsg({ text: "That file is over 10 MB. Upload a smaller copy.", error: true });

    setUploading(true);
    setUploadMsg({ text: "Uploading and reading your CV…" });
    try {
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("cvs")
        .upload(path, file, { contentType: TYPES[ext], upsert: false });
      if (error) throw error;

      const result = await extractUploadedCv(path);
      if (!result.ok) return setUploadMsg({ text: result.message, error: true });
      setCv(result.text);
      setUploadMsg({ text: "CV text added below. Check it, then save your profile." });
      toast("CV text added. Check it, then save.");
    } catch {
      setUploadMsg({ text: "The upload failed. Check your connection and try again.", error: true });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Panel title="Master CV" hint="Paste your full CV, or upload it. Scoring and drafting use this, so keep it complete and up to date.">
      <form onSubmit={(e) => submitWithoutReset(e, action)} className="mt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileRef}
            id="cvFile"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={uploading}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Reading CV…" : hasUpload ? "Upload a new CV" : "Upload CV (.pdf or .docx)"}
          </Button>
          <span className="text-sm text-muted-foreground">The text replaces what is in the box below.</span>
        </div>
        {uploadMsg && <StatusLine message={uploadMsg.text} error={uploadMsg.error} />}

        <Label htmlFor="cvText" className="mt-3 mb-1.5 text-muted-foreground">
          CV text {words > 0 && <span className="font-normal">({words.toLocaleString("en-GB")} words)</span>}
        </Label>
        <Textarea
          id="cvText"
          name="cvText"
          value={cv}
          onChange={(e) => setCv(e.target.value)}
          placeholder="Paste your full CV here"
          className="min-h-80 bg-background"
        />

        <Label htmlFor="notes" className="mt-3 mb-1.5 text-muted-foreground">
          Anything else Claude should know
        </Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={notes}
          placeholder="For example: roles you are targeting, training in progress"
          className="min-h-24 bg-background"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || uploading}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
          {updatedAt && state.status === "idle" && (
            <span className="text-sm text-muted-foreground">Last saved {formatUkDate(updatedAt)}</span>
          )}
        </div>
        {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
      </form>
    </Panel>
  );
}
