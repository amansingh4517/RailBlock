import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shell } from "@/components/layout/shell";
import { ROLE_LABEL } from "@/lib/rail/types";
import { useRailStore } from "@/lib/rail/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const TREND = [
  { w: "W31", hours: 52, avail: 90.1 },
  { w: "W32", hours: 49, avail: 90.8 },
  { w: "W33", hours: 47, avail: 91.4 },
  { w: "W34", hours: 44, avail: 92.2 },
  { w: "W35", hours: 41, avail: 93.0 },
  { w: "W36", hours: 38, avail: 94.1 },
];

function ReportsPage() {
  const kpis = useRailStore((s) => s.kpis);
  const audit = useRailStore((s) => s.audit);
  const blocks = useRailStore((s) => s.blocks);
  const approved = blocks.filter((b) => b.status === "APPROVED").length;
  const pending = blocks.filter((b) => b.status === "PENDING").length;
  const modified = blocks.filter((b) => b.status === "MODIFIED").length;

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Actual vs planned</p>
          <h1 className="font-display text-4xl md:text-5xl">Impact</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Target from the problem statement: 15–25% fewer maintenance block hours, 20–30% better utilisation of granted
            possessions, less detention.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-4">
          <Tile k="Hours saved vs silos" v={`${kpis.hoursSavedPct.toFixed(0)}%`} />
          <Tile k="Windows used (week)" v={`${kpis.windowsUsed}/${kpis.windowsTotal}`} />
          <Tile k="Approved / pending" v={`${approved} / ${pending}`} />
          <Tile k="Modified by officers" v={`${modified}`} />
        </section>

        <section className="rounded-xl bg-surface p-4 hairline">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Block hours and availability, last six weeks</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="w" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="hours" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl">Audit</h2>
          <ol className="mt-3 space-y-0">
            {audit.map((e) => (
              <li key={e.id} className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-border py-3 text-sm">
                <span className="font-mono text-xs text-faint">{e.at.slice(11, 16)}</span>
                <span>
                  <span className="text-muted">{ROLE_LABEL[e.actor]} · {e.action}</span>
                  <span className="mt-0.5 block text-fg">{e.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Shell>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
      <p className="font-display mt-1 text-3xl tabular">{v}</p>
    </div>
  );
}
