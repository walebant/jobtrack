import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { notes } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";
import { NotesBoard } from "./notes-board";

export const metadata: Metadata = { title: "Notes · Job Search Tracker" };

export default async function NotesPage() {
  const rows = await userDb((tx) => tx.select().from(notes).orderBy(desc(notes.pinned), desc(notes.createdAt)));
  return (
    <NotesBoard
      notes={rows.map((n) => ({
        id: n.id,
        body: n.body,
        pinned: n.pinned,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
