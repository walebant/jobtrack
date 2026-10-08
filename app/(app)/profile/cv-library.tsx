"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileDrop } from "@/components/file-drop";
import { Panel, StatusLine } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUkDate } from "@/lib/dates";
import { submitWithoutReset } from "@/lib/forms-client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createCv, deleteCv, extractUploadedCv, saveCv, setDefaultCv, type FormState } from "./actions";

type CvItem = {
  id: string;
  name: string;
  focus: string;
  cvText: string;
  isDefault: boolean;
  hasFile: boolean;
  updatedAt: string;
};

export function CvLibrary({ userId, cvs, selectedId }: { userId: string; cvs: CvItem[]; selectedId: string | null }) {
  const router = useRouter();
  const [creating, startCreate] = useTransition();
  const selected = cvs.find((c) => c.id === selectedId) ?? null;

  function create(copyFrom?: string) {
    startCreate(async () => {
      const result = await createCv(copyFrom);
      if (!result.ok) return void toast(result.message);
      toast(copyFrom ? "CV copied" : "New CV added");
      router.push(`/profile?cv=${result.id}`);
    });
  }

  return (
    <Panel
      title="My CVs"
      hint="Keep a CV for each kind of role you apply for. Each job is scored and written with one of them; new jobs use your default."
    >
      <div className="mt-3 flex flex-wrap gap-1.5" role="list" aria-label="Your CVs">
        {cvs.map((c) => (
          <Link
            key={c.id}
            role="listitem"
            href={`/profile?cv=${c.id}`}
            aria-current={c.id === selected?.id ? "true" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium",
              c.id === selected?.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-muted-foreground",
            )}
          >
            {c.name}
            {c.isDefault && <span className="ml-1.5 text-xs opacity-80">(default)</span>}
          </Link>
        ))}
        <Button variant="outline" size="sm" className="h-auto py-1.5" onClick={() => create()} disabled={creating}>
          + New CV
        </Button>
      </div>

      {selected ? (
        <CvEditor key={selected.id} cv={selected} userId={userId} onDuplicate={() => create(selected.id)} busy={creating} />
      ) : (
        <p className="mt-4 text-muted-foreground">No CVs yet. Add one to start scoring jobs.</p>
      )}
    </Panel>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function CvEditor({ cv, userId, onDuplicate, busy }: { cv: CvItem; userId: string; onDuplicate: () => void; busy: boolean }) {
  const router = useRouter();
  const [state, action, saving] = useActionState<FormState, FormData>(saveCv, { status: "idle" });
  const [text, setText] = useState(cv.cvText);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; error?: boolean }>();
  const [working, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!TYPES[ext]) return setUploadMsg({ text: "Upload a .pdf or .docx file.", error: true });
    if (file.size > MAX_BYTES) return setUploadMsg({ text: "That file is over 10 MB. Upload a smaller copy.", error: true });
    setUploading(true);
    setUploadMsg({ text: "Uploading and reading your CV…" });
    try {
      const path = `${userId}/${cv.id}/${Date.now()}.${ext}`;
      const { error } = await createClient().storage.from("cvs").upload(path, file, { contentType: TYPES[ext], upsert: false });
      if (error) throw error;
      const result = await extractUploadedCv(path, cv.id);
      if (!result.ok) return setUploadMsg({ text: result.message, error: true });
      setText(result.text);
      setUploadMsg({ text: "CV text added below. Check it, then save." });
    } catch {
      setUploadMsg({ text: "The upload failed. Check your connection and try again.", error: true });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function makeDefault() {
    start(async () => {
      const { ok } = await setDefaultCv(cv.id);
      toast(ok ? `"${cv.name}" is now your default CV` : "Could not change the default.");
    });
  }

  function remove() {
    if (!confirm(`Delete "${cv.name}"? Jobs using it will switch to your default CV.`)) return;
    start(async () => {
      const { ok } = await deleteCv(cv.id);
      toast(ok ? "CV deleted" : "Could not delete that CV.");
      if (ok) router.push("/profile");
    });
  }

  return (
    <form onSubmit={(e) => submitWithoutReset(e, action)} className="mt-4 border-t pt-3">
      <input type="hidden" name="id" value={cv.id} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {cv.isDefault ? <Badge>Default CV</Badge> : null}
        <span>Last saved {formatUkDate(cv.updatedAt)}</span>
      </div>
      <div className="grid gap-x-3.5 sm:grid-cols-2">
        <div>
          <Label htmlFor="cvName" className="mt-3 mb-1.5 text-muted-foreground">
            CV name
          </Label>
          <Input id="cvName" name="name" defaultValue={cv.name} required maxLength={80} className="h-10 bg-background" />
        </div>
        <div>
          <Label htmlFor="cvFocus" className="mt-3 mb-1.5 text-muted-foreground">
            What this CV is for (optional)
          </Label>
          <Input
            id="cvFocus"
            name="focus"
            defaultValue={cv.focus}
            maxLength={500}
            placeholder="For example: data and analyst roles"
            className="h-10 bg-background"
          />
        </div>
      </div>

      <FileDrop onFiles={(files) => onFile(files[0])} disabled={uploading} label="Drop your CV to upload it" className="mt-3">
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed bg-background px-3 py-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            aria-label="CV file"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={uploading}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Reading CV…" : cv.hasFile ? "Upload a new file" : "Upload CV (.pdf or .docx)"}
          </Button>
          <span className="text-sm text-muted-foreground">or drag the file here. The text replaces what is in the box below.</span>
        </div>
      </FileDrop>
      {uploadMsg && <StatusLine message={uploadMsg.text} error={uploadMsg.error} />}

      <Label htmlFor="cvText" className="mt-3 mb-1.5 text-muted-foreground">
        CV text {words > 0 && <span className="font-normal">({words.toLocaleString("en-GB")} words)</span>}
      </Label>
      <Textarea
        id="cvText"
        name="cvText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste this CV here"
        className="min-h-80 bg-background"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save CV"}
        </Button>
        {!cv.isDefault && (
          <Button type="button" variant="outline" onClick={makeDefault} disabled={working}>
            Make default
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onDuplicate} disabled={busy}>
          Duplicate
        </Button>
        <Button type="button" variant="destructive" onClick={remove} disabled={working}>
          Delete
        </Button>
      </div>
      {state.status !== "idle" && <StatusLine message={state.message} error={state.status === "error"} />}
    </form>
  );
}
