import { STATIONS } from "@/lib/rail/data";
import { CORRIDOR_KM, type PlannedBlock } from "@/lib/rail/types";
import { useRailStore } from "@/lib/rail/store";
import { cn } from "@/lib/utils";
import { formatSpan, minToHhmm, weekday } from "@/lib/rail/format";

export function CorridorRibbon({
  blocks,
  compact,
  highlightSpan,
}: {
  blocks: PlannedBlock[];
  compact?: boolean;
  highlightSpan?: { fromKm: number; toKm: number; label?: string };
}) {
  const selected = useRailStore((s) => s.selectedBlockId);
  const selectBlock = useRailStore((s) => s.selectBlock);
  const live = blocks.filter((b) => b.status !== "REJECTED");

  return (
    <div className="rounded-xl bg-surface p-4 md:p-5 hairline">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider text-muted">Corridor occupancy</p>
          {highlightSpan && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
              Focus: Km {highlightSpan.fromKm.toFixed(1)}–{highlightSpan.toKm.toFixed(1)} {highlightSpan.label ? `(${highlightSpan.label})` : ""}
            </span>
          )}
        </div>
        <p className="font-mono text-[11px] text-faint">0 — {CORRIDOR_KM} km</p>
      </div>
      <div className="relative">

        <svg viewBox={`0 0 ${CORRIDOR_KM} ${compact ? 36 : 52}`} className="h-auto w-full" role="img" aria-label="NDLS to UMB corridor">
          <line x1="0" y1={compact ? 18 : 26} x2={CORRIDOR_KM} y2={compact ? 18 : 26} className="stroke-border" strokeWidth="6" />
          <line x1="0" y1={compact ? 14 : 22} x2={CORRIDOR_KM} y2={compact ? 14 : 22} className="stroke-muted" strokeWidth="1.2" />
          <line x1="0" y1={compact ? 22 : 30} x2={CORRIDOR_KM} y2={compact ? 22 : 30} className="stroke-muted" strokeWidth="1.2" />
          {live.map((b) => {
            const y = compact ? 10 : 16;
            const h = compact ? 16 : 20;
            const fill =
              b.departments.length > 1
                ? "var(--color-primary)"
                : b.departments[0] === "ENGG"
                  ? "var(--color-engg)"
                  : b.departments[0] === "SNT"
                    ? "var(--color-snt)"
                    : "var(--color-trd)";
            return (
              <rect
                key={b.id}
                x={b.fromKm}
                y={y}
                width={Math.max(1.2, b.toKm - b.fromKm)}
                height={h}
                rx="1.2"
                fill={fill}
                opacity={selected === b.id ? 0.95 : 0.55}
                className="cursor-pointer"
                onClick={() => selectBlock(b.id)}
              />
            );
          })}
          {STATIONS.map((s) => (
            <g key={s.code}>
              <line
                x1={s.km}
                y1={compact ? 8 : 12}
                x2={s.km}
                y2={compact ? 28 : 40}
                className="stroke-faint"
                strokeWidth="0.4"
              />
            </g>
          ))}
          {highlightSpan && (
            <g className="animate-pulse">
              <rect
                x={highlightSpan.fromKm}
                y={compact ? 4 : 8}
                width={Math.max(2, highlightSpan.toKm - highlightSpan.fromKm)}
                height={compact ? 28 : 36}
                rx="2"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
              <rect
                x={highlightSpan.fromKm}
                y={compact ? 12 : 18}
                width={Math.max(2, highlightSpan.toKm - highlightSpan.fromKm)}
                height={compact ? 12 : 16}
                rx="1"
                fill="#f59e0b"
                opacity={0.35}
              />
            </g>
          )}
        </svg>
        <div className="mt-1 flex justify-between">
          {STATIONS.filter((_, i) => i % 2 === 0 || STATIONS.length < 10).map((s) => (
            <span key={s.code} className="font-mono text-[10px] text-faint">
              {s.code}
            </span>
          ))}
        </div>
      </div>
      {!compact ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {live.slice(0, 6).map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => selectBlock(b.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors duration-150",
                  selected === b.id ? "bg-surface-2" : "hover:bg-surface-2/60",
                )}
              >
                <span>
                  <span className="font-mono text-muted">{b.id}</span>
                  <span className="ml-2 text-fg">
                    {weekday(b.date)} {minToHhmm(b.startMin)}
                  </span>
                  <span className="mt-0.5 block text-faint">{formatSpan(b.fromKm, b.toKm)}</span>
                </span>
                <span className="font-mono tabular text-muted">{b.taskIds.length}t</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
