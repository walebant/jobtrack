import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { listCvs } from "@/lib/cvs";
import { evidence, profiles } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";
import { CvLibrary } from "./cv-library";
import { EvidenceBank } from "./evidence-bank";
import { NotesPanel } from "./notes-panel";

export const metadata: Metadata = { title: "My profile · Job Search Tracker" };
// CV text extraction can take a few seconds for long PDFs.
export const maxDuration = 60;

export default async function ProfilePage(props: PageProps<"/profile">) {
  const { cv: selectedParam } = await props.searchParams;
  const { cvList, notes, examples, userId } = await userDb(async (tx, userId) => {
    const [profile] = await tx.select({ notes: profiles.notes }).from(profiles).limit(1);
    return {
      cvList: await listCvs(tx),
      notes: profile?.notes ?? "",
      examples: await tx.select().from(evidence).orderBy(desc(evidence.createdAt)),
      userId,
    };
  });
  const selected = cvList.find((c) => c.id === selectedParam) ?? cvList[0] ?? null;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <div className="space-y-3.5">
        <CvLibrary
          userId={userId}
          cvs={cvList.map((c) => ({
            id: c.id,
            name: c.name,
            focus: c.focus,
            cvText: c.cvText,
            isDefault: c.isDefault,
            hasFile: Boolean(c.filePath),
            updatedAt: c.updatedAt.toISOString(),
          }))}
          selectedId={selected?.id ?? null}
        />
        <NotesPanel notes={notes} />
      </div>
      <EvidenceBank items={examples.map((e) => ({ id: e.id, title: e.title, tags: e.tags, story: e.story }))} />
    </div>
  );
}
