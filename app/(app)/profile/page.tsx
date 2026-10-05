import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { evidence, profiles } from "@/lib/db/schema";
import { userDb } from "@/lib/db/user";
import { CvPanel } from "./cv-panel";
import { EvidenceBank } from "./evidence-bank";

export const metadata: Metadata = { title: "My profile · Job Search Tracker" };
// CV text extraction can take a few seconds for long PDFs.
export const maxDuration = 60;

export default async function ProfilePage() {
  const { profile, examples, userId } = await userDb(async (tx, userId) => {
    const [profile] = await tx.select().from(profiles).limit(1);
    const examples = await tx.select().from(evidence).orderBy(desc(evidence.createdAt));
    return { profile, examples, userId };
  });

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <CvPanel
        userId={userId}
        cvText={profile?.cvText ?? ""}
        notes={profile?.notes ?? ""}
        hasUpload={Boolean(profile?.cvFilePath)}
        updatedAt={profile?.updatedAt?.toISOString() ?? null}
      />
      <EvidenceBank
        items={examples.map((e) => ({ id: e.id, title: e.title, tags: e.tags, story: e.story }))}
      />
    </div>
  );
}
