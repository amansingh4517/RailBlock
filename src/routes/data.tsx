import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/shell";
import { Badge } from "@/components/ui/badge";
import { TASKS, TRAINS, WINDOWS } from "@/lib/rail/data";
import { SOURCE_LABEL, type TaskSource } from "@/lib/rail/types";

export const Route = createFileRoute("/data")({ component: DataPage });

const FEEDS: { id: TaskSource | "COA"; title: string; desc: string; n: number }[] = [
  { id: "TMS", title: SOURCE_LABEL.TMS, desc: "P.Way defects, USFD, GMT, TSR, machine programmes.", n: TASKS.filter((t) => t.source === "TMS").length },
  { id: "SMMS", title: SOURCE_LABEL.SMMS, desc: "Points, axle counters, EI, cables, LC interlocking.", n: TASKS.filter((t) => t.source === "SMMS").length },
  { id: "TDMS", title: SOURCE_LABEL.TDMS, desc: "OHE wear, ATD, SSP, bonding, tower-wagon work.", n: TASKS.filter((t) => t.source === "TDMS").length },
  { id: "BDMS", title: SOURCE_LABEL.BDMS, desc: "Department block bids awaiting corridor fit.", n: TASKS.filter((t) => t.source === "BDMS").length },
  { id: "COA", title: "Control Office Application", desc: "Corridor occupancy, train running, goods forecast.", n: TRAINS.length },
];

function DataPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted">Unified data hub</p>
          <h1 className="font-display text-4xl md:text-5xl">Feeds</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Prototype connectors replay a frozen 4 Sep 2026 snapshot. Production would ETL from TMS, SMMS, TDMS, COA and
            BDMS into one asset registry.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          {FEEDS.map((f) => (
            <article key={f.id} className="rounded-xl bg-surface p-5 hairline">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted">{f.id}</p>
                <Badge tone="ok">Live snapshot</Badge>
              </div>
              <h2 className="font-display mt-2 text-2xl leading-none">{f.title}</h2>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
              <p className="mt-3 font-mono text-sm tabular text-fg">{f.n} records in window</p>
            </article>
          ))}
        </div>

        <section>
          <h2 className="font-display text-2xl">COA — trains that price detention</h2>
          <p className="mb-3 text-sm text-muted">Pass times at Panipat used when a midday or mega block is priced.</p>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">No.</th>
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Dir</th>
                  <th className="py-2 font-medium">PNP</th>
                  <th className="py-2 font-medium">Class</th>
                </tr>
              </thead>
              <tbody>
                {TRAINS.map((t) => (
                  <tr key={t.number} className="border-b border-border/70">
                    <td className="py-2 font-mono">{t.number}</td>
                    <td className="py-2">{t.name}</td>
                    <td className="py-2 text-muted">{t.dir}</td>
                    <td className="py-2 font-mono tabular">{t.passPnp}</td>
                    <td className="py-2 text-muted">{t.class}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-faint">{WINDOWS.length} corridor windows generated 07–27 Sep · night, midday, Sunday mega.</p>
      </div>
    </Shell>
  );
}
