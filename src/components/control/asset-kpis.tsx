/**
 * AssetAvailabilityKpis — Prominent Asset Availability & Downtime Saved KPI Cards
 * Shows: Downtime Hours Saved, Asset Availability Index, Multi-Dept Co-Possession Rate,
 * High-Priority Coverage. Computes values from live KPIs & blocks.
 */
import { TrendingUp, Clock, Layers, ShieldCheck } from "lucide-react";
import type { Kpis, PlannedBlock } from "@/lib/rail/types";

interface Props {
  kpis: Kpis;
  blocks: PlannedBlock[];
}

export function AssetAvailabilityKpis({ kpis, blocks }: Props) {
  const liveBlocks = blocks.filter((b) => b.status !== "REJECTED");

  // Downtime hours saved (absolute hours, not just %)
  const hoursSaved = Math.max(0, kpis.uncoordinatedHours - kpis.blockHours);

  // Multi-dept co-possession blocks count
  const multiDeptBlocks = liveBlocks.filter((b) => b.departments.length > 1);
  const multiDeptRate = liveBlocks.length > 0
    ? Math.round((multiDeptBlocks.length / liveBlocks.length) * 100)
    : 0;

  const cards = [
    {
      icon: Clock,
      label: "Downtime Hours Saved",
      value: `${hoursSaved.toFixed(1)}h`,
      subline: `vs. ${kpis.uncoordinatedHours.toFixed(1)}h uncoordinated silos`,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      hint: `${kpis.hoursSavedPct.toFixed(0)}% reduction this week`,
    },
    {
      icon: TrendingUp,
      label: "Asset Availability Index",
      value: `${kpis.assetAvailability.toFixed(1)}%`,
      subline: "NDLS–UMB double track free path",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      hint: `${kpis.windowsUsed} of ${kpis.windowsTotal} windows occupied`,
    },
    {
      icon: Layers,
      label: "Multi-Dept Co-Possession Rate",
      value: `${kpis.bundlingRate.toFixed(0)}%`,
      subline: `${multiDeptBlocks.length} of ${liveBlocks.length} blocks cross-dept`,
      color: "text-sky-400",
      bg: "bg-sky-500/10 border-sky-500/20",
      hint: `${multiDeptRate}% of active blocks bundled`,
    },
    {
      icon: ShieldCheck,
      label: "High-Priority Coverage",
      value: `${kpis.highPriorityCoverage.toFixed(0)}%`,
      subline: "Critical tasks (score ≥ 70) seated",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      hint: `${kpis.tasksPlanned} tasks planned · ${kpis.tasksOpen} backlog`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-xl border p-4 space-y-2 ${card.bg}`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${card.color} shrink-0`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted leading-tight">
                {card.label}
              </span>
            </div>
            <p className={`font-display text-3xl font-bold leading-none ${card.color}`}>
              {card.value}
            </p>
            <p className="text-[11px] text-muted leading-snug">{card.subline}</p>
            <p className="text-[10px] text-faint font-mono">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
