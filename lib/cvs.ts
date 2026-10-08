import { asc, desc } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { cvs, type Cv } from "@/lib/db/schema";

// The user's CVs, default first, then oldest first.
export function listCvs(tx: Tx) {
  return tx.select().from(cvs).orderBy(desc(cvs.isDefault), asc(cvs.createdAt));
}

// The CV a job uses: the one asked for, else the job's chosen CV, else the
// default, else the first. Only CVs with text count.
export function pickCv(all: Cv[], ...preferred: (string | null | undefined)[]): Cv | null {
  const usable = all.filter((c) => c.cvText.trim());
  for (const id of preferred) {
    const found = id ? usable.find((c) => c.id === id) : undefined;
    if (found) return found;
  }
  return usable.find((c) => c.isDefault) ?? usable[0] ?? null;
}
