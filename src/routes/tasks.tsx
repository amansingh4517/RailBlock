import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/layout/shell";
import { DeptBadge, PriorityBar, StatusBadge } from "@/components/rail/bits";
import { Input } from "@/components/ui/input";
import { RESOURCES } from "@/lib/rail/data";
import { formatHours, formatSpan, severityLabel } from "@/lib/rail/format";
import { scoreBreakdown } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";
import type { Department, TaskSource } from "@/lib/rail/types";
import { SOURCE_LABEL } from "@/lib/rail/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const tasks = useRailStore((s) => s.tasks);
  const selectTask = useRailStore((s) => s.selectTask);
  const selected = useRailStore((s) => s.selectedTaskId);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<Department | "ALL">("ALL");
  const [src, setSrc] = useState<TaskSource | "ALL">("ALL");

  const ranked = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "DONE")
      .filter((t) => (dept === "ALL" ? true : t.department === dept))
      .filter((t) => (src === "ALL" ? true : t.source === src))
      .filter((t) => {
        const hay = `${t.id} ${t.title} ${t.detail}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .map((t) => ({ t, score: scoreBreakdown(t) }))
      .sort((a, b) => b.score.total - a.score.total);
  }, [tasks, q, dept, src]);

  const current = ranked.find((r) => r.t.id === selected) ?? ranked[0];

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Priority engine</p>
          <h1 className="font-display text-4xl md:text-5xl">Work queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Score = 0.28 severity + 0.18 overdue + 0.22 traffic impact + 0.24 safety + 0.08 resource readiness.
            Sources: TMS, SMMS, TDMS, BDMS.
          </p>
        </header>

        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id, km, defect…"
            className="md:max-w-sm"
          />
          <FilterChipBar
            value={dept}
            onChange={setDept}
            items={["ALL", "ENGG", "SNT", "TRD"] as const}
          />
          <FilterChipBar
            value={src}
            onChange={setSrc}
            items={["ALL", "TMS", "SMMS", "TDMS", "BDMS"] as const}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Task</th>
                  <th className="py-2 pr-3 font-medium">Dept</th>
                  <th className="py-2 pr-3 font-medium">Span</th>
                  <th className="py-2 pr-3 font-medium">Hrs</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ t, score }) => (
                  <tr
                    key={t.id}
                    onClick={() => selectTask(t.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/70 transition-colors duration-150",
                      current?.t.id === t.id ? "bg-surface" : "hover:bg-surface/60",
                    )}
                  >
                    <td className="py-3 pr-3">
                      <PriorityBar score={score.total} />
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-fg">{t.title}</p>
                      <p className="font-mono text-[11px] text-faint">
                        {t.id} · {t.source}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <DeptBadge d={t.department} />
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-muted">{formatSpan(t.fromKm, t.toKm)}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{formatHours(t.durationHours)}</td>
                    <td className="py-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {current ? (
            <aside className="rounded-xl bg-surface p-5 hairline">
              <p className="font-mono text-xs text-muted">{current.t.id}</p>
              <h2 className="font-display mt-1 text-2xl leading-none">{current.t.title}</h2>
              <p className="mt-2 text-sm text-muted">{current.t.detail}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Row k="Source" v={SOURCE_LABEL[current.t.source]} />
                <Row k="Severity" v={severityLabel(current.t.severity)} />
                <Row k="Overdue" v={`${current.t.overdueDays} days`} />
                <Row k="Line" v={current.t.line} />
                <Row k="Window" v={`${current.t.earliest} → ${current.t.latest}`} />
                <Row k="Bundle" v={current.t.canBundle ? "Yes" : "No"} />
              </dl>
              <p className="mt-4 text-xs uppercase tracking-wider text-muted">Score parts</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(
                  [
                    ["Severity", current.score.severity],
                    ["Overdue", current.score.overdue],
                    ["Traffic", current.score.traffic],
                    ["Safety", current.score.safety],
                    ["Resources", current.score.resources],
                  ] as const
                ).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted">{k}</span>
                    <span className="font-mono tabular">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-wider text-muted">Resources</p>
              <ul className="mt-1 text-sm text-fg">
                {current.t.resourceIds.map((id) => (
                  <li key={id}>{RESOURCES.find((r) => r.id === id)?.name ?? id}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function FilterChipBar<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: readonly T[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "h-10 rounded-md px-3 text-xs uppercase tracking-wide",
            value === item ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
