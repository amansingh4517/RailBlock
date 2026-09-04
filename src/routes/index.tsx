import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Radio } from "lucide-react";
import { toast } from "sonner";
import { CorridorRibbon } from "@/components/corridor/ribbon";
import { Shell } from "@/components/layout/shell";
import { DeptBadge, StatusBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { askControlBrief } from "@/lib/ai/briefing";
import { addDays, formatHours, formatSpan, minToHhmm, weekday } from "@/lib/rail/format";
import { localBriefing } from "@/lib/rail/kpis";
import { findConflicts } from "@/lib/rail/optimizer";
import { useRailStore } from "@/lib/rail/store";
import { WEEK_START } from "@/lib/rail/types";

export const Route = createFileRoute("/")({ component: CommandPage });

function CommandPage() {
  const kpis = useRailStore((s) => s.kpis);
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const scenario = useRailStore((s) => s.scenario);
  const grokBusy = useRailStore((s) => s.grokBusy);
  const setGrokBusy = useRailStore((s) => s.setGrokBusy);
  const setGrokBrief = useRailStore((s) => s.setGrokBrief);
  const grokBrief = useRailStore((s) => s.grokBrief);
  const selectBlock = useRailStore((s) => s.selectBlock);

  const week = blocks.filter((b) => b.date >= WEEK_START && b.date <= addDays(WEEK_START, 6) && b.status !== "REJECTED");
  const brief = grokBrief ?? localBriefing(kpis, blocks, tasks, scenario);
  const warnings = findConflicts(blocks, tasks).filter((c) => c.severity === "warn").slice(0, 4);

  async function onBrief() {
    setGrokBusy(true);
    try {
      const summary = [
        localBriefing(kpis, blocks, tasks, scenario),
        `Blocks: ${week.map((b) => `${b.id} ${b.date} ${minToHhmm(b.startMin)} ${formatSpan(b.fromKm, b.toKm)} depts ${b.departments.join("/")} tasks ${b.taskIds.join(",")}`).join("; ")}`,
        `Open leftover: ${kpis.tasksOpen}. Scenario weather ${scenario.weather} freight ${scenario.extraFreightPct} gangs ${scenario.gangAvailabilityPct} emergency ${scenario.emergencyDefect}.`,
      ].join("\n");
      const res = await askControlBrief({ data: { summary } });
      if (res.ok) {
        setGrokBrief(res.text);
        toast("Control briefing rewritten");
      } else {
        toast(res.error);
      }
    } catch {
      toast("Briefing service unreachable");
    } finally {
      setGrokBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Planning horizon 07–13 Sep 2026</p>
            <h1 className="font-display mt-1 text-4xl leading-none md:text-6xl">Command</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Automatic block planning for the New Delhi–Ambala Cantt double line. Engineering, S&T and Traction
              share one possession board.
            </p>
          </div>
          <Button asChild>
            <Link to="/plan">
              Open block plan <ArrowRight className="size-4" />
            </Link>
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-5">
          <Kpi label="Asset availability" value={`${kpis.assetAvailability.toFixed(1)}%`} hint="modelled free path" />
          <Kpi label="Block hours" value={kpis.blockHours.toFixed(1)} hint={`${kpis.hoursSavedPct.toFixed(0)}% vs silos`} />
          <Kpi label="Bundling" value={`${kpis.bundlingRate.toFixed(0)}%`} hint="shared possessions" />
          <Kpi label="High-priority" value={`${kpis.highPriorityCoverage.toFixed(0)}%`} hint="covered this solve" />
          <Kpi label="Detention" value={`${kpis.detentionMin}`} hint="train-minutes" className="col-span-2 md:col-span-1" />
        </section>

        <CorridorRibbon blocks={week} />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl bg-surface p-5 hairline">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Control order</h2>
              <Button size="sm" variant="secondary" onClick={onBrief} disabled={grokBusy}>
                <Radio className="size-3.5" />
                {grokBusy ? "Writing…" : grokBrief ? "Rewrite" : "Ask Grok"}
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-fg">{brief}</p>
          </section>

          <section className="rounded-xl bg-surface p-5 hairline">
            <h2 className="font-display text-2xl">Exceptions</h2>
            <ul className="mt-3 space-y-3">
              {warnings.length === 0 ? (
                <li className="text-sm text-muted">No hard conflicts on the current solve.</li>
              ) : (
                warnings.map((w) => (
                  <li key={w.id} className="text-sm text-caution">
                    {w.text}
                  </li>
                ))
              )}
            </ul>
            <p className="mt-4 text-xs text-faint">
              {kpis.windowsUsed}/{kpis.windowsTotal} week windows used · {kpis.tasksPlanned} tasks seated ·{" "}
              {kpis.tasksOpen} still open
            </p>
          </section>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-2xl">This week</h2>
            <Link to="/plan" className="text-sm text-muted hover:text-fg">
              Full Gantt
            </Link>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-surface hairline">
            {week.slice(0, 8).map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => selectBlock(b.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="w-16 font-mono text-xs text-muted">{b.id}</span>
                  <span className="w-28 font-mono text-sm tabular">
                    {weekday(b.date)} {minToHhmm(b.startMin)}
                  </span>
                  <span className="hidden flex-1 truncate text-sm md:block">{formatSpan(b.fromKm, b.toKm)}</span>
                  <span className="hidden md:flex md:gap-1">
                    {b.departments.map((d) => (
                      <DeptBadge key={d} d={d} />
                    ))}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted">{formatHours(b.durationHours)}</span>
                  <StatusBadge status={b.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function Kpi({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={`bg-surface px-4 py-4 ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display mt-1 text-3xl leading-none tabular md:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}
