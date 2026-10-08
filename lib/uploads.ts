import { MAX_CV_BYTES, extractCvText } from "@/lib/cv/extract";
import { createClient } from "@/lib/supabase/server";

export type Bucket = "cvs" | "job-docs";
export type ReadResult = { ok: true; text: string } | { ok: false; message: string };

// Reads the text of a .pdf or .docx the browser has just uploaded to one of the
// private buckets. Runs with the user's own session, so storage RLS only lets
// them read their own folder. Unreadable files are removed again.
export async function readUploadedText(bucketName: Bucket, path: string, userId: string): Promise<ReadResult> {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) {
    return { ok: false, message: "That upload could not be found. Try again." };
  }
  const bucket = (await createClient()).storage.from(bucketName);
  const { data: file, error } = await bucket.download(path);
  if (error || !file) return { ok: false, message: "That upload could not be found. Try again." };
  if (file.size > MAX_CV_BYTES) {
    await bucket.remove([path]);
    return { ok: false, message: "That file is over 10 MB. Upload a smaller copy." };
  }

  let text = "";
  try {
    text = await extractCvText(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("[upload] text extraction failed", e);
  }
  if (!text) {
    await bucket.remove([path]);
    return { ok: false, message: "No text could be read from that file. If it is a scanned PDF, paste the text instead." };
  }
  return { ok: true, text };
}

export async function removeUploads(bucketName: Bucket, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await (await createClient()).storage.from(bucketName).remove(list);
}
