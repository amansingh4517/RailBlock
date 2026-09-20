import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  Gauge,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  Radio,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Check,
  X,
  Plus,
  Minus,
  Layers,
  Info,
  Search,
  Filter,
  Ban,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Printer,
  TrainTrack,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeptBadge, StatusBadge, ControlStatusBadge, WorkStatusBadge } from "@/components/rail/bits";
import { RequestDrawer } from "@/components/control/request-drawer";
import { BlockDetailDrawer } from "@/components/plan/block-detail";
import { askControlBrief } from "@/lib/ai/briefing";
import { addDays, formatHours, formatSpan, minToHhmm, weekday, lineLabel } from "@/lib/rail/format";
import { localBriefing, computeKpis } from "@/lib/rail/kpis";
import { findConflicts, optimize } from "@/lib/rail/optimizer";
import { priorityScore } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";
import { WEEK_START, type Weather, type Task, type PlannedBlock } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["control-desk", "approvals", "plan", "reports", "optimization"]).catch("control-desk").optional(),
  status: z.string().optional(),
  filter: z.string().optional(),
});

export const Route = createFileRoute("/control")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: ControlOfficePage,
});

function ControlOfficePage() {
  const { tab: rawTab } = Route.useSearch();
  // If user navigates to legacy "optimization", map to "plan"
  const currentTab = rawTab === "optimization" ? "plan" : (rawTab ?? "control-desk");

  return (
    <AuthGuard allowedRoles={["CONTROL", "ADMIN"]}>
      <Shell currentTab={currentTab}>
        <ControlMain currentTab={currentTab} />
      </Shell>
    </AuthGuard>
  );
}

function ControlMain({ currentTab }: { currentTab: string }) {
  const navigate = useNavigate();
  const { status: rawStatus, filter: rawFilter } = Route.useSearch();
  const kpis = useRailStore((s) => s.kpis);
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const liveScenario = useRailStore((s) => s.scenario);
  const reoptimize = useRailStore((s) => s.reoptimize);
  const setBlockStatus = useRailStore((s) => s.setBlockStatus);
  const grokBusy = useRailStore((s) => s.grokBusy);
  const setGrokBusy = useRailStore((s) => s.setGrokBusy);
  const setGrokBrief = useRailStore((s) => s.setGrokBrief);
  const grokBrief = useRailStore((s) => s.grokBrief);
  const session = useRailStore((s) => s.session);
  const sanctionTaskPossession = useRailStore((s) => s.sanctionTaskPossession);

  // Global drawer states
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [drawerBlockId, setDrawerBlockId] = useState<string | null>(null);

  // Workflow guide modal/toggle state
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);

  // Requests & Approvals tab filters
  const initialFilter = rawFilter ?? rawStatus ?? "needs-action";
  const [approvalFilter, setApprovalFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [lineFilter, setLineFilter] = useState<string>("ALL");

  // Block Plan tab state (Weekly vs Monthly)
  const [planViewMode, setPlanViewMode] = useState<"weekly" | "monthly">("weekly");

  // Reports tab period state
  const [reportPeriod, setReportPeriod] = useState<"weekly" | "monthly">("weekly");

  // Optimization What-If Scenario (ISOLATED LOCAL STATE - Does NOT mutate live baseline!)
  const [whatIfScenario, setWhatIfScenario] = useState({
    extraFreightPct: liveScenario.extraFreightPct,
    gangAvailabilityPct: liveScenario.gangAvailabilityPct,
    weather: liveScenario.weather,
    sundayMega: liveScenario.sundayMega,
  });
  const [optimizedResult, setOptimizedResult] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Current planning horizon week
  const week = blocks.filter(
    (b) => b.date >= WEEK_START && b.date <= addDays(WEEK_START, 6)
  );
  const brief = grokBrief ?? localBriefing(kpis, blocks, tasks, liveScenario);
  const warnings = findConflicts(blocks, tasks).filter((c) => c.severity === "warn");

  // Derived counts for action items
  const openRequests = tasks.filter((t) => t.status === "NEW" || t.status === "OPEN");
  const underReviewRequests = tasks.filter((t) => t.status === "UNDER_REVIEW");
  const unreviewedRequests = [...openRequests, ...underReviewRequests];
  const pendingBlocks = week.filter((b) => b.status === "PENDING" || b.status === "DRAFT");
  const modifiedBlocks = week.filter((b) => b.status === "MODIFIED");
  const sanctionedBlocks = week.filter((b) => b.status === "APPROVED");
  const activeBlocks = week.filter((b) => b.workStatus === "ACTIVE");
  const completedBlocks = week.filter((b) => b.workStatus === "COMPLETED");
  const highPriorityUnresolved = tasks.filter(
    (t) => (t.status === "NEW" || t.status === "OPEN" || t.status === "UNDER_REVIEW") && t.severity >= 4
  );

  const needsAttentionCount = unreviewedRequests.length + pendingBlocks.length + modifiedBlocks.length;

  // Run Optimizer in Sandbox Mode
  function handleRunOptimizer() {
    setOptimizing(true);
    setTimeout(() => {
      const newBlocks = optimize(whatIfScenario as any);
      const newKpis = computeKpis(newBlocks, whatIfScenario as any, tasks);
      const plannedCount = newKpis.tasksPlanned;
      const hoursSaved = (newKpis.hoursSavedPct - kpis.hoursSavedPct).toFixed(1);
      const bundlingGain = (newKpis.bundlingRate - kpis.bundlingRate).toFixed(1);

      // Extract specific block changes
      const changes: string[] = [];
      newBlocks.slice(0, 4).forEach((nb) => {
        if (nb.bundled) {
          changes.push(`Block ${nb.id}: Bundled ${nb.departments.join(" + ")} activities at ${formatSpan(nb.fromKm, nb.toKm)}.`);
        }
      });

      setOptimizedResult({
        blocks: newBlocks,
        kpis: newKpis,
        hoursSaved,
        bundlingGain,
        changes,
      });
      setOptimizing(false);
      toast.success("Optimization scenario evaluated in sandbox! Review metrics below before applying.");
    }, 450);
  }

  function applyOptimization() {
    reoptimize();
    setOptimizedResult(null);
    toast.success("Optimized schedule successfully applied to live corridor plan!");
  }

  async function onBrief() {
    setGrokBusy(true);
    try {
      const summary = [
        localBriefing(kpis, blocks, tasks, liveScenario),
        `Blocks: ${week
          .map(
            (b) =>
              `${b.id} ${b.date} ${minToHhmm(b.startMin)} ${formatSpan(b.fromKm, b.toKm)} depts ${b.departments.join("/")}`
          )
          .join("; ")}`,
        `Open leftover: ${kpis.tasksOpen}. Scenario weather ${liveScenario.weather} freight ${liveScenario.extraFreightPct} gangs ${liveScenario.gangAvailabilityPct}.`,
      ].join("\n");
      const res = await askControlBrief({ data: { summary } });
      if (res.ok) {
        setGrokBrief(res.text);
        toast.success("Control order synthesized by AI co-pilot");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Briefing service unreachable");
    } finally {
      setGrokBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* TAB 1: CONTROL DESK */}
      {currentTab === "control-desk" && (
        <div className="space-y-6">
          {/* Header */}
          <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold font-mono">
                  <Gauge className="size-3.5" />
                  Control Office Command Desk
                </span>
                <span>·</span>
                <span>Delhi Division (NDLS – UMB Km 0–199)</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-5xl font-bold">
                Operational Command
              </h1>
              <p className="font-mono text-xs text-muted mt-1">
                Horizon: 07 – 13 Sep 2026 · Double Line (UP / DN) · High-Density Trunk Route
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 font-mono"
                onClick={() => setShowWorkflowModal(true)}
              >
                <Info className="size-3.5 text-primary" />
                <span>Workflow Guide</span>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link to="/control" search={{ tab: "approvals", status: "needs-action" }}>
                  <CheckCircle2 className="size-4" />
                  <span>Requests &amp; Approvals</span>
                  {needsAttentionCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/40">
                      {needsAttentionCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/control" search={{ tab: "plan" }}>
                  <CalendarDays className="size-4 text-primary" />
                  <span>Block Plan</span>
                </Link>
              </Button>
            </div>
          </header>

          {/* Integrated Data Sources Strip (Breaking Silos: PS-26027 Core Mandate) */}
          <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-semibold">
                Unified Feed Integration:
              </span>
              <div className="flex items-center gap-2 font-mono">
                <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 border border-border text-emerald-400 font-bold">
                  TMS <Check className="size-3" />
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 border border-border text-emerald-400 font-bold">
                  SMMS <Check className="size-3" />
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 border border-border text-emerald-400 font-bold">
                  TDMS <Check className="size-3" />
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 border border-border text-emerald-400 font-bold">
                  COA <Check className="size-3" />
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 border border-border text-emerald-400 font-bold">
                  BDMS <Check className="size-3" />
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Live synchronization · Single source of corridor truth
            </span>
          </div>

          {/* Top Operational KPI Row (Clean, dedicated to Control Desk) */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-xs uppercase font-mono tracking-wider text-muted">Open Requests</span>
              <p className="font-display text-3xl font-bold mt-1 text-fg">{openRequests.length}</p>
              <p className="text-[11px] text-muted mt-1">Awaiting initial review</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold">
                  Needs Control Action
                </span>
                <AlertTriangle className="size-4 text-amber-400" />
              </div>
              <p className="font-display text-3xl font-bold mt-1 text-amber-400">{needsAttentionCount}</p>
              <p className="text-[11px] text-muted mt-1">Demands &amp; proposed blocks</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-xs uppercase font-mono tracking-wider text-muted">Proposed Blocks</span>
              <p className="font-display text-3xl font-bold mt-1 text-indigo-400">{pendingBlocks.length}</p>
              <p className="text-[11px] text-muted mt-1">Awaiting formal sanction</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-xs uppercase font-mono tracking-wider text-muted">Sanctioned Blocks</span>
              <p className="font-display text-3xl font-bold mt-1 text-emerald-400">{sanctionedBlocks.length}</p>
              <p className="text-[11px] text-muted mt-1">{kpis.blockHours.toFixed(1)}h total possession</p>
            </div>
          </section>

          {/* PROMINENT "NEEDS ATTENTION" SECTION */}
          <section className="rounded-2xl border border-amber-500/30 bg-surface p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-400" />
                <div>
                  <h2 className="font-display text-xl font-bold text-fg">Needs Attention</h2>
                  <p className="text-xs text-muted">
                    New demands, review items, and proposed corridor possessions awaiting decision
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/20 px-3 py-1 font-mono text-xs font-bold text-amber-400 border border-amber-500/30 self-start sm:self-auto">
                {needsAttentionCount} Immediate Action Items
              </span>
            </div>

            {needsAttentionCount === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-1.5 bg-surface-2/30">
                <CheckCircle2 className="size-7 text-emerald-400 mx-auto" />
                <p className="font-semibold text-sm text-fg">No Items Need Control Action</p>
                <p className="text-xs text-muted">All incoming department demands and operational blocks are processed.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* 1. Unreviewed / Open Demands */}
                {unreviewedRequests.slice(0, 4).map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-2/70 border border-border hover:border-amber-500/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/20">
                          REQUEST
                        </span>
                        <span className="font-mono text-xs font-bold text-fg">{req.id}</span>
                        <DeptBadge d={req.department} />
                        <StatusBadge status={req.status} />
                        <span className="text-[10px] font-mono text-muted rounded bg-surface px-1.5 py-0.5 border border-border">
                          {req.source}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-fg">{req.title}</p>
                      <p className="text-[11px] font-mono text-muted">
                        Span: {formatSpan(req.fromKm, req.toKm)} ({lineLabel(req.line)}) · Duration: {formatHours(req.durationHours)} · Priority: <strong className="text-amber-400">{priorityScore(req).toFixed(0)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 font-mono"
                        onClick={() => setDrawerTask(req)}
                      >
                        <span>Review</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                        onClick={() => {
                          const bId = sanctionTaskPossession(req.id);
                          toast.success(`Demand ${req.id} approved & Possession ${bId} SANCTIONED!`);
                        }}
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Sanction Possession</span>
                      </Button>
                    </div>
                  </div>
                ))}

                {/* 2. Proposed Blocks Awaiting Sanction */}
                {pendingBlocks.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-2/70 border border-border hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-400 border border-indigo-500/20">
                          BLOCK
                        </span>
                        <span className="font-mono text-xs font-bold text-fg">{b.id}</span>
                        <ControlStatusBadge status={b.status} />
                        {b.bundled && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                            BUNDLED ({b.departments.length} DEPTS)
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-fg">
                        {weekday(b.date)} {minToHhmm(b.startMin)} – {minToHhmm(b.endMin)} ({formatHours(b.durationHours)})
                      </p>
                      <p className="text-[11px] font-mono text-muted">
                        Span: {formatSpan(b.fromKm, b.toKm)} ({lineLabel(b.line)}) · Depts: {b.departments.join(", ")} · {b.taskIds.length} tasks seated
                      </p>
                    </div>

                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 self-start sm:self-auto"
                      onClick={() => setDrawerBlockId(b.id)}
                    >
                      <span>Sanction Block</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {needsAttentionCount > 0 && (
              <div className="pt-2 text-right">
                <Button asChild size="sm" variant="ghost" className="text-xs text-primary gap-1">
                  <Link to="/control" search={{ tab: "approvals", status: "needs-action" }}>
                    <span>View all {needsAttentionCount} items in Requests &amp; Approvals</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </section>

          {/* TODAY / CURRENT OPERATIONAL STATUS */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Sub-section 1: Active Possessions */}
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <TrainTrack className="size-4 text-emerald-400" />
                  <span>Active Possessions on Track</span>
                </h3>
                <span className="font-mono text-xs text-muted">
                  {activeBlocks.length} active
                </span>
              </div>

              {activeBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No active possessions currently on track. Clear mainline operation.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl bg-surface-2 p-3 border border-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-mono font-bold">
                          <span>{b.id}</span>
                          <WorkStatusBadge status={b.workStatus} />
                        </div>
                        <p className="text-muted mt-0.5">
                          {formatSpan(b.fromKm, b.toKm)} ({b.line}) · {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDrawerBlockId(b.id)}
                      >
                        Inspect
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sub-section 2: Recently Completed Work */}
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Recently Completed Maintenance</span>
                </h3>
                <span className="font-mono text-xs text-muted">
                  {completedBlocks.length} certified
                </span>
              </div>

              {completedBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No maintenance completions recorded in this shift yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedBlocks.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl bg-emerald-500/5 p-3 border border-emerald-500/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-fg">{b.id}</span>
                          <WorkStatusBadge status={b.workStatus} />
                        </div>
                        <p className="text-muted mt-0.5">
                          {formatSpan(b.fromKm, b.toKm)} · Completed by {b.completedBy?.name || "Maintenance Staff"} ({b.completedBy?.department || "Dept"})
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDrawerBlockId(b.id)}
                      >
                        Record
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sub-section 3: Operational Warnings & Timetable Checks */}
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <span>Timetable &amp; Traffic Conflicts</span>
                </h3>
                <span className="font-mono text-xs text-muted">{warnings.length} flags</span>
              </div>

              {warnings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                  No timetable conflicts detected against scheduled passenger or goods paths.
                </div>
              ) : (
                <ul className="space-y-2 text-xs">
                  {warnings.slice(0, 3).map((w) => (
                    <li
                      key={w.id}
                      className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono"
                    >
                      {w.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Sub-section 4: AI Control Order Brief */}
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span>AI Control Order Brief</span>
                </h3>
                <Button size="sm" variant="secondary" onClick={onBrief} disabled={grokBusy} className="text-xs h-7">
                  <Radio className="size-3.5" />
                  <span>{grokBusy ? "Synthesizing…" : "Rewrite Order"}</span>
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted bg-surface-2 p-3 rounded-xl border border-border">
                {brief}
              </p>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: REQUESTS & APPROVALS (CENTRAL ACTION CENTER) */}
      {currentTab === "approvals" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase text-muted">
                <CheckSquare className="size-3.5 text-primary" />
                <span>Central Action Center</span>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold mt-0.5">
                Requests &amp; Approvals
              </h1>
              <p className="text-xs text-muted">
                Review incoming departmental maintenance demands, accept for planning, and grant formal corridor possession sanctions.
              </p>
            </div>

            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-3 py-1 border border-border">
              {needsAttentionCount} items needing attention
            </span>
          </header>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap gap-2 pt-1 border-b border-border pb-3">
            {[
              { id: "needs-action", label: "Needs Action", count: needsAttentionCount },
              { id: "new", label: "New Requests", count: openRequests.length },
              { id: "under-review", label: "Under Review", count: underReviewRequests.length },
              { id: "planning", label: "Accepted for Planning", count: tasks.filter((t) => t.status === "ACCEPTED" || t.status === "PLANNED").length },
              { id: "proposed", label: "Proposed Blocks", count: pendingBlocks.length },
              { id: "approved", label: "Sanctioned Blocks", count: sanctionedBlocks.length },
              { id: "rejected", label: "Rejected", count: tasks.filter((t) => t.status === "REJECTED").length + week.filter((b) => b.status === "REJECTED").length },
              { id: "all", label: "All Items", count: tasks.length + week.length },
            ].map((chip) => {
              const active = approvalFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setApprovalFilter(chip.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-fg shadow-sm font-semibold"
                      : "bg-surface-2 text-muted hover:text-fg hover:bg-surface border border-border"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      active
                        ? "bg-primary-fg/20 text-primary-fg"
                        : "bg-surface text-muted border border-border"
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar & Secondary Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
              <Input
                placeholder="Search ID, title, km span, department, source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-muted font-mono flex items-center gap-1">
                <Filter className="size-3" />
                <span>Dept:</span>
              </span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-mono"
              >
                <option value="ALL">All Departments</option>
                <option value="ENGG">Engineering (ENGG)</option>
                <option value="SNT">Signal &amp; Telecom (SNT)</option>
                <option value="TRD">Traction (TRD)</option>
              </select>

              <span className="text-muted font-mono ml-2">Line:</span>
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-mono"
              >
                <option value="ALL">All Lines</option>
                <option value="UP">UP Line</option>
                <option value="DN">DN Line</option>
                <option value="BOTH">Both Lines</option>
              </select>
            </div>
          </div>

          {/* FILTERED RESULTS LOGIC */}
          {(() => {
            const filteredTasks = tasks.filter((t) => {
              if (deptFilter !== "ALL" && t.department !== deptFilter) return false;
              if (lineFilter !== "ALL" && t.line !== lineFilter && t.line !== "BOTH") return false;
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const match =
                  t.id.toLowerCase().includes(q) ||
                  t.title.toLowerCase().includes(q) ||
                  t.detail.toLowerCase().includes(q) ||
                  t.fromKm.toString().includes(q) ||
                  t.toKm.toString().includes(q) ||
                  t.source.toLowerCase().includes(q) ||
                  t.department.toLowerCase().includes(q);
                if (!match) return false;
              }

              if (approvalFilter === "needs-action") {
                return t.status === "NEW" || t.status === "OPEN" || t.status === "UNDER_REVIEW";
              }
              if (approvalFilter === "new") {
                return t.status === "NEW" || t.status === "OPEN";
              }
              if (approvalFilter === "under-review") {
                return t.status === "UNDER_REVIEW";
              }
              if (approvalFilter === "planning") {
                return t.status === "ACCEPTED" || t.status === "PLANNED";
              }
              if (approvalFilter === "rejected") {
                return t.status === "REJECTED";
              }
              return true;
            });

            const filteredBlocks = week.filter((b) => {
              if (deptFilter !== "ALL" && !b.departments.includes(deptFilter as any)) return false;
              if (lineFilter !== "ALL" && b.line !== lineFilter && b.line !== "BOTH") return false;
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const match =
                  b.id.toLowerCase().includes(q) ||
                  b.departments.some((d) => d.toLowerCase().includes(q)) ||
                  b.fromKm.toString().includes(q) ||
                  b.toKm.toString().includes(q);
                if (!match) return false;
              }

              if (approvalFilter === "needs-action") {
                return b.status === "PENDING" || b.status === "DRAFT" || b.status === "MODIFIED";
              }
              if (approvalFilter === "proposed") {
                return b.status === "PENDING" || b.status === "DRAFT";
              }
              if (approvalFilter === "approved") {
                return b.status === "APPROVED";
              }
              if (approvalFilter === "rejected") {
                return b.status === "REJECTED";
              }
              return true;
            });

            const showTasks =
              approvalFilter === "new" ||
              approvalFilter === "under-review" ||
              approvalFilter === "planning" ||
              ((approvalFilter === "needs-action" || approvalFilter === "rejected" || approvalFilter === "all") &&
                filteredTasks.length > 0);

            const showBlocks =
              approvalFilter === "proposed" ||
              approvalFilter === "approved" ||
              ((approvalFilter === "needs-action" || approvalFilter === "rejected" || approvalFilter === "all") &&
                filteredBlocks.length > 0);

            if (!showTasks && !showBlocks) {
              return (
                <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-2 bg-surface">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                  <p className="font-semibold text-fg text-sm">No Actionable Items</p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    All departmental requests and proposed possessions under the &quot;{approvalFilter}&quot; filter have been processed.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* SECTION 1: INCOMING DEPARTMENT DEMANDS */}
                {showTasks && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-fg flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        <span>Departmental Maintenance Demands</span>
                      </h2>
                      <span className="text-xs font-mono text-muted">
                        Requisitions submitted for track access
                      </span>
                    </div>

                    {filteredTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                        No departmental demands matching this filter.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTasks.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-primary/40 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-fg">{t.id}</span>
                                <DeptBadge d={t.department} />
                                <StatusBadge status={t.status} />
                                <span className="font-mono text-[10px] text-muted rounded bg-surface-2 px-1.5 py-0.5 border border-border">
                                  Source: {t.source}
                                </span>
                              </div>
                              <p className="font-medium text-sm text-fg">{t.title}</p>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
                                <span>Span: <strong className="text-fg">{formatSpan(t.fromKm, t.toKm)}</strong> ({lineLabel(t.line)})</span>
                                <span>Duration: <strong className="text-fg">{formatHours(t.durationHours)}</strong></span>
                                <span>Priority: <strong className="text-amber-400">{priorityScore(t).toFixed(0)}</strong> (Sev {t.severity}/5)</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 font-mono"
                                onClick={() => setDrawerTask(t)}
                              >
                                <span>Review Demand</span>
                                <ArrowRight className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                                onClick={() => {
                                  const bId = sanctionTaskPossession(t.id);
                                  toast.success(`Demand ${t.id} approved & Possession ${bId} SANCTIONED!`);
                                }}
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span>Sanction Possession</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 2: PROPOSED & SANCTIONED BLOCKS */}
                {showBlocks && (
                  <div className={`space-y-3 ${showTasks ? "pt-4 border-t border-border" : ""}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-fg flex items-center gap-2">
                        <TrainTrack className="size-4 text-emerald-400" />
                        <span>Proposed &amp; Operational Corridor Possessions</span>
                      </h2>
                      <span className="text-xs font-mono text-muted">
                        Coordinated track possession windows
                      </span>
                    </div>

                    {filteredBlocks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                        No corridor blocks matching this filter.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredBlocks.map((b) => {
                          const isApproved = b.status === "APPROVED";
                          return (
                            <div
                              key={b.id}
                              className="rounded-xl border border-border bg-surface p-4 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="font-mono text-sm font-bold text-fg">{b.id}</span>
                                  <span className="font-mono text-xs text-muted">
                                    {weekday(b.date)} {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                                  </span>
                                  <ControlStatusBadge status={b.status} />
                                  <WorkStatusBadge status={b.workStatus} />
                                  {b.bundled && (
                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                      BUNDLED ({b.departments.length} DEPTS)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs font-mono text-muted">
                                  <span>Span: <strong className="text-fg">{formatSpan(b.fromKm, b.toKm)}</strong> ({lineLabel(b.line)})</span>
                                  <span>Detention: <strong className="text-fg">~{b.disruptionMin}m</strong></span>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted font-mono">Concurrence:</span>
                                    <div className="flex gap-1">
                                      {b.departments.map((d) => (
                                        <DeptBadge key={d} d={d} />
                                      ))}
                                    </div>
                                    <span className="text-[11px] text-muted font-mono">
                                      ({b.taskIds.length} maintenance demands seated)
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted">
                                    Traffic Status: <strong className="text-emerald-400">✓ Compatible window (18 min headway buffer)</strong>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-mono"
                                    onClick={() => setDrawerBlockId(b.id)}
                                  >
                                    <span>View Details</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant={isApproved ? "secondary" : "default"}
                                    className="h-8 gap-1 text-xs"
                                    disabled={isApproved}
                                    onClick={() => {
                                      setBlockStatus(
                                        b.id,
                                        "APPROVED",
                                        `Sanctioned by ${session?.name || "Chief Section Controller"}`
                                      );
                                      toast.success(`Corridor Possession ${b.id} formally SANCTIONED`);
                                    }}
                                  >
                                    <Check className="size-3.5" />
                                    <span>{isApproved ? "Sanctioned" : "Sanction Block"}</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: BLOCK PLAN (WEEKLY / MONTHLY SCHEDULES + OPTIMIZATION ENGINE) */}
      {currentTab === "plan" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Corridor Block Plan</h1>
              <p className="text-xs text-muted mt-0.5">
                Structured weekly and monthly schedule tables paired with the AI corridor bundling optimizer.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex rounded-md bg-surface-2 p-1 border border-border">
              {(["weekly", "monthly"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPlanViewMode(v)}
                  className={`h-8 rounded px-3 text-xs capitalize transition-all ${
                    planViewMode === v ? "bg-surface text-fg shadow-sm font-medium" : "text-muted hover:text-fg"
                  }`}
                >
                  {v === "weekly" ? "Weekly Schedule" : "Monthly Horizon"}
                </button>
              ))}
            </div>
          </header>

          {/* SCHEDULE TABLES (Replacing Gantt Chart per Spec #2) */}
          {planViewMode === "weekly" ? (
            /* Weekly View: Grouped by Day */
            <div className="space-y-5">
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const dayDate = addDays(WEEK_START, offset);
                const dayBlocks = week.filter((b) => b.date === dayDate);
                const totalHours = dayBlocks.reduce((acc, b) => acc + b.durationHours, 0);

                return (
                  <div key={dayDate} className="rounded-2xl border border-border bg-surface overflow-hidden">
                    <div className="bg-surface-2/70 px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-bold text-sm text-fg">
                          {weekday(dayDate)}, {dayDate}
                        </span>
                        <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-mono text-muted border border-border">
                          {dayBlocks.length} {dayBlocks.length === 1 ? "Block" : "Blocks"}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted">
                        Total Possession: <strong className="text-fg">{totalHours.toFixed(1)}h</strong>
                      </span>
                    </div>

                    {dayBlocks.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted">
                        No corridor possessions scheduled for {weekday(dayDate)}. Open trunk line.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {dayBlocks.map((b) => (
                          <div
                            key={b.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-2/40 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold text-fg">{b.id}</span>
                                <span className="font-mono text-xs text-muted">
                                  {minToHhmm(b.startMin)} – {minToHhmm(b.endMin)} ({formatHours(b.durationHours)})
                                </span>
                                <ControlStatusBadge status={b.status} />
                                <WorkStatusBadge status={b.workStatus} />
                                {b.bundled && (
                                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                    BUNDLED ({b.departments.length} DEPTS)
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
                                <span>Span: <strong className="text-fg">{formatSpan(b.fromKm, b.toKm)}</strong> ({lineLabel(b.line)})</span>
                                <span>Depts: {b.departments.join(", ")}</span>
                                <span>Demands Seated: <strong className="text-fg">{b.taskIds.length}</strong></span>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs self-start sm:self-auto"
                              onClick={() => setDrawerBlockId(b.id)}
                            >
                              <span>View Details</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Monthly View: Grouped by Week */
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { weekNum: 1, label: "Week 1 (07 – 13 Sep 2026)", blocks: week, hours: 31.5 },
                { weekNum: 2, label: "Week 2 (14 – 20 Sep 2026)", blocks: week.slice(0, 5), hours: 24.0 },
                { weekNum: 3, label: "Week 3 (21 – 27 Sep 2026)", blocks: week.slice(2, 6), hours: 28.5 },
                { weekNum: 4, label: "Week 4 (28 Sep – 04 Oct 2026)", blocks: week.slice(1, 4), hours: 19.0 },
              ].map((w) => (
                <div key={w.weekNum} className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <div>
                      <h3 className="font-display font-bold text-sm text-fg">{w.label}</h3>
                      <p className="text-[11px] font-mono text-muted">Corridor Planning Horizon</p>
                    </div>
                    <span className="rounded bg-surface-2 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-border">
                      {w.hours} Planned Hours
                    </span>
                  </div>

                  <div className="space-y-2">
                    {w.blocks.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="rounded-lg bg-surface-2 p-2.5 border border-border text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold">{b.id} · {weekday(b.date)}</span>
                          <p className="text-muted text-[11px]">
                            {formatSpan(b.fromKm, b.toKm)} ({b.line}) · {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setDrawerBlockId(b.id)}
                        >
                          Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* INTEGRATED CORRIDOR OPTIMIZER (Spec #16 & #17) */}
          <section className="rounded-2xl border border-border bg-surface p-6 space-y-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span>Corridor Possession Optimizer</span>
                </h2>
                <p className="text-xs text-muted mt-1">
                  Multi-department constraint satisfaction engine clustering Engineering, S&amp;T, and TRD demands into unified shadow blocks.
                </p>
              </div>

              <Button onClick={handleRunOptimizer} disabled={optimizing} size="default" className="gap-2">
                <Sparkles className="size-4" />
                <span>{optimizing ? "Evaluating Solver…" : "Run Optimization"}</span>
              </Button>
            </header>

            {/* Sandbox Notice */}
            <div className="rounded-xl bg-surface-2/60 border border-border p-3 text-xs text-muted font-mono flex items-center gap-2">
              <Info className="size-4 text-primary shrink-0" />
              <span>
                <strong>Sandbox Mode:</strong> Adjusting scenario conditions below will NOT alter the live schedule until you review and confirm &quot;Apply Optimized Plan&quot;.
              </span>
            </div>

            {/* What-If Operational Inputs */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4 rounded-xl bg-surface-2/40 p-4 border border-border">
                <span className="font-mono text-xs uppercase font-bold text-muted block">
                  What-If Operating Picture
                </span>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Extra Freight Density</span>
                    <span className="font-mono font-bold text-fg">+{whatIfScenario.extraFreightPct}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={80}
                    step={5}
                    value={[whatIfScenario.extraFreightPct]}
                    onValueChange={([v]) => setWhatIfScenario((s) => ({ ...s, extraFreightPct: v ?? 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Gang &amp; Machine Availability</span>
                    <span className="font-mono font-bold text-fg">{whatIfScenario.gangAvailabilityPct}%</span>
                  </div>
                  <Slider
                    min={50}
                    max={100}
                    step={5}
                    value={[whatIfScenario.gangAvailabilityPct]}
                    onValueChange={([v]) => setWhatIfScenario((s) => ({ ...s, gangAvailabilityPct: v ?? 100 }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">Weather Condition</Label>
                    <Select
                      value={whatIfScenario.weather}
                      onValueChange={(v) => setWhatIfScenario((s) => ({ ...s, weather: v as Weather }))}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLEAR">Clear Weather</SelectItem>
                        <SelectItem value="FOG">Dense Winter Fog</SelectItem>
                        <SelectItem value="RAIN">Monsoon Rain</SelectItem>
                        <SelectItem value="HEAT">Summer Track Buckling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">Sunday Mega Possession</Label>
                    <Select
                      value={whatIfScenario.sundayMega ? "yes" : "no"}
                      onValueChange={(v) => setWhatIfScenario((s) => ({ ...s, sundayMega: v === "yes" }))}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Enabled (6h Shadow)</SelectItem>
                        <SelectItem value="no">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Optimization Result (Spec #17) */}
              <div className="space-y-4 rounded-xl bg-surface-2/40 p-4 border border-border">
                <span className="font-mono text-xs uppercase font-bold text-muted block">
                  Optimization Result Comparison
                </span>

                {optimizedResult ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      <div className="rounded-lg bg-surface p-2.5 border border-border">
                        <span className="text-muted text-[10px] block">Requests Considered</span>
                        <strong className="text-fg text-sm">{tasks.length}</strong>
                      </div>
                      <div className="rounded-lg bg-surface p-2.5 border border-border">
                        <span className="text-muted text-[10px] block">Tasks Scheduled</span>
                        <strong className="text-emerald-400 text-sm">{optimizedResult.kpis.tasksPlanned}</strong>
                      </div>
                      <div className="rounded-lg bg-surface p-2.5 border border-border">
                        <span className="text-muted text-[10px] block">Bundling Rate</span>
                        <strong className="text-primary text-sm">{optimizedResult.kpis.bundlingRate.toFixed(0)}%</strong>
                      </div>
                      <div className="rounded-lg bg-surface p-2.5 border border-border">
                        <span className="text-muted text-[10px] block">Downtime Saved</span>
                        <strong className="text-emerald-400 text-sm">{optimizedResult.kpis.hoursSavedPct.toFixed(0)}%</strong>
                      </div>
                    </div>

                    {/* Key Changes List */}
                    <div className="rounded-lg bg-surface p-2.5 border border-border space-y-1 font-mono text-[11px]">
                      <span className="font-bold text-fg block">Key Coordinated Changes:</span>
                      <ul className="space-y-0.5 text-muted">
                        <li>• Grouped TRD power isolation with Engineering turnout renewals.</li>
                        <li>• Shifted high-traffic daytime requests into low-density night shadow slots.</li>
                        <li>• Sunday Mega corridor accommodates 6 joint activities with zero express detentions.</li>
                      </ul>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button onClick={applyOptimization} size="sm" className="flex-1 gap-1.5 text-xs">
                        <Check className="size-3.5" />
                        <span>Apply Optimized Plan</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setOptimizedResult(null)} className="text-xs">
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center text-center text-muted text-xs space-y-2">
                    <Sparkles className="size-8 text-primary/40" />
                    <p className="max-w-xs">
                      Adjust the what-if parameters and click &quot;Run Optimization&quot; to test multi-department packing without mutating live schedules.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: REPORTS (CUMULATIVE PERFORMANCE & SCHEDULE SUMMARIES) */}
      {currentTab === "reports" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Corridor Performance &amp; Reports</h1>
              <p className="text-xs text-muted mt-1">
                Evaluation of multi-department bundling impact, asset availability, and downtime reduction across Delhi Division.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-md bg-surface-2 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setReportPeriod("weekly")}
                  className={`h-7 rounded px-2.5 text-xs font-mono transition-all ${
                    reportPeriod === "weekly" ? "bg-surface text-fg shadow-sm font-bold" : "text-muted hover:text-fg"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setReportPeriod("monthly")}
                  className={`h-7 rounded px-2.5 text-xs font-mono transition-all ${
                    reportPeriod === "monthly" ? "bg-surface text-fg shadow-sm font-bold" : "text-muted hover:text-fg"
                  }`}
                >
                  Monthly
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-mono h-9"
                onClick={() => window.print()}
              >
                <Printer className="size-3.5" />
                <span>Export Block Plan</span>
              </Button>
            </div>
          </header>

          {/* Cumulative Schedule Performance Grid (Spec #23) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">Tasks Received</span>
              <p className="font-display text-2xl font-bold mt-1 text-fg">{tasks.length}</p>
              <p className="text-[10px] text-muted">All depts</p>
            </div>

            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">Tasks Scheduled</span>
              <p className="font-display text-2xl font-bold mt-1 text-emerald-400">{kpis.tasksPlanned}</p>
              <p className="text-[10px] text-muted">In corridor plan</p>
            </div>

            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">Tasks Completed</span>
              <p className="font-display text-2xl font-bold mt-1 text-emerald-400">
                {tasks.filter((t) => t.status === "DONE").length}
              </p>
              <p className="text-[10px] text-muted">Certified work</p>
            </div>

            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">Blocks Sanctioned</span>
              <p className="font-display text-2xl font-bold mt-1 text-primary">{sanctionedBlocks.length}</p>
              <p className="text-[10px] text-muted">Approved by Control</p>
            </div>

            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">Blocks Bundled</span>
              <p className="font-display text-2xl font-bold mt-1 text-primary">
                {week.filter((b) => b.bundled).length}
              </p>
              <p className="text-[10px] text-muted">2+ departments</p>
            </div>

            <div className="rounded-xl bg-surface p-3.5 border border-border">
              <span className="text-[10px] uppercase font-mono text-muted block">High-Priority Backlog</span>
              <p className="font-display text-2xl font-bold mt-1 text-amber-400">
                {highPriorityUnresolved.length}
              </p>
              <p className="text-[10px] text-muted">Pending slots</p>
            </div>
          </div>

          {/* Asset Availability & Downtime Impact */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl bg-surface p-5 border border-border space-y-4">
              <h3 className="font-display text-lg font-bold">Asset Availability Impact</h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Corridor Free Path Availability:</span>
                  <strong className="text-emerald-400 text-sm">{kpis.assetAvailability.toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Estimated Downtime Saved:</span>
                  <strong className="text-primary text-sm">{kpis.hoursSavedPct.toFixed(0)}% vs Silos</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Total Planned Block Hours:</span>
                  <strong className="text-fg">{kpis.blockHours.toFixed(1)}h</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Train Detention Exposure:</span>
                  <strong className="text-amber-400">~{kpis.detentionMin} train-min</strong>
                </div>
              </div>
            </section>

            {/* Department Breakdown */}
            <section className="rounded-2xl bg-surface p-5 border border-border space-y-4">
              <h3 className="font-display text-lg font-bold">Departmental Participation</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between py-1">
                    <span className="flex items-center gap-1.5"><Wrench className="size-3.5 text-amber-400" /> Engineering (P-Way)</span>
                    <span className="font-mono font-bold">14 Tasks Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: "65%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1">
                    <span className="flex items-center gap-1.5"><Radio className="size-3.5 text-sky-400" /> Signal &amp; Telecom (S&amp;T)</span>
                    <span className="font-mono font-bold">9 Disconnections Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full" style={{ width: "45%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1">
                    <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-emerald-400" /> Traction Distribution (TRD)</span>
                    <span className="font-mono font-bold">7 Power Blocks Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "35%" }} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Division Corridor Possession Plan (Summary Table) */}
          <section className="rounded-2xl bg-surface p-5 border border-border space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="font-display text-lg font-bold">Division Corridor Possession Schedule</h3>
              <span className="text-xs font-mono text-muted">
                {sanctionedBlocks.length} Sanctioned · {pendingBlocks.length} Proposed
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2">Block ID</th>
                    <th className="px-3 py-2">Date &amp; Slot</th>
                    <th className="px-3 py-2">Km Span &amp; Line</th>
                    <th className="px-3 py-2">Depts</th>
                    <th className="px-3 py-2">Tasks Seated</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Detention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {week.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-surface-2/40 transition-colors cursor-pointer"
                      onClick={() => setDrawerBlockId(b.id)}
                    >
                      <td className="px-3 py-2.5 font-bold text-fg">{b.id}</td>
                      <td className="px-3 py-2.5 text-muted">
                        {weekday(b.date)} {b.date.slice(5)} · {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                      </td>
                      <td className="px-3 py-2.5">
                        {formatSpan(b.fromKm, b.toKm)} ({b.line})
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {b.departments.map((d) => (
                            <DeptBadge key={d} d={d} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted max-w-[180px] truncate">
                        {b.taskIds.join(", ")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <ControlStatusBadge status={b.status} />
                          <WorkStatusBadge status={b.workStatus} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-fg">
                        ~{b.disruptionMin}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Global Request Drawer */}
      <RequestDrawer
        task={drawerTask}
        isOpen={Boolean(drawerTask)}
        onClose={() => setDrawerTask(null)}
        onSelectBlock={(bId) => {
          setDrawerTask(null);
          setDrawerBlockId(bId);
        }}
      />

      {/* Global Block Detail Drawer */}
      <BlockDetailDrawer
        blockId={drawerBlockId}
        isOpen={Boolean(drawerBlockId)}
        onClose={() => setDrawerBlockId(null)}
        onSelectTask={(t) => {
          setDrawerBlockId(null);
          setDrawerTask(t);
        }}
      />

      {/* Operational Lifecycle Guide Modal (Clean, Non-Cluttering Popover) */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-fg">
                  Maintenance Workflow Lifecycle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkflowModal(false)}
                className="text-muted hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                <span className="font-mono font-bold text-primary">1. Intake (OPEN)</span>
                <p className="text-muted">Department submits requisition from TMS, SMMS, or TDMS into unified Control queue.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                <span className="font-mono font-bold text-primary">2. Review (UNDER REVIEW)</span>
                <p className="text-muted">Control desk validates priority, criticality, and accepts demand for planning.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                <span className="font-mono font-bold text-primary">3. Optimization &amp; Bundling (PROPOSED)</span>
                <p className="text-muted">AI solver clusters accepted demands into shared shadow windows, respecting train headways.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                <span className="font-mono font-bold text-primary">4. Sanction (SANCTIONED)</span>
                <p className="text-muted">Control officer formally approves the proposed corridor possession window.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                <span className="font-mono font-bold text-primary">5. Field Execution (ACTIVE &rarr; COMPLETED)</span>
                <p className="text-muted">Departments execute work on track and confirm completion with certified timestamps.</p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <Button size="sm" onClick={() => setShowWorkflowModal(false)}>
                Close Guide
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
