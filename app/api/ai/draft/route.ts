import { and, desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { MODELS, streamWriting, toAiError } from "@/lib/ai/client";
import { noDash } from "@/lib/ai/clean";
import { AiError, aiErrorMessage } from "@/lib/ai/errors";
import { consumeAiCall } from "@/lib/ai/usage";
import { WRITING_KINDS, splitReview, type WritingKind } from "@/lib/ai/writing";
import { withUser } from "@/lib/db";
import { drafts } from "@/lib/db/schema";
import { getClaims } from "@/lib/supabase/server";
import { loadWritingContext } from "@/lib/writing/context";

// Long pieces from Opus can take a few minutes; the text streams the whole time.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST { jobId, kind } -> streams the text as it is written (plain text), then
// saves it as a new version. Stopping part way saves what was written so far.
export async function POST(request: NextRequest) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { jobId?: string; kind?: string };
  const jobId = String(body.jobId ?? "");
  const kind = body.kind as WritingKind;
  if (!UUID.test(jobId) || !WRITING_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown job or kind of writing." }, { status: 400 });
  }

  const ctx = await withUser(claims, (tx) => loadWritingContext(tx, jobId, kind));
  if (!ctx) return NextResponse.json({ error: "That job could not be found." }, { status: 404 });
  if (!ctx.cv) return NextResponse.json({ error: "Add a CV in My profile first." }, { status: 400 });
  if (kind === "questions" && ctx.job.appQuestions.length === 0) {
    return NextResponse.json({ error: "Add the application form questions first." }, { status: 400 });
  }
  const cvName = ctx.cv.name;

  try {
    await consumeAiCall(claims.sub);
  } catch (e) {
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let failure: string | null = null;
      try {
        const claude = streamWriting(kind, ctx.job.sector, ctx.profileForAi, ctx.user, request.signal);
        claude.on("text", (delta) => {
          text += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const final = await claude.finalMessage();
        if (final.stop_reason === "refusal") failure = new AiError("refused").message;
      } catch (e) {
        // Stopped by the user: keep what was written. Anything else is an error.
        if (!request.signal.aborted) failure = toAiError(e).message;
      }

      if (text.trim()) {
        const { content, review } = splitReview(noDash(text));
        await withUser(claims, async (tx) => {
          const [last] = await tx
            .select({ version: drafts.version })
            .from(drafts)
            .where(and(eq(drafts.jobId, jobId), eq(drafts.kind, kind)))
            .orderBy(desc(drafts.version))
            .limit(1);
          await tx.insert(drafts).values({
            jobId,
            kind,
            content,
            review,
            version: (last?.version ?? 0) + 1,
            cvName,
            model: MODELS.writing,
          });
        }).catch((e) => console.error("[draft] save failed", e));
      }
      // The client watches for this line to show an error under the editor.
      if (failure && !request.signal.aborted) controller.enqueue(encoder.encode(`\n\n[[ERROR]] ${failure}`));
      try {
        controller.close();
      } catch {
        // Already closed because the browser disconnected.
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
