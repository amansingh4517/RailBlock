import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  Radio,
  Wrench,
  TrainTrack,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Network,
  X,
  Printer,
  Sparkles,
  Clock,
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
import { formatSpan, minToHhmm, weekday, formatHours } from "@/lib/rail/format";
import { scoreBreakdown } from "@/lib/rail/scoring";
import { WEEK_START, type Task, type Line } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["overview", "work", "possessions", "requisitions"]).catch("overview").optional(),
});

export const Route = createFileRoute("/workspace/snt")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: SntWorkspacePage,
});

function SntWorkspacePage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "overview";

  return (
    <AuthGuard allowedRoles={["SNT", "ADMIN"]}>
      <Shell currentTab={currentTab}>
        <SntMain currentTab={currentTab} />
      </Shell>
    </AuthGuard>
  );
}

function SntMain({ currentTab }: { currentTab: string }) {
  const session = useRailStore((s) => s.session);
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);
  const addTask = useRailStore((s) => s.addTask);
  const addAuditLog = useRailStore((s) => s.addAuditLog);

  const sntTasks = tasks.filter((t) => t.department === "SNT");
  const sntBlocks = blocks.filter(
    (b) => b.departments.includes("SNT") && b.date >= WEEK_START
  );
  const sanctionedSntBlocks = sntBlocks.filter((b) => b.status === "APPROVED");

  const pendingTasks = sntTasks.filter((t) => t.status === "OPEN");
  const plannedTasks = sntTasks.filter((t) => t.status === "PLANNED");
  const criticalTasks = sntTasks.filter((t) => t.severity >= 4 && t.status !== "DONE");

  // Selected task for drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = sntTasks.find((t) => t.id === selectedTaskId);

  // S&T Requisition Presets
  const SNT_PRESETS = [
    {
      name: "Point 104 Machine Overhaul",
      title: "Point Machine 104B Overhaul, Ground Connection & Detection Testing",
      station: "Panipat (PNP)",
      gear: "Point Machine 104B",
      fromKm: "88",
      toKm: "91",
      duration: "2.5",
      severity: "4",
      notes: "Quarterly overhaul of IRS rotary point machine. Obstruction test (3.25mm) and T-351 notice required.",
    },
    {
      name: "Axle Counter Calibration",
      title: "Dual Multi-Section Digital Axle Counter (MSDAC) Reset & Calibration",
      station: "Kurukshetra (KKDE)",
      gear: "Dual MSDAC BPAC System",
      fromKm: "150",
      toKm: "154",
      duration: "1.5",
      severity: "3",
      notes: "Periodic calibration of track-side wheel sensors and evaluator card inspection under blocked condition.",
    },
    {
      name: "Track Circuit Overhaul",
      title: "DC Track Circuit Insulated Rail Joint (IRJ) Testing & Relay Overhaul",
      station: "Karnal (KUN)",
      gear: "DC Track Circuit TC-42A",
      fromKm: "120",
      toKm: "123",
      duration: "2.0",
      severity: "4",
      notes: "IRJ end-post replacement, ballast resistance measurement, and shelf-type relay pickup/drop test.",
    },
  ];

  // Form state
  const [reqTitle, setReqTitle] = useState("");
  const [reqStation, setReqStation] = useState("Panipat (PNP)");
  const [reqGear, setReqGear] = useState("Point Machine 102A");
  const [reqFromKm, setReqFromKm] = useState("88");
  const [reqToKm, setReqToKm] = useState("92");
  const [reqDuration, setReqDuration] = useState("2.5");
  const [reqSeverity, setReqSeverity] = useState("4");
  const [reqNotes, setReqNotes] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showT351Modal, setShowT351Modal] = useState(false);

  function applyPreset(p: (typeof SNT_PRESETS)[0]) {
    setReqTitle(p.title);
    setReqStation(p.station);
    setReqGear(p.gear);
    setReqFromKm(p.fromKm);
    setReqToKm(p.toKm);
    setReqDuration(p.duration);
    setReqSeverity(p.severity);
    setReqNotes(p.notes);
    setActivePreset(p.name);
    toast.info(`Preset applied: "${p.name}". Review and submit.`);
  }

  function handleIssueT351Notice() {
    addAuditLog(
      "T351_ISSUE",
      `Form S&T T-351 Disconnection Notice formally served to Station Master for ${reqGear || "Signaling Gear"} at ${reqStation}.`
    );
    toast.success("T-351 Disconnection Notice issued to Station Master successfully.");
    setShowT351Modal(false);
  }

  function handleRequisitionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reqTitle.trim()) {
      toast.error("Please enter a title for the requisition");
      return;
    }

    const from = parseFloat(reqFromKm) || 88;
    const to = parseFloat(reqToKm) || 92;
    const dur = parseFloat(reqDuration) || 2.5;
    const sev = parseInt(reqSeverity, 10) as 1 | 2 | 3 | 4 | 5;

    const newTask: Task = {
      id: `REQ-SNT-${Date.now().toString().slice(-4)}`,
      source: "SMMS",
      department: "SNT",
      title: reqTitle.trim(),
      detail: `Station: ${reqStation}. Gear: ${reqGear}. S&T T-351 Disconnection required. Notes: ${reqNotes || "Routine inspection"}`,
      fromKm: Math.min(from, to),
      toKm: Math.max(from, to),
      line: "BOTH",
      durationHours: dur,
      severity: sev,
      overdueDays: 0,
      trafficImpact: sev >= 4 ? 4 : 2,
      safetyRisk: sev >= 4 ? 5 : 3,
      resourceIds: ["S&T Maintenance Gang"],
      earliest: "2026-09-07",
      latest: "2026-09-13",
      canBundle: true,
      status: "OPEN",
    };

    addTask(newTask);
    toast.success(`S&T Requisition ${newTask.id} registered into central corridor queue`);
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
                <span className="flex items-center gap-1.5 text-sky-400 font-semibold font-mono">
                  <Radio className="size-3.5" />
                  Signal &amp; Telecommunication Department
                </span>
                <span>·</span>
                <span>Interlocking &amp; Telemetry Section (Km 0 – 199)</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-5xl font-bold">
                S&amp;T Overview
              </h1>
            </div>

            <Button asChild size="sm" className="gap-2">
              <Link to="/workspace/snt" search={{ tab: "requisitions" }}>
                <FileText className="size-4" />
                <span>Submit S&amp;T Requisition</span>
              </Link>
            </Button>
          </header>

          {/* S&T KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Total S&amp;T Requisitions</p>
              <p className="font-display text-3xl font-bold mt-1 text-fg">{sntTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">{plannedTasks.length} Seated in Block Plan</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Pending Disconnections</p>
              <p className="font-display text-3xl font-bold mt-1 text-sky-400">{pendingTasks.length}</p>
              <p className="text-[11px] text-muted mt-1">Awaiting Control Office sanction</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">Active S&amp;T Possessions</p>
              <p className="font-display text-3xl font-bold mt-1 text-primary">{sntBlocks.length}</p>
              <p className="text-[11px] text-muted mt-1">
                {sanctionedSntBlocks.length} Sanctioned · {sntBlocks.length - sanctionedSntBlocks.length} Pending
              </p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <p className="text-[11px] uppercase font-mono text-muted">EI Systems Monitored</p>
              <p className="font-display text-3xl font-bold mt-1 text-emerald-400">14 Stations</p>
              <p className="text-[11px] text-muted mt-1">Dual VDU / Hot-standby OK</p>
            </div>
          </div>

          {/* Critical Work Snapshot */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-sky-400" />
                  <span>Critical S&amp;T Defects</span>
                </h2>
                <Link
                  to="/workspace/snt"
                  search={{ tab: "work" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View Queue ({sntTasks.length}) →
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
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-400">
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
                  <Network className="size-4 text-primary" />
                  <span>Upcoming S&amp;T Possessions</span>
                </h2>
                <Link
                  to="/workspace/snt"
                  search={{ tab: "possessions" }}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  View All ({sntBlocks.length}) →
                </Link>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {sntBlocks.slice(0, 3).map((b) => (
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

      {/* Tab 2: S&T WORK */}
      {currentTab === "work" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">S&amp;T Work Queue</h1>
              <p className="text-xs text-muted">
                Point machines, track circuits, axle counters, and electronic interlocking systems
              </p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {sntTasks.length} S&amp;T Records
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5">Gear / Task</th>
                    <th className="px-3 py-2.5">Span</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sntTasks.map((t) => {
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
                                : "bg-sky-500/15 text-sky-400"
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

            {/* Contextual S&T Task Drawer */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
              {selectedTask ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-sky-400 uppercase tracking-wider">
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
                      <span className="text-muted">Section:</span>
                      <span className="text-fg">{formatSpan(selectedTask.fromKm, selectedTask.toKm)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Estimated Duration:</span>
                      <span className="text-fg">{formatHours(selectedTask.durationHours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Disconnection Req:</span>
                      <span className="text-amber-400 font-bold">Form S&amp;T T-351</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Safety Criticality:</span>
                      <span className="text-fg">{selectedTask.safetyRisk}/5</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-semibold text-fg">Shadow Possession Potential</h4>
                    <p className="text-xs text-muted">
                      Co-location with Engineering track tamping on this section allows gear disconnection with
                      no additional train detention.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center text-muted text-xs space-y-2">
                  <Radio className="size-8 text-muted/50" />
                  <p>Select any S&amp;T task from the queue to inspect disconnection dependencies and shadow bundling.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: POSSESSIONS & DISCONNECTIONS */}
      {currentTab === "possessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Possessions &amp; Disconnections</h1>
              <p className="text-xs text-muted">
                Combined operational board for S&amp;T disconnections, reconnections, and multi-department possessions
              </p>
            </div>
            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-2.5 py-1 border border-border">
              {sntBlocks.length} Active S&amp;T Possessions
            </span>
          </div>

          <div className="space-y-3">
            {sntBlocks.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border bg-surface p-4 space-y-3 hover:border-sky-500/40 transition-colors"
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
                      Location: <strong className="text-fg">{formatSpan(b.fromKm, b.toKm)}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-xs font-mono">
                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">Department Concurrence</span>
                    <div className="flex gap-1 mt-1">
                      {b.departments.map((d) => (
                        <DeptBadge key={d} d={d} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">Disconnection Memo (T-351)</span>
                    {b.status === "APPROVED" ? (
                      <span className="text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Disconnection Authorized
                      </span>
                    ) : b.status === "REJECTED" ? (
                      <span className="text-rose-400 font-bold mt-1 flex items-center gap-1">
                        <Ban className="size-3.5" />
                        Disconnection Denied
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold mt-1 flex items-center gap-1">
                        <Clock className="size-3.5" />
                        Draft (Pending Sanction)
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border">
                    <span className="text-muted block text-[11px]">Reconnection Status</span>
                    <span className="text-muted mt-1 block">Scheduled on completion</span>
                  </div>

                  <div className="rounded-lg bg-surface-2 p-2.5 border border-border flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs font-mono"
                      onClick={() => setShowT351Modal(true)}
                    >
                      <Printer className="size-3.5" />
                      <span>View T-351 Draft</span>
                    </Button>
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
              Submit S&amp;T Requisition &amp; Disconnection
            </h1>
            <p className="text-xs text-muted mt-1">
              Submit signaling and interlocking maintenance requisitions and generate simulated IR T-351 disconnection memos.
            </p>
          </header>

          {/* Preset scenarios bar */}
          <div className="rounded-xl border border-border bg-surface-2/60 p-3.5 space-y-2 max-w-2xl">
            <span className="text-[11px] font-mono uppercase text-muted font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span>Quick-Fill S&amp;T Requisition Presets</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {SNT_PRESETS.map((p) => {
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
              <Label htmlFor="sntTitle" className="text-xs font-mono">
                Requisition Title / S&amp;T Defect Summary
              </Label>
              <Input
                id="sntTitle"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="e.g. Overhaul Point Machine 102A &amp; Track Circuit Testing"
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Station Yard</Label>
                <Select value={reqStation} onValueChange={setReqStation}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Panipat (PNP)">Panipat (PNP)</SelectItem>
                    <SelectItem value="Sonipat (SNP)">Sonipat (SNP)</SelectItem>
                    <SelectItem value="Karnal (KUN)">Karnal (KUN)</SelectItem>
                    <SelectItem value="Kurukshetra (KKDE)">Kurukshetra (KKDE)</SelectItem>
                    <SelectItem value="Ambala Cantt (UMB)">Ambala Cantt (UMB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Interlocking Gear</Label>
                <Select value={reqGear} onValueChange={setReqGear}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Point Machine 102A">Point Machine 102A</SelectItem>
                    <SelectItem value="Track Circuit TC-44">Track Circuit TC-44</SelectItem>
                    <SelectItem value="Digital Axle Counter DAC-08">Digital Axle Counter DAC-08</SelectItem>
                    <SelectItem value="Signal Aspect Head S-12">Signal Aspect Head S-12</SelectItem>
                    <SelectItem value="Electronic Interlocking VDU">Electronic Interlocking VDU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sntFrom" className="text-xs font-mono">
                  From Km
                </Label>
                <Input
                  id="sntFrom"
                  type="number"
                  value={reqFromKm}
                  onChange={(e) => setReqFromKm(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sntTo" className="text-xs font-mono">
                  To Km
                </Label>
                <Input
                  id="sntTo"
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
                <Label htmlFor="sntDur" className="text-xs font-mono">
                  Requested Duration (Hours)
                </Label>
                <Input
                  id="sntDur"
                  type="number"
                  step="0.5"
                  value={reqDuration}
                  onChange={(e) => setReqDuration(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Safety Severity</Label>
                <Select value={reqSeverity} onValueChange={setReqSeverity}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Level 5 (Signal Failure / Points Locked)</SelectItem>
                    <SelectItem value="4">Level 4 (High Interlocking Defect)</SelectItem>
                    <SelectItem value="3">Level 3 (Routine Maintenance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sntNotes" className="text-xs font-mono">
                Disconnection Notes / Train Cautions Required
              </Label>
              <Input
                id="sntNotes"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="e.g. Crank handle to be handed over to Station Master on duty"
                className="text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1 gap-2" size="lg">
                <FileText className="size-4" />
                <span>Submit S&amp;T Requisition</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="gap-2"
                onClick={() => setShowT351Modal(true)}
              >
                <FileText className="size-4" />
                <span>Preview Form T-351</span>
              </Button>
            </div>
          </form>

          {/* Simulated IR T-351 Draft Modal */}
          {showT351Modal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="max-w-xl w-full rounded-2xl bg-surface p-6 border border-border space-y-4 shadow-2xl">
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider">
                      Indian Railways S&amp;T Directorate · Form S&amp;T T-351
                    </span>
                    <h3 className="font-display text-xl font-bold">Disconnection &amp; Reconnection Notice</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowT351Modal(false)}
                    className="text-muted hover:text-fg"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs bg-surface-2 p-4 rounded-xl border border-border leading-relaxed">
                  <p><strong>TO:</strong> Station Master / Panipat (PNP)</p>
                  <p><strong>FROM:</strong> Senior Section Engineer (Signal), Panipat</p>
                  <p className="border-t border-border/50 pt-2">
                    Please take notice that the following signaling gear: <strong>{reqGear || "Point Machine 102A"}</strong> at <strong>{reqStation}</strong> will be disconnected for maintenance from <strong>02:00 hrs to 04:30 hrs</strong>.
                  </p>
                  <p>
                    All concerned signals will be kept in 'ON' aspect. Emergency crank handle will be secured in the station custody box.
                  </p>
                  <p className="text-[11px] text-muted border-t border-border/50 pt-2">
                    Prepared in accordance with Indian Railways Signal Engineering Manual (IRSEM) Section 11 (Disconnection Protocols).
                  </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-mono w-full sm:w-auto"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-3.5" />
                    <span>Print Notice</span>
                  </Button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowT351Modal(false)}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-1.5 text-xs font-medium"
                      onClick={handleIssueT351Notice}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Confirm &amp; Issue Notice</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
