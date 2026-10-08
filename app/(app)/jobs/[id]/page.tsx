import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, ClosingChip, InterviewChip } from "@/components/chips";
import { CriterionCard, FitChip, FitDial, VERDICT_LABEL, scoreTone, sortCriteria } from "@/components/fit";
import { StatusSelect } from "@/components/status-select";
import { formatUkDate } from "@/lib/dates";
import { getJobDetail } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { NO_CRITERIA_MESSAGE, NO_CV_MESSAGE } from "@/lib/jobs/score";
import { WRITING_KINDS, type WritingKind } from "@/lib/ai/writing";
import { APPLIED_STATUSES, closingDateMatters, inStageGroup, interviewInfo } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import { DecisionButtons } from "../../find/decision-buttons";
import { AdvertEditor } from "./advert-editor";
import { CompareCvs, CvPicker, UseCvButton } from "./cv-controls";
import { JobDocuments } from "./documents";
import { OverviewTab } from "./overview-tab";
import { ScoreButton } from "./score-button";
import { WritingTab } from "./writing-tab";

export const metadata: Metadata = { title: "Job · Job Search Tracker" };
// Scoring and re-reading call Claude and can take up to a minute.
export const maxDuration = 120;

const TABS = [
  ["overview", "Overview"],
  ["fit", "Fit score"],
  ["writing", "Writing"],
  ["advert", "Advert and documents"],
] as const;
type Tab = (typeof TABS)[number][0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Detail = NonNullable<Awaited<ReturnType<typeof getJobDetail>>>;

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const { tab: tabParam, piece: pieceParam } = await props.searchParams;
  const piece: WritingKind = WRITING_KINDS.includes(pieceParam as WritingKind) ? (pieceParam as WritingKind) : "statement";
  if (!UUID.test(id)) notFound();
  const result = await userDb(async (tx, userId) => ({ detail: await getJobDetail(tx, id), userId }));
  if (!result.detail) notFound();
  const { detail, userId } = result;
  const { job, history } = detail;
  // Before applying, the fit score matters most; after, the overview (interview, notes, history).
  const defaultTab: Tab = inStageGroup(job.status, "active") ? "fit" : "overview";
  const tab: Tab = TABS.some(([k]) => k === tabParam) ? (tabParam as Tab) : defaultTab;
  const interview = interviewInfo(job.interviewDate, job.interviewTime);
  const hasCriteria = job.essential.length + job.desirable.length > 0;

  return (
    <div className="mx-auto max-w-[760px]">
      <Link
        href={job.inbox === "suggested" ? "/find" : "/pipeline"}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        ← Back to {job.inbox === "suggested" ? "suggested jobs" : "pipeline"}
      </Link>

      {job.inbox === "suggested" && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-card px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Suggested from NHS Jobs.</span> Save it to your pipeline to track it, or dismiss it.
          </p>
          <DecisionButtons jobId={job.id} title={job.title} />
        </div>
      )}
      {job.inbox === "dismissed" && (
        <p className="mt-2 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">You dismissed this suggestion.</p>
      )}

      <header className="mt-2 rounded-2xl border bg-card px-4 pt-4 sm:px-[18px]">
        <h2 className="text-[21px] font-bold">{job.title || "Untitled job"}</h2>
        <p className="text-muted-foreground">{[job.employer, job.band, job.salary].filter(Boolean).join(" · ")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusSelect jobId={job.id} status={job.status} title={job.title} />
          {interview && <InterviewChip info={interview} />}
          {job.closingDate && <Chip>Closes {formatUkDate(job.closingDate)}</Chip>}
          {closingDateMatters(job.status) && <ClosingChip closingDate={job.closingDate} />}
          {job.location && <Chip>{job.location}</Chip>}
          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">
              Open advert
            </a>
          )}
        </div>
        <nav aria-label="Job sections" className="mt-3 flex gap-0.5 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/jobs/${job.id}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "border-b-2 border-transparent px-3 py-2 font-medium whitespace-nowrap text-muted-foreground",
                tab === key && "border-primary text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="pt-4 pb-10">
        {tab === "overview" ? (
          <OverviewTab
            job={{ ...job, submittedAt: job.submittedAt?.toISOString() ?? null }}
            history={history.map((h) => ({ status: h.status, changedAt: h.changedAt.toISOString() }))}
          />
        ) : tab === "fit" ? (
          <FitTab detail={detail} hasCriteria={hasCriteria} />
        ) : tab === "writing" ? (
          <WritingTab
            jobId={job.id}
            jobTitle={job.title}
            piece={piece}
            applied={APPLIED_STATUSES.has(job.status)}
            cvName={detail.cv?.name ?? null}
            whyNotes={job.whyNotes}
            writeLimit={job.writeLimit}
            writeLimitUnit={job.writeLimitUnit}
            questions={job.writingQa[piece] ?? []}
            versions={detail.drafts
              .filter((d) => d.kind === piece)
              .map((d) => ({
                id: d.id,
                kind: d.kind,
                version: d.version,
                content: d.content,
                review: d.review,
                isSent: d.isSent,
                cvName: d.cvName,
                model: d.model,
                createdAt: d.createdAt.toISOString(),
              }))}
          />
        ) : (
          <>
            <JobDocuments
              jobId={job.id}
              userId={userId}
              hasCriteria={hasCriteria}
              documents={detail.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
            />
            <AdvertEditor jobId={job.id} advert={job.advertText} essential={job.essential} desirable={job.desirable} />
          </>
        )}
      </section>
    </div>
  );
}

function FitTab({ detail, hasCriteria }: { detail: Detail; hasCriteria: boolean }) {
  const { job, scores, cvs, cv, hasCv } = detail;
  const blocked = !hasCv ? NO_CV_MESSAGE : !hasCriteria ? NO_CRITERIA_MESSAGE : null;
  const defaultId = cvs.find((c) => c.isDefault)?.id ?? null;
  // Scores from before CVs existed were made with what is now the default CV.
  const cvOf = (s: Detail["scores"][number]) => s.cvId ?? defaultId;
  const forThisCv = cv ? scores.filter((s) => cvOf(s) === cv.id) : [];
  const [latest, ...earlier] = forThisCv;
  // Newest score per other CV, for comparing.
  const others = cvs
    .filter((c) => c.id !== cv?.id)
    .map((c) => ({ cv: c, score: scores.find((s) => cvOf(s) === c.id) }))
    .filter((o) => o.score);

  const blockedNote = blocked && (
    <p className="mt-2 text-mid">
      {blocked}{" "}
      <Link href={!hasCv ? "/profile" : `/jobs/${job.id}?tab=advert`} className="underline underline-offset-2">
        {!hasCv ? "Go to My profile" : "Go to Advert and documents"}
      </Link>
    </p>
  );

  return (
    <div>
      {hasCv && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <CvPicker jobId={job.id} cvs={cvs} chosenId={job.cvId} />
          {!blocked && <CompareCvs jobId={job.id} cvs={cvs} />}
        </div>
      )}

      {!latest ? (
        <div>
          <p>
            Check this job against {cv ? `your "${cv.name}" CV` : "your CV"} and evidence bank, criterion by criterion.
          </p>
          {blockedNote || <ScoreButton jobId={job.id} label="Score this job" className="mt-3" />}
        </div>
      ) : (
        <>
          <div className="mb-4 grid items-center gap-[18px] sm:grid-cols-[auto_1fr]">
            <FitDial score={latest.score} />
            <div>
              <div className={cn("font-heading text-[22px] font-bold", { good: "text-good", mid: "text-mid", bad: "text-bad" }[scoreTone(latest.score)])}>
                {VERDICT_LABEL[latest.verdict]}
              </div>
              <p className="mt-1.5">{latest.summary}</p>
            </div>
          </div>
          <div className="space-y-2">
            {sortCriteria(latest.criteria).map((c, i) => (
              <CriterionCard key={`${c.type}-${i}`} c={c} />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Scored {formatUkDate(latest.createdAt)}
            {latest.cvName ? ` with "${latest.cvName}"` : ""}
          </p>
          {blockedNote || <ScoreButton jobId={job.id} label="Score again" className="mt-3" />}
        </>
      )}

      {others.length > 0 && (
        <section aria-labelledby="other-cvs" className="mt-6">
          <h3 id="other-cvs" className="mb-2 text-base font-bold">
            Scores with your other CVs
          </h3>
          <ul className="divide-y rounded-xl border bg-card">
            {others.map(({ cv: c, score }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <FitChip score={score!.score} />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {VERDICT_LABEL[score!.verdict].toLowerCase()}, {formatUkDate(score!.createdAt)}
                  </span>
                </span>
                {c.usable && <UseCvButton jobId={job.id} cvId={c.id} name={c.name} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {earlier.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium">Earlier scores with this CV ({earlier.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {earlier.map((s) => (
              <li key={s.id}>
                {formatUkDate(s.createdAt)}: {s.score}/10, {VERDICT_LABEL[s.verdict].toLowerCase()}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
