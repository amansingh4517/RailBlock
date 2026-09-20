import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  HardHat,
  Wrench,
  TrainTrack,
  FileText,
  AlertTriangle,
  Layers,
  Clock,
  CheckCircle2,
  CalendarDays,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  X,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeptBadge, StatusBadge, PriorityBar } from "@/components/rail/bits";
import { useRailStore } from "@/lib/rail/store";
import { RESOURCES } from "@/lib/rail/data";
import { formatSpan, minToHhmm, weekday, formatHours, severityLabel } from "@/lib/rail/format";
import { priorityScore, scoreBreakdown } from "@/lib/rail/scoring";
import { WEEK_START, type Task, type Line, type TaskStatus } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["overview", "work", "possessions", "requisitions"]).catch("overview").optional(),
});

export const Route = createFileRoute("/workspace/engineering")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: EngineeringWorkspacePage,
});

function EngineeringWorkspacePage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "overview";

  return (
    <AuthGuard allowedRoles={["ENGG", "ADMIN"]}>
      <Shell currentTab={currentTab}>
        <EngineeringMain currentTab={currentTab} />
      </Shell>
    </AuthGuard>
  );
}

function EngineeringMain({ currentTab }: { currentTab: string }) {
  const session = useRailStore((s) => s.session);
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);
  const addTask = useRailStore((s) => s.addTask);

  const enggTasks = tasks.filter((t) => t.department === "ENGG");
  const enggBlocks = blocks.filter(
    (b) => b.departments.includes("ENGG") && b.date >= WEEK_START
  );
  const sanctionedEnggBlocks = enggBlocks.filter((b) => b.status === "APPROVED");
  const enggMachines = RESOURCES.filter(
    (m) =>
      m.kind === "MACHINE" &&
      (m.name.includes("BCM") ||
        m.name.includes("CSM") ||
        m.name.includes("Tamping") ||
        m.name.includes("Unimat") ||
        m.name.includes("DGS"))
  );

  const pendingTasks = enggTasks.filter((t) => t.status === "OPEN");
  const plannedTasks = enggTasks.filter((t) => t.status === "PLANNED");
  const criticalTasks = enggTasks.filter((t) => t.severity >= 4 && t.status !== "DONE");

  // Selected task for contextual detail drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = enggTasks.find((t) => t.id === selectedTaskId);

  // Engineering Requisition Presets
  const ENGG_PRESETS = [
    {
      name: "Kurukshetra Turnout Renewal",
      title: "1 in 12 Fan-Shaped Turnout Renewal & Deep Packing",
      fromKm: "142",
      toKm: "148",
      line: "UP" as Line,
      workType: "Track Renewal & Tamping",
      duration: "3.5",
      machine: "BCM-102",
      severity: "4",
      tsr: "30 km/h for 48 hrs",
      notes: "Turnout Point 204B Kurukshetra yard renewal. Track machine packing gang required.",
    },
    {
      name: "Panipat BCM Deep Screening",
      title: "Ballast Cleaning Machine (BCM) Deep Screening & Sump Clearing",
      fromKm: "85",
      toKm: "92",
      line: "DN" as Line,
      workType: "Deep Screening (BCM)",
      duration: "4.0",
      machine: "BCM-102",
      severity: "5",
      tsr: "20 km/h caution order",
      notes: "Heavy mud pumping zone between Samalkha and Panipat. Essential for monsoon drainage.",
    },
    {
      name: "IMR Rail Fracture Repair",
      title: "Ultrasonic IMR Rail Flaw Cut & Rail Tensor Welding",
      fromKm: "52",
      toKm: "54",
      line: "UP" as Line,
      workType: "Rail / Weld Flaw (IMR)",
      duration: "2.5",
      machine: "CSM-902",
      severity: "5",
      tsr: "Emergency Stop until de-stressing",
      notes: "USFD detected internal transverse fissure. Immediate emergency possession required.",
    },
  ];

  // Form state for Requisitions
  const [reqTitle, setReqTitle] = useState("");
  const [reqFromKm, setReqFromKm] = useState("45");
  const [reqToKm, setReqToKm] = useState("50");
  const [reqLine, setReqLine] = useState<Line>("UP");
  const [reqWorkType, setReqWorkType] = useState("Track Renewal & Tamping");
  const [reqDuration, setReqDuration] = useState("3.5");
  const [reqMachine, setReqMachine] = useState("BCM-102");
  const [reqSeverity, setReqSeverity] = useState("4");
  const [reqTsr, setReqTsr] = useState("30 km/h for 48 hrs");
  const [reqNotes, setReqNotes] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(p: (typeof ENGG_PRESETS)[0]) {
    setReqTitle(p.title);
    setReqFromKm(p.fromKm);
    setReqToKm(p.toKm);
    setReqLine(p.line);
    setReqWorkType(p.workType);
    setReqDuration(p.duration);
    setReqMachine(p.machine);
    setReqSeverity(p.severity);
    setReqTsr(p.tsr);
    setReqNotes(p.notes);
    setActivePreset(p.name);
    toast.info(`Preset applied: "${p.name}". Review and submit.`);
  }

  function handleRequisitionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reqTitle.trim()) {
      toast.error("Please enter a title for the requisition");
      return;
    }

    const from = parseFloat(reqFromKm) || 40;
    const to = parseFloat(reqToKm) || 45;
    const dur = parseFloat(reqDuration) || 3.0;
    const sev = parseInt(reqSeverity, 10) as 1 | 2 | 3 | 4 | 5;

    const newTask: Task = {
      id: `REQ-ENGG-${Date.now().toString().slice(-4)}`,
      source: "BDMS",
      department: "ENGG",
      title: reqTitle.trim(),
      detail: `${reqWorkType} on ${reqLine} line. Machine requested: ${reqMachine}. TSR: ${reqTsr}. Notes: ${reqNotes || "None"}`,
      fromKm: Math.min(from, to),
      toKm: Math.max(from, to),
      line: reqLine,
      durationHours: dur,
      severity: sev,
      overdueDays: 0,
      trafficImpact: sev >= 4 ? 4 : 2,
      safetyRisk: sev >= 4 ? 5 : 3,
      resourceIds: [reqMachine],
      earliest: "2026-09-07",
      latest: "2026-09-13",
      canBundle: true,
      status: "OPEN",
    };

    addTask(newTask);
    toast.success(`BDMS Requisition ${newTask.id} submitted into unified corridor queue`);
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
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold font-mono">
                  <HardHat className="size-3.5" />
                  Civil &amp; Permanent Way Department
                </span>
                <span>·</span>
                <span>Sonipat – Panipat – Ambala Section (Km 0 – 199)</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-5xl font-bold">
                Engineering Overview
              </h1>
            </div>

            <Button asChild size="sm" className="gap-2">
              <Link to="/workspace/engineering" search={{ tab: "requisitions" }}>
                <FileText className="size-4" />
                <span>Submit BDMS Requisition</span>
              </Link>
            </Button>
          </header>

          {/* Compact Operational KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Total P-Way Tasks</p>
              <p className="font-display text-3xl font-bold mt-1 text-fg">{enggTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">{plannedTasks.length} Seated in Block Plan</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Unresolved Defects</p>
              <p className="font-display text-3xl font-bold mt-1 text-amber-400">{pendingTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">Awaiting Control allocation</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Track Possessions</p>
              <p className="font-display text-3xl font-bold mt-1 text-primary">{enggBlocks.length}</p>
              <p className="text-[11px] text-muted mt-1">
                {sanctionedEnggBlocks.length} Sanctioned · {enggBlocks.length - sanctionedEnggBlocks.length} Pending
              </p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Track Machines</p>
              <p className="font-display text-3xl font-bold mt-1 text-emerald-400">
                {enggMachines.length} Active
              </p>
              <p className="text-[11px] text-muted mt-1">BCM, CSM, Tamping units</p>
            </div>
          </div>

          {/* Critical Work Snapshot */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <span>Critical Track Defects</span>
                </h2>
                <Link
                  to="/workspace/engineering"
                  search={{ tab: "work" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View Queue ({enggTasks.length}) →
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
                      <span>Line: {t.line} · Duration: {formatHours(t.durationHours)}</span>
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-danger">
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
                  <TrainTrack className="size-4 text-primary" />
                  <span>Upcoming Possessions</span>
                </h2>
                <Link
                  to="/workspace/engineering"
                  search={{ tab: "possessions" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View All ({enggBlocks.length}) →
                </Link>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {enggBlocks.slice(0, 3).map((b) => (
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

      {/* Tab 2: TRACK WORK */}
      {currentTab === "work" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Track Work Queue</h1>
              <p className="text-xs text-muted">Permanent Way defects and scheduled maintenance jobs</p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {enggTasks.length} P-Way Records
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">Task / Defect</th>
                    <th className="px-3 py-2.5">Span</th>
                    <th className="px-3 py-2.5">Line</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enggTasks.map((t) => {
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
                        <td className="px-3 py-2.5 font-mono text-[10px]">{t.line}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{formatHours(t.durationHours)}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                              t.status === "PLANNED"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
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

            {/* Contextual Task Drawer */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
              {selectedTask ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-primary uppercase tracking-wider">
                        {selectedTask.source} Work Order · {selectedTask.id}
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
                      <span className="text-muted">Line:</span>
                      <span className="text-fg">{selectedTask.line} Line</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Estimated Duration:</span>
                      <span className="text-fg">{formatHours(selectedTask.durationHours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Severity:</span>
                      <span className="text-amber-400 font-bold">Level {selectedTask.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Safety Risk:</span>
                      <span className="text-fg">{selectedTask.safetyRisk}/5</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-semibold text-fg">Machine Logistics</h4>
                    <div className="rounded-lg border border-border p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Allocated Machine:</span>
                        <span className="font-mono text-fg font-bold">
                          {selectedTask.resourceIds[0] || "Tamping Unit"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Machine ready at Panipat siding. Fueling and crew clearance verified.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-semibold text-fg">Bundling Opportunity</h4>
                    <p className="text-xs text-muted">
                      {selectedTask.canBundle
                        ? "Eligible for shadow block clustering with S&T and TRD in the same km span."
                        : "Requires isolated corridor possession."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-muted text-xs space-y-2">
                  <Wrench className="size-8 text-muted/50" />
                  <p>Select any task from the queue to inspect operational risk, machine logistics, and train impact.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: POSSESSIONS */}
      {currentTab === "possessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Track Possessions</h1>
              <p className="text-xs text-muted">
                Track access and corridor block schedule for Civil &amp; Permanent Way maintenance
              </p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {enggBlocks.length} Scheduled Possessions
            </span>
          </div>

          <div className="space-y-3">
            {enggBlocks.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border bg-surface p-4 space-y-3 hover:border-primary/40 transition-colors"
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
                    <span className="text-xs font-mono text-muted">·</span>
                    <span className="text-xs font-mono text-muted">
                      Line: <strong className="text-fg">{b.line}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px] font-mono">Assigned Machines</span>
                    <span className="font-mono font-medium text-fg mt-0.5 block">
                      BCM-102 · CSM Tamping (Clear)
                    </span>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px] font-mono">Participating Depts</span>
                    <div className="flex gap-1 mt-1">
                      {b.departments.map((d) => (
                        <DeptBadge key={d} d={d} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px] font-mono">Concurrence Status</span>
                    {b.status === "APPROVED" ? (
                      <span className="text-emerald-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Sanctioned by Control
                      </span>
                    ) : b.status === "REJECTED" ? (
                      <span className="text-rose-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                        <Ban className="size-3.5" />
                        Sanction Withheld
                      </span>
                    ) : (
                      <span className="text-amber-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                        <Clock className="size-3.5" />
                        Awaiting Control Sanction
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
              Submit BDMS Track Requisition
            </h1>
            <p className="text-xs text-muted mt-1">
              Submit track maintenance demands directly into the central RailBlock priority and optimization engine.
            </p>
          </header>

          {/* Preset scenarios bar */}
          <div className="rounded-xl border border-border bg-surface-2/60 p-3.5 space-y-2 max-w-2xl">
            <span className="text-[11px] font-mono uppercase text-muted font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span>Quick-Fill Requisition Presets</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {ENGG_PRESETS.map((p) => {
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
              <Label htmlFor="reqTitle" className="text-xs font-mono">
                Requisition Title / Defect Summary
              </Label>
              <Input
                id="reqTitle"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="e.g. Ultrasonic IMR Rail Defect Repair & Tamping"
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reqFrom" className="text-xs font-mono">
                  From Km
                </Label>
                <Input
                  id="reqFrom"
                  type="number"
                  value={reqFromKm}
                  onChange={(e) => setReqFromKm(e.target.value)}
                  placeholder="e.g. 45"
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reqTo" className="text-xs font-mono">
                  To Km
                </Label>
                <Input
                  id="reqTo"
                  type="number"
                  value={reqToKm}
                  onChange={(e) => setReqToKm(e.target.value)}
                  placeholder="e.g. 50"
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Track Line</Label>
                <Select value={reqLine} onValueChange={(v) => setReqLine(v as Line)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UP">UP Line (Towards NDLS)</SelectItem>
                    <SelectItem value="DN">DN Line (Towards UMB)</SelectItem>
                    <SelectItem value="BOTH">BOTH Lines</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Requested Machine</Label>
                <Select value={reqMachine} onValueChange={setReqMachine}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BCM-102">BCM-102 (Ballast Cleaner)</SelectItem>
                    <SelectItem value="CSM-44">CSM-44 (Continuous Tamping)</SelectItem>
                    <SelectItem value="UNIMAT-08">UNIMAT Points Tamper</SelectItem>
                    <SelectItem value="DGS-62">DGS Dynamic Stabilizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reqDur" className="text-xs font-mono">
                  Requested Duration (Hours)
                </Label>
                <Input
                  id="reqDur"
                  type="number"
                  step="0.5"
                  value={reqDuration}
                  onChange={(e) => setReqDuration(e.target.value)}
                  placeholder="e.g. 3.5"
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Defect Severity</Label>
                <Select value={reqSeverity} onValueChange={setReqSeverity}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Level 5 (Emergency IMR Fracture)</SelectItem>
                    <SelectItem value="4">Level 4 (Severe Geometry Flaw)</SelectItem>
                    <SelectItem value="3">Level 3 (Routine Renewal)</SelectItem>
                    <SelectItem value="2">Level 2 (Preventive Maintenance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reqTsr" className="text-xs font-mono">
                Post-Work Temporary Speed Restriction (TSR)
              </Label>
              <Input
                id="reqTsr"
                value={reqTsr}
                onChange={(e) => setReqTsr(e.target.value)}
                placeholder="e.g. 30 km/h for 48 hrs"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reqNotes" className="text-xs font-mono">
                Operational Notes &amp; Gang Strength
              </Label>
              <Input
                id="reqNotes"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="e.g. 15 P-Way gang laborers deployed under SSE Sonipat"
                className="text-sm"
              />
            </div>

            <Button type="submit" className="w-full gap-2" size="lg">
              <FileText className="size-4" />
              <span>Submit Requisition to BDMS Queue</span>
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
