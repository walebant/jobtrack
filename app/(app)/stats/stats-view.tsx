import { BarList, ChartCard, ColumnChart, DataTable, StatTile, type BarRow } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { JOB_STATUSES } from "@/lib/jobs/stages";
import { STAGE_GROUPS, STATUS_LABEL, inStageGroup, type StageGroup } from "@/lib/jobs/status";
import type { RateRow, Stats } from "@/lib/stats";

const pct = (n: number | null) => (n === null ? "–" : `${n}%`);

function rateRows(rows: RateRow[]): BarRow[] {
  return rows.map((r) => ({
    label: r.label,
    value: r.rate ?? 0,
    valueLabel: pct(r.rate),
    note: `${r.shortlisted} of ${r.applied}`,
    tooltip: `${r.label}: ${r.shortlisted} of ${r.applied} applications shortlisted (${pct(r.rate)})`,
  }));
}

function rateTable(rows: RateRow[], first: string) {
  return <DataTable head={[first, "Applied", "Shortlisted", "Rate"]} rows={rows.map((r) => [r.label, r.applied, r.shortlisted, pct(r.rate)])} />;
}

// Which pipeline tab a stage lives in, for the "Jobs by stage" links.
function groupOf(status: (typeof JOB_STATUSES)[number]): StageGroup {
  return (["active", "applied", "offers", "closed"] as StageGroup[]).find((g) => inStageGroup(status, g)) ?? "all";
}

// The charts, from computed stats (kept separate so they can be previewed with sample data).
export function StatsView({ s }: { s: Stats }) {
  const weekLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Jobs tracked" value={String(s.tracked)} />
        <StatTile label="Applications sent" value={String(s.applied)} />
        <StatTile label="Shortlist rate" value={pct(s.shortlistRate)} note={s.applied ? `${s.shortlisted} of ${s.applied} applications` : "No applications yet"} />
        <StatTile label="Interviews" value={String(s.interviews)} />
        <StatTile label="Offers" value={String(s.offers)} />
        <StatTile
          label="Average fit score"
          value={s.avgScore === null ? "–" : `${s.avgScore}`}
          note={s.scoredCount ? `across ${s.scoredCount} scored job${s.scoredCount === 1 ? "" : "s"}` : "No jobs scored yet"}
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <ChartCard
          title="Applications per week"
          hint="The last 8 weeks, by the date each application was sent"
          table={<DataTable head={["Week starting", "Applications"]} rows={s.perWeek.map((w) => [weekLabel(w.weekStart), w.count])} />}
        >
          <ColumnChart
            label={`Applications per week for the last 8 weeks: ${s.perWeek.map((w) => `${weekLabel(w.weekStart)} ${w.count}`).join(", ")}`}
            data={s.perWeek.map((w) => ({
              label: weekLabel(w.weekStart),
              value: w.count,
              tooltip: `Week starting ${weekLabel(w.weekStart)}: ${w.count} application${w.count === 1 ? "" : "s"}`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="From application to offer"
          hint="How many applications reached each stage, and how many dropped off between stages"
          table={<DataTable head={["Stage", "Applications", "Share of applied"]} rows={s.funnel.map((f) => [f.label, f.count, pct(s.applied ? Math.round((f.count / s.applied) * 100) : null)])} />}
        >
          {s.applied === 0 ? (
            <p className="text-sm text-muted-foreground">Move a job to Submitted to start this chart.</p>
          ) : (
            <BarList
              label="Applications reaching each stage"
              max={s.applied}
              rows={s.funnel.map((f, i) => {
                const prev = i ? s.funnel[i - 1].count : null;
                const kept = prev ? Math.round((f.count / prev) * 100) : null;
                return {
                  label: f.label,
                  value: f.count,
                  valueLabel: String(f.count),
                  note: kept === null ? undefined : `${kept}% of ${s.funnel[i - 1].label.toLowerCase()}`,
                  tooltip: `${f.label}: ${f.count}${kept === null ? "" : ` (${kept}% of the previous stage)`}`,
                };
              })}
            />
          )}
        </ChartCard>

        <ChartCard title="Shortlist rate by band" hint="Of applications sent, the share shortlisted or further" table={rateTable(s.byBand, "Band")}>
          {s.byBand.length ? <BarList label="Shortlist rate by band" max={100} rows={rateRows(s.byBand)} /> : <NoApplications />}
        </ChartCard>

        <ChartCard title="Shortlist rate by fit score" hint="Do the jobs that score well get you shortlisted?" table={rateTable(s.byScore, "Fit score")}>
          {s.byScore.length ? <BarList label="Shortlist rate by fit score range" max={100} rows={rateRows(s.byScore)} /> : <NoApplications />}
        </ChartCard>

        <ChartCard title="Shortlist rate by CV" hint="Which of your CVs gets you shortlisted more" table={rateTable(s.byCv, "CV")}>
          {s.byCv.length ? <BarList label="Shortlist rate by CV" max={100} rows={rateRows(s.byCv)} /> : <NoApplications />}
        </ChartCard>

        <ChartCard
          title="Where your jobs are now"
          hint="Every tracked job by its current stage"
          table={<DataTable head={["Stage", "Jobs"]} rows={JOB_STATUSES.map((st) => [STATUS_LABEL[st], s.byStage[st]])} />}
        >
          <BarList
            label="Jobs by current stage"
            rows={JOB_STATUSES.map((st) => ({
              label: STATUS_LABEL[st],
              value: s.byStage[st],
              valueLabel: String(s.byStage[st]),
              tooltip: `${STATUS_LABEL[st]}: ${s.byStage[st]} job${s.byStage[st] === 1 ? "" : "s"} (see ${STAGE_GROUPS[groupOf(st)].label} in the pipeline)`,
              href: `/pipeline?stage=${groupOf(st)}`,
            }))}
          />
        </ChartCard>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <Button asChild variant="outline">
          <a href="/api/backup" download>
            Download a full backup
          </a>
        </Button>
        <span className="text-sm text-muted-foreground">
          A JSON file of your jobs, CVs, evidence, scores, drafts and history. Uploaded files are not included, only their text.
        </span>
      </div>
    </div>
  );
}

function NoApplications() {
  return <p className="text-sm text-muted-foreground">Shows once you have sent applications.</p>;
}
