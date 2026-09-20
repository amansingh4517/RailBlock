/**
 * GisCorridorMap — Interactive SVG GIS track map for NDLS–UMB corridor (Km 0–199)
 * Shows: Dept-coloured active maintenance zones, TSR caution orders, station markers,
 * animated live train positions. Pure SVG — no external map lib dependency.
 */
import { useState } from "react";
import { MapPin, Train, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { STATIONS } from "@/lib/rail/data";
import { CORRIDOR_KM, DEPT_LABEL, type PlannedBlock } from "@/lib/rail/types";

const DEPT_COLORS: Record<string, string> = {
  ENGG: "#f59e0b",
  SNT: "#38bdf8",
  TRD: "#34d399",
  MULTI: "#818cf8",
};

// Simulated live train positions on the corridor (km position, updated by animation)
const LIVE_TRAINS = [
  { no: "12013", name: "Amritsar Shatabdi", dir: "UP" as const, km: 42, cls: "SHATABDI" },
  { no: "12311", name: "Kalka Mail", dir: "DN" as const, km: 131, cls: "MAIL" },
  { no: "14681", name: "Asr–Ndls Intercity", dir: "DN" as const, km: 89, cls: "PASS" },
  { no: "GOODS-1", name: "BCN Goods Rake", dir: "UP" as const, km: 163, cls: "GOODS" },
];

// Known TSR (Temporary Speed Restriction) zones
const TSR_ZONES = [
  { fromKm: 42, toKm: 47.5, speed: 30, reason: "Deep screening underway" },
  { fromKm: 88.4, toKm: 90.2, speed: 20, reason: "Turnout renewal — TSR imposed" },
];

function kmToX(km: number, width = 760) {
  return (km / CORRIDOR_KM) * width;
}

export function GisCorridorMap({ blocks }: { blocks: PlannedBlock[] }) {
  const [expanded, setExpanded] = useState(true);
  const [hoveredBlock, setHoveredBlock] = useState<PlannedBlock | null>(null);
  const [hoveredStation, setHoveredStation] = useState<typeof STATIONS[0] | null>(null);

  const live = blocks.filter((b) => b.status !== "REJECTED");

  const W = 760;
  const H = 120;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <h3 className="font-display text-base font-bold text-fg">
            GIS Corridor Track Map
          </h3>
          <span className="font-mono text-[10px] text-muted rounded bg-surface-2 px-2 py-0.5 border border-border uppercase">
            NDLS – UMB · Km 0–199 · Live
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary font-mono inline-flex items-center gap-1 hover:underline"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? "Collapse" : "Expand Map"}
        </button>
      </div>

      {expanded && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            {Object.entries(DEPT_LABEL).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-sm"
                  style={{ background: DEPT_COLORS[k] }}
                />
                {k} ({v})
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: DEPT_COLORS.MULTI }} />
              Multi-dept Bundle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-rose-500/70" />
              TSR Caution Zone
            </span>
            <span className="flex items-center gap-1.5">
              <Train className="size-3 text-yellow-400" />
              Live Train
            </span>
          </div>

          {/* SVG Map */}
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full min-w-[480px] h-auto rounded-lg bg-surface-2/50 border border-border"
              role="img"
              aria-label="GIS track map NDLS to UMB"
            >
              {/* Background Grid */}
              {Array.from({ length: 20 }).map((_, i) => (
                <line
                  key={`grid-${i}`}
                  x1={i * (W / 20)}
                  y1={0}
                  x2={i * (W / 20)}
                  y2={H}
                  stroke="currentColor"
                  strokeOpacity={0.04}
                  strokeWidth={0.8}
                  className="text-muted"
                />
              ))}

              {/* UP Track Line */}
              <line x1={0} y1={50} x2={W} y2={50} stroke="#334155" strokeWidth={8} />
              <line x1={0} y1={50} x2={W} y2={50} stroke="#1e293b" strokeWidth={5} />
              <text x={4} y={46} fill="#94a3b8" fontSize={7} fontFamily="monospace">UP</text>

              {/* DN Track Line */}
              <line x1={0} y1={72} x2={W} y2={72} stroke="#334155" strokeWidth={8} />
              <line x1={0} y1={72} x2={W} y2={72} stroke="#1e293b" strokeWidth={5} />
              <text x={4} y={85} fill="#94a3b8" fontSize={7} fontFamily="monospace">DN</text>

              {/* TSR Caution Zones */}
              {TSR_ZONES.map((z, i) => (
                <g key={`tsr-${i}`}>
                  <rect
                    x={kmToX(z.fromKm, W)}
                    y={38}
                    width={kmToX(z.toKm - z.fromKm, W)}
                    height={45}
                    fill="#ef4444"
                    opacity={0.18}
                    rx={2}
                  />
                  <text
                    x={kmToX(z.fromKm, W) + 2}
                    y={55}
                    fill="#f87171"
                    fontSize={6}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    TSR {z.speed}
                  </text>
                </g>
              ))}

              {/* Maintenance Block Zones */}
              {live.map((b) => {
                const isMulti = b.departments.length > 1;
                const col = isMulti
                  ? DEPT_COLORS.MULTI
                  : DEPT_COLORS[b.departments[0]] ?? "#6366f1";
                const isUp = b.line !== "DN";
                const isDn = b.line !== "UP";
                return (
                  <g
                    key={b.id}
                    onMouseEnter={() => setHoveredBlock(b)}
                    onMouseLeave={() => setHoveredBlock(null)}
                    className="cursor-pointer"
                  >
                    {isUp && (
                      <rect
                        x={kmToX(b.fromKm, W)}
                        y={42}
                        width={Math.max(3, kmToX(b.toKm - b.fromKm, W))}
                        height={14}
                        fill={col}
                        opacity={hoveredBlock?.id === b.id ? 0.9 : 0.6}
                        rx={2}
                      />
                    )}
                    {isDn && (
                      <rect
                        x={kmToX(b.fromKm, W)}
                        y={65}
                        width={Math.max(3, kmToX(b.toKm - b.fromKm, W))}
                        height={14}
                        fill={col}
                        opacity={hoveredBlock?.id === b.id ? 0.9 : 0.6}
                        rx={2}
                      />
                    )}
                  </g>
                );
              })}

              {/* Station Markers */}
              {STATIONS.map((s) => (
                <g
                  key={s.code}
                  onMouseEnter={() => setHoveredStation(s)}
                  onMouseLeave={() => setHoveredStation(null)}
                  className="cursor-pointer"
                >
                  <line
                    x1={kmToX(s.km, W)}
                    y1={34}
                    x2={kmToX(s.km, W)}
                    y2={86}
                    stroke="#475569"
                    strokeWidth={0.8}
                    strokeDasharray="2,2"
                  />
                  <circle cx={kmToX(s.km, W)} cy={34} r={3} fill="#94a3b8" />
                  <text
                    x={kmToX(s.km, W)}
                    y={28}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={6}
                    fontFamily="monospace"
                  >
                    {s.code}
                  </text>
                </g>
              ))}

              {/* Live Train Indicators */}
              {LIVE_TRAINS.map((t) => {
                const x = kmToX(t.km, W);
                const y = t.dir === "UP" ? 48 : 70;
                const trainColor =
                  t.cls === "SHATABDI" || t.cls === "RAJ"
                    ? "#fbbf24"
                    : t.cls === "GOODS"
                      ? "#94a3b8"
                      : "#60a5fa";
                return (
                  <g key={t.no}>
                    <polygon
                      points={
                        t.dir === "UP"
                          ? `${x - 4},${y + 4} ${x + 5},${y} ${x - 4},${y - 4}`
                          : `${x + 4},${y + 4} ${x - 5},${y} ${x + 4},${y - 4}`
                      }
                      fill={trainColor}
                      opacity={0.9}
                    />
                    <text
                      x={x}
                      y={t.dir === "UP" ? y - 7 : y + 12}
                      textAnchor="middle"
                      fill={trainColor}
                      fontSize={5.5}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {t.no}
                    </text>
                  </g>
                );
              })}

              {/* Km Scale at bottom */}
              {[0, 44, 89, 123, 156, 199].map((km) => (
                <text
                  key={`scale-${km}`}
                  x={kmToX(km, W)}
                  y={H - 4}
                  textAnchor={km === 0 ? "start" : km === 199 ? "end" : "middle"}
                  fill="#475569"
                  fontSize={6}
                  fontFamily="monospace"
                >
                  {km}km
                </text>
              ))}
            </svg>
          </div>

          {/* Tooltip / Hover Info */}
          {(hoveredBlock || hoveredStation) && (
            <div className="rounded-lg bg-surface-2 border border-border p-3 text-xs font-mono space-y-1">
              {hoveredBlock && (
                <>
                  <p className="font-bold text-fg">
                    Block {hoveredBlock.id} — {hoveredBlock.departments.join(" + ")}
                  </p>
                  <p className="text-muted">
                    Span: Km {hoveredBlock.fromKm}–{hoveredBlock.toKm} ({hoveredBlock.line}) ·{" "}
                    {hoveredBlock.durationHours.toFixed(1)}h · {hoveredBlock.taskIds.length} tasks seated
                  </p>
                  <p className="text-muted">Detention estimate: {hoveredBlock.disruptionMin} min</p>
                </>
              )}
              {hoveredStation && !hoveredBlock && (
                <>
                  <p className="font-bold text-fg">{hoveredStation.name} ({hoveredStation.code})</p>
                  <p className="text-muted">Km {hoveredStation.km} — NDLS–UMB Corridor</p>
                </>
              )}
            </div>
          )}

          {/* TSR Caution Banner */}
          {TSR_ZONES.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {TSR_ZONES.map((z, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[10px] font-mono text-rose-400"
                >
                  <AlertTriangle className="size-3" />
                  <span>TSR {z.speed} km/h · Km {z.fromKm}–{z.toKm} · {z.reason}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
