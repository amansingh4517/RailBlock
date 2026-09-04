import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shell } from "@/components/layout/shell";
import { Badge } from "@/components/ui/badge";
import { DeptBadge } from "@/components/rail/bits";
import { Progress } from "@/components/ui/progress";
import { ASSETS, STATIONS } from "@/lib/rail/data";
import { formatKm } from "@/lib/rail/format";

export const Route = createFileRoute("/assets")({ component: AssetsPage });

function AssetsPage() {
  const critical = [...ASSETS].sort((a, b) => a.health - b.health);
  const byType = ["TRACK", "POINT", "SIGNAL", "OHE", "BRIDGE", "LC", "AXLE_COUNTER", "TSS"].map((type) => {
    const rows = ASSETS.filter((a) => a.type === type);
    const avg = rows.length ? rows.reduce((s, a) => s + a.health, 0) / rows.length : 0;
    return { type, avg: Math.round(avg), n: rows.length };
  }).filter((r) => r.n);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Health digital twin</p>
          <h1 className="font-display text-4xl md:text-5xl">Assets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Unified registry for the NDLS–UMB corridor. Health scores feed the priority engine; anything under 60 is
            treated as a planning constraint.
          </p>
        </header>

        <section className="h-56 rounded-xl bg-surface p-4 hairline">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Mean health by type</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={byType} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="type" tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", fontSize: 12 }}
              />
              <Bar dataKey="avg" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <ul className="space-y-2">
          {critical.map((a) => {
            const near = STATIONS.reduce((best, s) =>
              Math.abs(s.km - a.km) < Math.abs(best.km - a.km) ? s : best,
            );
            const tone = a.health < 55 ? "danger" : a.health < 70 ? "caution" : "ok";
            return (
              <li key={a.id} className="rounded-xl bg-surface p-4 hairline">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-fg">{a.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-faint">
                      km {formatKm(a.km)} · {near.code} · last {a.lastMaintained}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DeptBadge d={a.department} />
                    <Badge tone={tone}>{a.type}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress
                    value={a.health}
                    className="flex-1"
                    barClassName={a.health < 55 ? "bg-danger" : a.health < 70 ? "bg-caution" : "bg-ok"}
                  />
                  <span className="font-mono tabular text-sm">{a.health}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{a.riskNote}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
