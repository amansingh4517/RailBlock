import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  Zap,
  FileText,
  Wrench,
  TrainTrack,
  CheckCircle2,
  AlertTriangle,
  Power,
  PowerOff,
  Clock,
  Sparkles,
  Ban,
  X,
  XCircle,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { RequestFlow } from "@/components/control/request-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeptBadge, StatusBadge, PriorityBar } from "@/components/rail/bits";
import { useRailStore } from "@/lib/rail/store";
import { formatSpan, minToHhmm, weekday, formatHours } from "@/lib/rail/format";
import { scoreBreakdown } from "@/lib/rail/scoring";
import { WEEK_START, type Task, type Line } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["overview", "work", "power-blocks", "requisitions"]).catch("overview").optional(),
});

export const Route = createFileRoute("/workspace/trd")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: TrdWorkspacePage,
});

function TrdWorkspacePage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "overview";

  return (
    <AuthGuard allowedRoles={["TRD", "ADMIN"]}>
      <Shell currentTab={currentTab}>
        <TrdMain currentTab={currentTab} />
      </Shell>
    </AuthGuard>
  );
}

function TrdMain({ currentTab }: { currentTab: string }) {
  const session = useRailStore((s) => s.session);
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);
  const addTask = useRailStore((s) => s.addTask);

  const trdTasks = tasks.filter((t) => t.department === "TRD");
  const trdBlocks = blocks.filter(
    (b) => b.departments.includes("TRD") && b.date >= WEEK_START
  );
  const sanctionedTrdBlocks = trdBlocks.filter((b) => b.status === "APPROVED");

  const pendingTasks = trdTasks.filter((t) => t.status === "OPEN");
  const plannedTasks = trdTasks.filter((t) => t.status === "PLANNED");
  const criticalTasks = trdTasks.filter((t) => t.severity >= 4 && t.status !== "DONE");

  // Selected task drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = trdTasks.find((t) => t.id === selectedTaskId);

  // TRD Requisition Presets
  const TRD_PRESETS = [
    {
      name: "Panipat Neutral Section Overhaul",
      title: "PTFE Neutral Section Inspection & Overhaul",
      feeder: "Panipat Substation (PNP-TSS/108)",
      isolation: "25kV Both Lines Isolated",
      depot: "Panipat (PNP) Depot",
      fromKm: "86",
      toKm: "94",
      duration: "3.0",
      severity: "4",
      notes: "PTFE glide rods inspection, contact wire wear measurement, and dynamic pantograph check.",
    },
    {
      name: "Insulator Washing & Cantilever",
      title: "Hotline OHE Composite Insulator Washing & Cantilever Adjustment",
      feeder: "Kurukshetra Substation (KKDE-TSS/201)",
      isolation: "25kV UP Line Isolated",
      depot: "Kurukshetra (KKDE) Depot",
      fromKm: "110",
      toKm: "118",
      duration: "2.5",
      severity: "3",
      notes: "Pollution cleaning on 25kV bracket insulators near industrial zone. Tower wagon required.",
    },
    {
      name: "Contact Wire Replacement",
      title: "107 sq mm Hard Drawn Grooved Copper Contact Wire Renewal",
      feeder: "Ambala Traction Post (UMB-TSS/312)",
      isolation: "25kV Both Lines Isolated",
      depot: "Ambala Cantt (UMB) Depot",
      fromKm: "182",
      toKm: "190",
      duration: "4.0",
      severity: "5",
      notes: "Critical contact wire condemnation limit reached (less than 74 sq mm). Immediate rewiring.",
    },
  ];

  // Form state
  const [reqTitle, setReqTitle] = useState("");
  const [reqFeeder, setReqFeeder] = useState("Kurukshetra Substation (KKDE-TSS/201)");
  const [reqIsolation, setReqIsolation] = useState("25kV Both Lines Isolated");
  const [reqDepot, setReqDepot] = useState("Kurukshetra (KKDE) Depot");
  const [reqFromKm, setReqFromKm] = useState("140");
  const [reqToKm, setReqToKm] = useState("148");
  const [reqDuration, setReqDuration] = useState("3.0");
  const [reqSeverity, setReqSeverity] = useState("4");
  const [reqNotes, setReqNotes] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(p: (typeof TRD_PRESETS)[0]) {
    setReqTitle(p.title);
    setReqFeeder(p.feeder);
    setReqIsolation(p.isolation);
    setReqDepot(p.depot);
    setReqFromKm(p.fromKm);
    setReqToKm(p.toKm);
    setReqDuration(p.duration);
    setReqSeverity(p.severity);
    setReqNotes(p.notes);
    setActivePreset(p.name);
    toast.info(`Preset applied: "${p.name}". Review and submit.`);
  }

  function handleRequisitionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reqTitle.trim()) {
      toast.error("Please enter a title for the power block request");
      return;
    }

    const from = parseFloat(reqFromKm) || 140;
    const to = parseFloat(reqToKm) || 148;
    const dur = parseFloat(reqDuration) || 3.0;
    const sev = parseInt(reqSeverity, 10) as 1 | 2 | 3 | 4 | 5;

    const newTask: Task = {
      id: `REQ-TRD-${Date.now().toString().slice(-4)}`,
      source: "TDMS",
      department: "TRD",
      title: reqTitle.trim(),
      detail: `Elementary Feeder: ${reqFeeder}. Isolation: ${reqIsolation}. Tower Wagon: ${reqDepot}. Notes: ${reqNotes || "OHE tensioning"}`,
      fromKm: Math.min(from, to),
      toKm: Math.max(from, to),
      line: "BOTH",
      durationHours: dur,
      severity: sev,
      overdueDays: 0,
      trafficImpact: sev >= 4 ? 75 : 45,
      safetyRisk: sev >= 4 ? 85 : 55,
      resourceIds: ["Tower Wagon TW-04"],
      earliest: "2026-09-07",
      latest: "2026-09-13",
      canBundle: true,
      status: "NEW",
    };

    addTask(newTask);
    toast.success(`25kV Power Block Requisition ${newTask.id} submitted into central queue`);
    setReqTitle("");
    setReqNotes("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Tab 1: OVERVIEW */}
      {currentTab === "overview" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
                  <Zap className="size-3.5" />
                  Traction Distribution (TRD) Department
                </span>
                <span>·</span>
                <span>25kV AC Overhead Equipment (OHE) Section (Km 0 – 199)</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-5xl font-bold">
                TRD Overview
              </h1>
            </div>

            <Button asChild size="sm" className="gap-2">
              <Link to="/workspace/trd" search={{ tab: "requisitions" }}>
                <FileText className="size-4" />
                <span>Request 25kV Power Block</span>
              </Link>
            </Button>
          </header>

          {/* TRD KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">TRD Requisitions</p>
              <p className="font-display text-3xl font-bold mt-1 text-fg">{trdTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">{plannedTasks.length} Seated in Block Plan</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Pending Power Blocks</p>
              <p className="font-display text-3xl font-bold mt-1 text-emerald-400">{pendingTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">Awaiting Control Office sanction</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Sanctioned OHE Blocks</p>
              <p className="font-display text-3xl font-bold mt-1 text-primary">{sanctionedTrdBlocks.length}</p>
              <p className="text-[11px] text-muted mt-1">Tower Wagon &amp; Ladder Gangs</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Tower Wagons</p>
              <p className="font-display text-3xl font-bold mt-1 text-sky-400">4 Operational</p>
              <p className="text-[11px] text-muted mt-1">Base depots: DLI, PNP, KKDE, UMB</p>
            </div>
          </div>

          {/* Critical Work Snapshot */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-emerald-400" />
                  <span>Critical OHE Work Orders</span>
                </h2>
                <Link
                  to="/workspace/trd"
                  search={{ tab: "work" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View Queue ({trdTasks.length}) →
                </Link>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {criticalTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="p-3 bg-surface hover:bg-surface-2 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-fg">{t.id}</span>
                      <span className="font-mono text-muted">{formatSpan(t.fromKm, t.toKm)}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{t.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted mt-2">
                      <span>Duration: {formatHours(t.durationHours)}</span>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                        Sev {t.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Power className="size-4 text-primary" />
                  <span>Upcoming Power Blocks</span>
                </h2>
                <Link
                  to="/workspace/trd"
                  search={{ tab: "power-blocks" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View All ({trdBlocks.length}) →
                </Link>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {trdBlocks.slice(0, 3).map((b) => (
                  <div key={b.id} className="p-3 bg-surface hover:bg-surface-2 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-fg">{b.id}</span>
                      <span className="font-mono text-muted">
                        {weekday(b.date)} {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span>{formatSpan(b.fromKm, b.toKm)}</span>
                      <span className="font-mono text-xs text-muted">{formatHours(b.durationHours)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-1">
                        {b.departments.map((d) => (
                          <DeptBadge key={d} d={d} />
                        ))}
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 2: OHE WORK */}
      {currentTab === "work" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">OHE Maintenance Queue</h1>
              <p className="text-xs text-muted">Contact wire inspection, cantilever adjustments, and neutral sections</p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {trdTasks.length} TRD Records
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">OHE Defect</th>
                    <th className="px-3 py-2.5">Span</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trdTasks.map((t) => {
                    const isSelected = selectedTaskId === t.id;
                    const score = scoreBreakdown(t);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-surface-2" : "hover:bg-surface-2/60"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <PriorityBar score={score.total} />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-fg text-xs">{t.title}</p>
                          <p className="font-mono text-[10px] text-muted">
                            {t.id} · {t.source}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{formatSpan(t.fromKm, t.toKm)}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{formatHours(t.durationHours)}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                              t.status === "PLANNED"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-emerald-500/15 text-emerald-400"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Contextual Drawer */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
              {selectedTask ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider">
                        {selectedTask.source} · {selectedTask.id}
                      </span>
                      <h3 className="font-display text-xl font-bold mt-0.5">{selectedTask.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(null)}
                      className="text-muted hover:text-fg"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">{selectedTask.detail}</p>

                  <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted">Span:</span>
                      <span className="text-fg">{formatSpan(selectedTask.fromKm, selectedTask.toKm)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Estimated Duration:</span>
                      <span className="text-fg">{formatHours(selectedTask.durationHours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Power Isolation Req:</span>
                      <span className="text-amber-400 font-bold">25kV AC Discharge Rods</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Safety Criticality:</span>
                      <span className="text-fg">{selectedTask.safetyRisk}/5</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-semibold text-fg">Tower Wagon Logistics</h4>
                    <p className="text-xs text-muted">
                      Tower Wagon from Kurukshetra Base Depot booked for this possession. Diesel locomotive assist ready.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-muted text-xs space-y-2">
                  <Zap className="size-8 text-muted/50" />
                  <p>Select any OHE task from the queue to inspect 25kV power isolation details and tower wagon assignments.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: POWER BLOCKS */}
      {currentTab === "power-blocks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">25kV Power Blocks &amp; PTW</h1>
              <p className="text-xs text-muted">
                Overhead traction isolation permits, SCADA substation status, and tower wagon movements
              </p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {trdBlocks.length} Sanctioned Power Blocks
            </span>
          </div>

          <div className="space-y-3">
            {trdBlocks.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border bg-surface p-4 space-y-3 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-fg">{b.id}</span>
                    <span className="font-mono text-xs text-muted">
                      {weekday(b.date)} {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">
                      Span: <strong className="text-fg">{formatSpan(b.fromKm, b.toKm)}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-xs font-mono">
                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">SCADA State</span>
                    {b.status === "APPROVED" ? (
                      <span className="text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <Power className="size-3.5" />
                        ISOLATED (Permitted)
                      </span>
                    ) : b.status === "REJECTED" ? (
                      <span className="text-rose-400 font-bold mt-1 flex items-center gap-1">
                        <PowerOff className="size-3.5" />
                        Energized (Traffic Priority)
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold mt-1 flex items-center gap-1">
                        <Zap className="size-3.5" />
                        Energized (Pending Isolation)
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">PTW (Permit to Work)</span>
                    {b.status === "APPROVED" ? (
                      <span className="text-fg font-medium mt-1 block">
                        PTW-TRD-2026-088 (Signed)
                      </span>
                    ) : b.status === "REJECTED" ? (
                      <span className="text-rose-400 font-medium mt-1 flex items-center gap-1">
                        <XCircle className="size-3.5" />
                        Not Authorized
                      </span>
                    ) : (
                      <span className="text-muted font-medium mt-1 block">
                        Draft (Pending Sanction)
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">Tower Wagon Depot</span>
                    <span className="text-fg font-medium mt-1 block">
                      {b.status === "REJECTED" ? "Released to Yard" : "TW-04 (Base: Kurukshetra)"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">Earthing Discharge</span>
                    {b.status === "APPROVED" ? (
                      <span className="text-emerald-400 font-medium mt-1 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Rods Placed
                      </span>
                    ) : b.status === "REJECTED" ? (
                      <span className="text-rose-400 font-medium mt-1 flex items-center gap-1">
                        <Ban className="size-3.5" />
                        Not Permitted
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium mt-1 flex items-center gap-1">
                        <Clock className="size-3.5" />
                        Pending Sanction
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: REQUISITIONS */}
      {currentTab === "requisitions" && (
        <div className="space-y-6">
          <header>
            <h1 className="font-display text-2xl md:text-3xl font-bold">
              Submit 25kV Power Block Requisition
            </h1>
            <p className="text-xs text-muted mt-1">
              Request SCADA feeder power isolation, PTW permits, and tower wagon track possessions.
            </p>
          </header>

          <RequestFlow department="TRD" />

          {/* Preset scenarios bar */}
          <div className="rounded-xl border border-border bg-surface-2/60 p-3.5 space-y-2 max-w-2xl">
            <span className="text-[11px] font-mono uppercase text-muted font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span>Quick-Fill 25kV Power Block Presets</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {TRD_PRESETS.map((p) => {
                const isActive = activePreset === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors text-left flex items-center gap-1.5 ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-border bg-surface hover:border-primary/50 text-fg"
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-muted">({p.duration}h)</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleRequisitionSubmit}
            className="rounded-2xl border border-border bg-surface p-6 space-y-6 max-w-2xl"
          >
            <div className="space-y-1.5">
              <Label htmlFor="trdTitle" className="text-xs font-mono">
                Requisition Title / OHE Maintenance Summary
              </Label>
              <Input
                id="trdTitle"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="e.g. Contact Wire Replacement &amp; Stagger Adjustment"
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Elementary Feeding Section</Label>
                <Select value={reqFeeder} onValueChange={setReqFeeder}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kurukshetra Substation (KKDE-TSS/201)">KKDE-TSS/201 (Kurukshetra)</SelectItem>
                    <SelectItem value="Panipat Substation (PNP-TSS/108)">PNP-TSS/108 (Panipat)</SelectItem>
                    <SelectItem value="Sonipat Feeding Post (SNP-FP/042)">SNP-FP/042 (Sonipat)</SelectItem>
                    <SelectItem value="Ambala Traction Post (UMB-TSS/312)">UMB-TSS/312 (Ambala)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Power Isolation Type</Label>
                <Select value={reqIsolation} onValueChange={setReqIsolation}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25kV Both Lines Isolated">25kV Both Lines Isolated</SelectItem>
                    <SelectItem value="UP Line 25kV Isolated (DN Clear)">UP Line Isolated (DN Clear)</SelectItem>
                    <SelectItem value="DN Line 25kV Isolated (UP Clear)">DN Line Isolated (UP Clear)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="trdFrom" className="text-xs font-mono">
                  From Km
                </Label>
                <Input
                  id="trdFrom"
                  type="number"
                  value={reqFromKm}
                  onChange={(e) => setReqFromKm(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="trdTo" className="text-xs font-mono">
                  To Km
                </Label>
                <Input
                  id="trdTo"
                  type="number"
                  value={reqToKm}
                  onChange={(e) => setReqToKm(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Tower Wagon Origin Depot</Label>
                <Select value={reqDepot} onValueChange={setReqDepot}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kurukshetra (KKDE) Depot">Kurukshetra (KKDE) Depot</SelectItem>
                    <SelectItem value="Panipat (PNP) Depot">Panipat (PNP) Depot</SelectItem>
                    <SelectItem value="Delhi (DLI) Base Depot">Delhi (DLI) Base Depot</SelectItem>
                    <SelectItem value="Ambala Cantt (UMB) Depot">Ambala Cantt (UMB) Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="trdDur" className="text-xs font-mono">
                  Requested Duration (Hours)
                </Label>
                <Input
                  id="trdDur"
                  type="number"
                  step="0.5"
                  value={reqDuration}
                  onChange={(e) => setReqDuration(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trdNotes" className="text-xs font-mono">
                Operational &amp; Safety Notes
              </Label>
              <Input
                id="trdNotes"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="e.g. Earthing discharge rods to be locked with SSE Kurukshetra"
                className="text-sm"
              />
            </div>

            <Button type="submit" className="w-full gap-2" size="lg">
              <FileText className="size-4" />
              <span>Submit 25kV Power Block Request</span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
