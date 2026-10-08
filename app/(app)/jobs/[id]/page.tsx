import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, ClosingChip, InterviewChip } from "@/components/chips";
import { StatusSelect } from "@/components/status-select";
import { CriterionCard, FitDial, VERDICT_LABEL, scoreTone, sortCriteria } from "@/components/fit";
import { formatUkDate } from "@/lib/dates";
import { getJobDetail } from "@/lib/db/queries";
import { userDb } from "@/lib/db/user";
import { NO_CRITERIA_MESSAGE, NO_CV_MESSAGE } from "@/lib/jobs/score";
import { closingDateMatters, inStageGroup, interviewInfo } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import { DecisionButtons } from "../../find/decision-buttons";
import { AdvertEditor } from "./advert-editor";
import { OverviewTab } from "./overview-tab";
import { ScoreButton } from "./score-button";

export const metadata: Metadata = { title: "Job · Job Search Tracker" };
// Scoring and re-reading call Claude and can take up to a minute.
export const maxDuration = 120;

const TABS = [
  ["overview", "Overview"],
  ["fit", "Fit score"],
  ["advert", "Advert"],
] as const;
type Tab = (typeof TABS)[number][0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const { tab: tabParam } = await props.searchParams;
  if (!UUID.test(id)) notFound();
  const detail = await userDb((tx) => getJobDetail(tx, id));
  if (!detail) notFound();
  const { job, scores, history, hasCv } = detail;
  // Before applying, the fit score matters most; after, the overview (interview, notes, history).
  const defaultTab: Tab = inStageGroup(job.status, "active") ? "fit" : "overview";
  const tab: Tab = TABS.some(([k]) => k === tabParam) ? (tabParam as Tab) : defaultTab;
  const interview = interviewInfo(job.interviewDate, job.interviewTime);

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
            job={{
              ...job,
              submittedAt: job.submittedAt?.toISOString() ?? null,
            }}
            history={history.map((h) => ({ status: h.status, changedAt: h.changedAt.toISOString() }))}
          />
        ) : tab === "fit" ? (
          <FitTab jobId={job.id} hasCv={hasCv} hasCriteria={job.essential.length + job.desirable.length > 0} scores={scores} />
        ) : (
          <AdvertEditor jobId={job.id} advert={job.advertText} essential={job.essential} desirable={job.desirable} />
        )}
      </section>
    </div>
  );
}

type Scores = NonNullable<Awaited<ReturnType<typeof getJobDetail>>>["scores"];

function FitTab({ jobId, hasCv, hasCriteria, scores }: { jobId: string; hasCv: boolean; hasCriteria: boolean; scores: Scores }) {
  const blocked = !hasCv ? NO_CV_MESSAGE : !hasCriteria ? NO_CRITERIA_MESSAGE : null;
  const [latest, ...earlier] = scores;

  if (!latest) {
    return (
      <div>
        <p>Check this job against your CV and evidence bank, criterion by criterion.</p>
        {blocked ? (
          <p className="mt-2 text-mid">
            {blocked}{" "}
            {!hasCv ? (
              <Link href="/profile" className="underline underline-offset-2">
                Go to My profile
              </Link>
            ) : (
              <Link href={`/jobs/${jobId}?tab=advert`} className="underline underline-offset-2">
                Go to the Advert tab
              </Link>
            )}
          </p>
        ) : (
          <ScoreButton jobId={jobId} label="Score this job" className="mt-3" />
        )}
      </div>
    );
  }

  const tone = scoreTone(latest.score);
  return (
    <div>
      <div className="mb-4 grid items-center gap-[18px] sm:grid-cols-[auto_1fr]">
        <FitDial score={latest.score} />
        <div>
          <div className={cn("font-heading text-[22px] font-bold", tone === "good" ? "text-good" : tone === "mid" ? "text-mid" : "text-bad")}>
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

      <p className="mt-3 text-sm text-muted-foreground">Scored {formatUkDate(latest.createdAt)}</p>
      {blocked ? <p className="mt-2 text-sm text-mid">{blocked}</p> : <ScoreButton jobId={jobId} label="Score again" className="mt-3" />}

      {earlier.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium">Earlier scores ({earlier.length})</summary>
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
