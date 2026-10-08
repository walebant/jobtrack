"use server";

import { and, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { notes } from "@/lib/db/schema";
import { requireUserId, userDb } from "@/lib/db/user";

const MAX_NOTE = 10_000;
const MAX_NOTES = 1_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; message: string };

function clean(body: unknown): string | null {
  const text = String(body ?? "").replace(/\r\n/g, "\n").trim();
  return text ? text.slice(0, MAX_NOTE) : null;
}

export async function addNote(body: string): Promise<Result> {
  const text = clean(body);
  if (!text) return { ok: false, message: "Write something first." };
  const added = await userDb(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(notes);
    if (n >= MAX_NOTES) return false;
    await tx.insert(notes).values({ body: text });
    return true;
  });
  if (!added) return { ok: false, message: `You can keep up to ${MAX_NOTES.toLocaleString("en-GB")} notes. Delete some first.` };
  refresh();
  return { ok: true };
}

export async function updateNote(id: string, body: string): Promise<Result> {
  const text = clean(body);
  if (!UUID.test(String(id))) return { ok: false, message: "That note could not be found." };
  if (!text) return { ok: false, message: "A note cannot be empty. Delete it instead." };
  const userId = await requireUserId();
  const rows = await userDb((tx) =>
    tx.update(notes).set({ body: text }).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id }),
  );
  if (!rows.length) return { ok: false, message: "That note could not be found." };
  refresh();
  return { ok: true };
}

export async function setPinned(id: string, pinned: boolean): Promise<Result> {
  if (!UUID.test(String(id))) return { ok: false, message: "That note could not be found." };
  const userId = await requireUserId();
  await userDb((tx) => tx.update(notes).set({ pinned: Boolean(pinned) }).where(and(eq(notes.id, id), eq(notes.userId, userId))));
  refresh();
  return { ok: true };
}

export async function deleteNote(id: string): Promise<Result> {
  if (!UUID.test(String(id))) return { ok: false, message: "That note could not be found." };
  const userId = await requireUserId();
  await userDb((tx) => tx.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))));
  refresh();
  return { ok: true };
}
