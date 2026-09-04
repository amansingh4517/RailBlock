import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CorridorRibbon } from "@/components/corridor/ribbon";
import { Shell } from "@/components/layout/shell";
import { BlockDetail } from "@/components/plan/block-detail";
import { MonthBoard, WeekGantt } from "@/components/plan/gantt";
import { addDays } from "@/lib/rail/format";
import { useRailStore } from "@/lib/rail/store";
import { WEEK_START } from "@/lib/rail/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan")({ component: PlanPage });

function PlanPage() {
  const blocks = useRailStore((s) => s.blocks);
  const kpis = useRailStore((s) => s.kpis);
  const [view, setView] = useState<"week" | "month">("week");
  const week = blocks.filter((b) => b.date >= WEEK_START && b.date <= addDays(WEEK_START, 6));

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Human in the loop</p>
            <h1 className="font-display text-4xl md:text-5xl">Block plan</h1>
            <p className="mt-1 text-sm text-muted">
              {kpis.tasksPlanned} tasks seated · {kpis.blockHours.toFixed(1)}h possession · {kpis.hoursSavedPct.toFixed(0)}%
              fewer hours than uncoordinated bids
            </p>
          </div>
          <div className="flex rounded-md bg-surface-2 p-1">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "h-9 rounded-sm px-3 text-sm capitalize",
                  view === v ? "bg-surface text-fg" : "text-muted",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </header>

        <CorridorRibbon blocks={view === "week" ? week : blocks} compact />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 rounded-xl bg-surface p-3 md:p-4 hairline">
            {view === "week" ? <WeekGantt blocks={blocks} /> : <MonthBoard blocks={blocks} />}
          </div>
          <aside className="rounded-xl bg-surface p-5 hairline">
            <BlockDetail />
          </aside>
        </div>

        <p className="text-xs text-faint">
          Night possessions sit 00:40–04:40. Tuesday/Thursday midday gaps 11:10–13:10. Sunday mega 08:00–14:00.
          Control Office and Admin can approve; departments flag changes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Legend swatch="bg-engg" label="Engineering" />
          <Legend swatch="bg-snt" label="S&T" />
          <Legend swatch="bg-trd" label="Traction" />
          <Legend swatch="bg-primary" label="Multi-dept bundle" />
        </div>
      </div>
    </Shell>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={`size-2 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
