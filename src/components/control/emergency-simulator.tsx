/**
 * EmergencySimulator — Disturbance & Block Overrun Simulator
 * Simulates: rail fracture at PNP (km 91.4), 30–45 min overrun
 * Shows: before/after disruption state, affected trains, replanning result
 * Embedded into /control "optimization" tab as an additional panel.
 */
import { useState } from "react";
import { Zap, AlertTriangle, RefreshCw, CheckCircle2, Clock, Train } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SimPhase = "idle" | "running" | "disrupted" | "replanned";

interface AffectedTrain {
  no: string;
  name: string;
  type: string;
  delayBefore: number;
  delayAfter: number;
  action: string;
}

const AFFECTED_TRAINS: AffectedTrain[] = [
  { no: "12013", name: "Amritsar Shatabdi", type: "SHATABDI", delayBefore: 47, delayAfter: 12, action: "Held at SNP (Km 44) for 12 min, line cleared" },
  { no: "12311", name: "Kalka Mail", type: "MAIL", delayBefore: 47, delayAfter: 8, action: "Regulated at NUR — advanced departure post-clearance" },
  { no: "14681", name: "Asr–Ndls Intercity", type: "PASS", delayBefore: 47, delayAfter: 0, action: "Held at PNP loop – cleared before arrival" },
  { no: "GOODS-1", name: "BCN Goods Rake", type: "GOODS", delayBefore: 47, delayAfter: 47, action: "Detained at PNP goods loop – goods lower priority" },
  { no: "GOODS-2", name: "BTPN Tanker Rake", type: "GOODS", delayBefore: 47, delayAfter: 47, action: "Detained at GRA goods loop – scheduled next window" },
];

export function EmergencySimulator() {
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [overrunMin, setOverrunMin] = useState(45);
  const [elapsed, setElapsed] = useState(0);

  function runSimulation() {
    setPhase("running");
    setElapsed(0);
    toast.info("Simulating block overrun at Panipat (km 91.4)…");

    // Simulate progress
    let t = 0;
    const interval = setInterval(() => {
      t += 15;
      setElapsed(t);
      if (t >= overrunMin) {
        clearInterval(interval);
        setPhase("disrupted");
        toast.warning(`Block B-003 overran by ${overrunMin} min — re-optimization triggered`);

        // Auto-replan after 1.5s
        setTimeout(() => {
          setPhase("replanned");
          toast.success("Rolling-horizon CP-SAT replan complete — past commitments preserved");
        }, 1500);
      }
    }, 120); // Fast-forward for demo
  }

  function reset() {
    setPhase("idle");
    setElapsed(0);
  }

  const totalDelaySaved = AFFECTED_TRAINS.reduce(
    (s, t) => s + (t.delayBefore - t.delayAfter), 0
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-muted mb-1">
            <Zap className="size-3.5 text-amber-400" />
            <span>Disturbance & Overrun Simulator</span>
          </div>
          <h3 className="font-display text-xl font-bold text-fg">
            Emergency Re-Optimization
          </h3>
          <p className="text-xs text-muted mt-1">
            Simulate a maintenance block overrun or rail fracture at Panipat (Km 91.4) and watch the rolling-horizon
            solver replan downstream windows while preserving locked past commitments.
          </p>
        </div>

        <div className="shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted font-mono">Overrun duration:</label>
            <select
              value={overrunMin}
              onChange={(e) => setOverrunMin(Number(e.target.value))}
              disabled={phase !== "idle"}
              className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-mono"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div className="flex gap-2">
            {phase === "idle" ? (
              <Button onClick={runSimulation} size="sm" className="gap-2 w-full">
                <Zap className="size-4" />
                <span>Run Overrun Simulation</span>
              </Button>
            ) : (
              <Button onClick={reset} variant="outline" size="sm" className="gap-2 w-full">
                <RefreshCw className="size-3.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Phase: Running */}
      {phase === "running" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-bold text-amber-400 uppercase">
              Overrun in Progress — Block B-003 · Km 88.4–92.4 PNP Yard
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${Math.min(100, (elapsed / overrunMin) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted font-mono">
            Elapsed overrun: <strong className="text-amber-400">{elapsed} / {overrunMin} min</strong> ·
            Trains 12013, 12311 holding at SNP, NUR…
          </p>
        </div>
      )}

      {/* Phase: Disrupted */}
      {phase === "disrupted" && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-400" />
            <span className="font-mono text-xs font-bold text-rose-400 uppercase">
              Disruption Detected — Triggering Rolling-Horizon Replan…
            </span>
          </div>
          <p className="text-xs text-muted">
            Block B-003 overran by {overrunMin} min. Past-committed blocks B-001, B-002 are LOCKED.
            Solver replanning B-004 through B-012 with freight priority constraints…
          </p>
        </div>
      )}

      {/* Phase: Replanned */}
      {phase === "replanned" && (
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-mono text-xs font-bold text-emerald-400 uppercase">
                Replan Complete — Rolling Horizon CP-SAT Solver
              </p>
              <p className="text-xs text-muted">
                Past-committed blocks (B-001, B-002, B-003) preserved as locked.
                B-004 through B-012 rescheduled to next available windows.
                {totalDelaySaved} train-minutes of delay recovered via regulated holding.
              </p>
            </div>
          </div>

          {/* Before/After KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl bg-surface-2 p-3 border border-border space-y-1">
              <span className="text-muted text-[11px] font-mono block">Overrun Duration</span>
              <p className="font-display text-2xl font-bold text-rose-400">{overrunMin}m</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3 border border-border space-y-1">
              <span className="text-muted text-[11px] font-mono block">Trains Affected</span>
              <p className="font-display text-2xl font-bold text-amber-400">{AFFECTED_TRAINS.length}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3 border border-border space-y-1">
              <span className="text-muted text-[11px] font-mono block">Delay Recovered</span>
              <p className="font-display text-2xl font-bold text-emerald-400">{totalDelaySaved}m</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3 border border-border space-y-1">
              <span className="text-muted text-[11px] font-mono block">Blocks Locked</span>
              <p className="font-display text-2xl font-bold text-primary">3</p>
            </div>
          </div>

          {/* Affected Trains Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-2">
              <Train className="size-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase font-bold text-muted">
                Affected Train Movements — Regulated Holding Result
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-surface-2/50 border-b border-border">
                <tr className="text-[10px] uppercase font-mono text-muted">
                  <th className="px-3 py-2 text-left">Train</th>
                  <th className="px-3 py-2 text-left">Before Replan</th>
                  <th className="px-3 py-2 text-left">After Replan</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">Regulation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {AFFECTED_TRAINS.map((t) => (
                  <tr key={t.no} className="hover:bg-surface-2/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-fg">{t.no}</p>
                      <p className="text-muted text-[10px]">{t.name}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-rose-400 font-bold">+{t.delayBefore}m delay</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          t.delayAfter === 0
                            ? "text-emerald-400 font-bold"
                            : t.delayAfter < t.delayBefore
                              ? "text-amber-400 font-bold"
                              : "text-rose-400 font-bold"
                        }
                      >
                        {t.delayAfter === 0 ? "On time" : `+${t.delayAfter}m`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted text-[10px] hidden sm:table-cell max-w-[200px]">
                      {t.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Locked blocks note */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
            <Clock className="size-3.5 shrink-0" />
            <span>
              Locked past commitments: B-001 (Mon 01:30–05:30), B-002 (Mon 23:00–03:00), B-003 (Tue 02:00–06:00) — preserved unchanged per rolling-horizon constraint.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
