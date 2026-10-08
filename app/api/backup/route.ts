import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import {
  aiUsage,
  cvs,
  drafts,
  evidence,
  fitScores,
  jobDocuments,
  jobSearches,
  jobStatusHistory,
  jobs,
  profiles,
} from "@/lib/db/schema";
import { todayUk } from "@/lib/dates";
import { getClaims } from "@/lib/supabase/server";

// GET -> a JSON file with everything the signed-in user has stored (RLS limits it
// to their own rows). Uploaded files themselves are not included, only their text.
export async function GET() {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const data = await withUser(claims, async (tx) => ({
    profile: (await tx.select().from(profiles))[0] ?? null,
    cvs: await tx.select().from(cvs),
    evidence: await tx.select().from(evidence),
    jobSearch: (await tx.select().from(jobSearches))[0] ?? null,
    jobs: await tx.select().from(jobs),
    jobStatusHistory: await tx.select().from(jobStatusHistory),
    fitScores: await tx.select().from(fitScores),
    drafts: await tx.select().from(drafts),
    jobDocuments: await tx.select().from(jobDocuments),
    aiUsage: await tx.select().from(aiUsage),
  }));

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), app: "Job Search Tracker", version: 1, ...data }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="job-tracker-backup-${todayUk()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
