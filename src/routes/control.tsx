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
} from "lucide-react";
import { toast } from "sonner";
import { CorridorRibbon } from "@/components/corridor/ribbon";
import { Shell } from "@/components/layout/shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeptBadge, StatusBadge } from "@/components/rail/bits";
import { BlockDetail } from "@/components/plan/block-detail";
import { MonthBoard, WeekGantt } from "@/components/plan/gantt";
import { RequestDrawer } from "@/components/control/request-drawer";
import { askControlBrief } from "@/lib/ai/briefing";
import { addDays, formatHours, formatSpan, minToHhmm, weekday, lineLabel } from "@/lib/rail/format";
import { localBriefing, computeKpis } from "@/lib/rail/kpis";
import { findConflicts, optimize, activeTasks } from "@/lib/rail/optimizer";
import { priorityScore } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";
import { WEEK_START, type Weather, type BlockStatus, type Task } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["control-desk", "plan", "optimization", "approvals", "reports"]).catch("control-desk").optional(),
  status: z.string().optional(),
  filter: z.string().optional(),
});

export const Route = createFileRoute("/control")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: ControlOfficePage,
});

function ControlOfficePage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "control-desk";

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
  const scenario = useRailStore((s) => s.scenario);
  const setScenario = useRailStore((s) => s.setScenario);
  const reoptimize = useRailStore((s) => s.reoptimize);
  const setBlockStatus = useRailStore((s) => s.setBlockStatus);
  const shiftBlock = useRailStore((s) => s.shiftBlock);
  const grokBusy = useRailStore((s) => s.grokBusy);
  const setGrokBusy = useRailStore((s) => s.setGrokBusy);
  const setGrokBrief = useRailStore((s) => s.setGrokBrief);
  const grokBrief = useRailStore((s) => s.grokBrief);
  const selectBlock = useRailStore((s) => s.selectBlock);

  // Request drawer state
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);

  // Corridor ribbon highlight
  const [highlightSpan, setHighlightSpan] = useState<{ fromKm: number; toKm: number; label?: string } | undefined>(undefined);

  // Workflow guide expand/collapse
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  // Requests & Approvals tab filters
  const initialFilter = rawFilter ?? rawStatus ?? "needs-action";
  const [approvalFilter, setApprovalFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [lineFilter, setLineFilter] = useState<string>("ALL");

  // Block rejection modal state
  const [rejectingBlockId, setRejectingBlockId] = useState<string | null>(null);
  const [blockRejectCategory, setBlockRejectCategory] = useState("Train conflict");
  const [blockRejectRemarks, setBlockRejectRemarks] = useState("");

  const week = blocks.filter(
    (b) => b.date >= WEEK_START && b.date <= addDays(WEEK_START, 6)
  );
  const brief = grokBrief ?? localBriefing(kpis, blocks, tasks, scenario);
  const warnings = findConflicts(blocks, tasks).filter((c) => c.severity === "warn");

  // Categorize for Needs Attention
  const unreviewedRequests = tasks.filter(
    (t) => t.status === "NEW" || t.status === "OPEN" || t.status === "UNDER_REVIEW"
  );
  const pendingBlocks = week.filter((b) => b.status === "PENDING" || b.status === "DRAFT");
  const modifiedBlocks = week.filter((b) => b.status === "MODIFIED");
  const needsAttentionCount = unreviewedRequests.length + pendingBlocks.length + modifiedBlocks.length;

  // Gantt view mode
  const [ganttView, setGanttView] = useState<"week" | "month">("week");

  // Optimization before/after preview state
  const [optimizedResult, setOptimizedResult] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);

  function handleRunOptimizer() {
    setOptimizing(true);
    setTimeout(() => {
      const newBlocks = optimize(scenario, tasks);
      const newKpis = computeKpis(newBlocks, scenario, tasks);
      setOptimizedResult({
        blocks: newBlocks,
        kpis: newKpis,
        hoursSaved: (newKpis.hoursSavedPct - kpis.hoursSavedPct).toFixed(1),
        bundlingGain: (newKpis.bundlingRate - kpis.bundlingRate).toFixed(1),
      });
      setOptimizing(false);
      toast.success("Corridor optimization evaluated! Review metrics below before applying.");
    }, 400);
  }

  function applyOptimization() {
    reoptimize();
    setOptimizedResult(null);
    toast.success("Optimized possession schedule applied to active corridor plan.");
  }

  async function onBrief() {
    setGrokBusy(true);
    try {
      const summary = [
        localBriefing(kpis, blocks, tasks, scenario),
        `Blocks: ${week
          .map(
            (b) =>
              `${b.id} ${b.date} ${minToHhmm(b.startMin)} ${formatSpan(b.fromKm, b.toKm)} depts ${b.departments.join("/")} tasks ${b.taskIds.join(",")}`
          )
          .join("; ")}`,
        `Open leftover: ${kpis.tasksOpen}. Scenario weather ${scenario.weather} freight ${scenario.extraFreightPct} gangs ${scenario.gangAvailabilityPct} emergency ${scenario.emergencyDefect}.`,
      ].join("\n");
      const res = await askControlBrief({ data: { summary } });
      if (res.ok) {
        setGrokBrief(res.text);
        toast.success("Control order rewritten by AI co-pilot");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Briefing service unreachable");
    } finally {
      setGrokBusy(false);
    }
  }

  function handleRejectBlockConfirm() {
    if (!rejectingBlockId) return;
    setBlockStatus(
      rejectingBlockId,
      "REJECTED",
      `${blockRejectCategory}${blockRejectRemarks ? `: ${blockRejectRemarks}` : ""}`
    );
    toast.error(`Corridor Possession ${rejectingBlockId} rejected (${blockRejectCategory})`);
    setRejectingBlockId(null);
    setBlockRejectRemarks("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Tab 1: CONTROL DESK */}
      {currentTab === "control-desk" && (
        <div className="space-y-6">
          {/* Header */}
          <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold font-mono">
                  <Gauge className="size-3.5" />
                  Corridor Command Center
                </span>
                <span>·</span>
                <span>Delhi Division Traffic Coordination</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-5xl font-bold">
                Corridor Command
              </h1>
              <p className="font-mono text-xs text-muted mt-1">
                NDLS – UMB | Km 0–199 | Double Line (UP / DN) · Planning Horizon: 07 – 13 Sep 2026 (CRIS Feed Live)
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-2">
                <Link to="/control" search={{ tab: "approvals", status: "needs-action" }}>
                  <CheckCircle2 className="size-4" />
                  <span>Review Requests &amp; Approvals</span>
                  {needsAttentionCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/40">
                      {needsAttentionCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/control" search={{ tab: "optimization" }}>
                  <Sparkles className="size-4 text-primary" />
                  <span>Optimize Corridor</span>
                </Link>
              </Button>
            </div>
          </header>

          {/* Workflow Guide Strip */}
          <div className="rounded-xl border border-border bg-surface-2/60 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Info className="size-4 text-primary shrink-0" />
                <span className="font-semibold text-fg">How the Maintenance Workflow Works</span>
                <span className="text-muted hidden sm:inline">· 6-stage operational lifecycle</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkflowGuide(!showWorkflowGuide)}
                className="text-xs text-primary font-mono hover:underline inline-flex items-center gap-1"
              >
                <span>{showWorkflowGuide ? "Hide Guide" : "Show Workflow Steps"}</span>
                {showWorkflowGuide ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            </div>
            {showWorkflowGuide && (
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 sm:grid-cols-6 text-xs font-mono">
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">1. Intake</span>
                  <span className="text-muted text-[11px]">Dept submits BDMS / T-351 requisition</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">2. Review</span>
                  <span className="text-muted text-[11px]">Control accepts demand for planning</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">3. Bundle</span>
                  <span className="text-muted text-[11px]">AI solver clusters into shadow windows</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">4. Sanction</span>
                  <span className="text-muted text-[11px]">Controller shifts ±30m &amp; approves block</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">5. Permits</span>
                  <span className="text-muted text-[11px]">PTW &amp; T-351 issued to field gangs</span>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <span className="text-primary font-bold block">6. Normal</span>
                  <span className="text-muted text-[11px]">Line cleared, TSR logged &amp; audit saved</span>
                </div>
              </div>
            )}
          </div>

          {/* "Needs Attention" Summary Card */}
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-400" />
                <h2 className="font-display text-lg font-bold text-fg">Needs Control Attention</h2>
              </div>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-400 border border-amber-500/30">
                {needsAttentionCount} Action Items
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <Link
                to="/control"
                search={{ tab: "approvals", status: "new" }}
                className="rounded-lg bg-surface p-3.5 border border-border hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-amber-400 group-hover:scale-105 transition-transform">
                    {unreviewedRequests.length}
                  </span>
                  <ArrowRight className="size-4 text-muted group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="font-semibold text-xs text-fg block mt-1">New Department Requests</span>
                <span className="text-[11px] text-muted">Awaiting Control review &amp; planning acceptance</span>
              </Link>

              <Link
                to="/control"
                search={{ tab: "approvals", status: "proposed" }}
                className="rounded-lg bg-surface p-3.5 border border-border hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-indigo-400 group-hover:scale-105 transition-transform">
                    {pendingBlocks.length}
                  </span>
                  <ArrowRight className="size-4 text-muted group-hover:text-indigo-400 transition-colors" />
                </div>
                <span className="font-semibold text-xs text-fg block mt-1">Blocks Awaiting Sanction</span>
                <span className="text-[11px] text-muted">Proposed windows ready for formal approval</span>
              </Link>

              <Link
                to="/control"
                search={{ tab: "approvals", status: "modified" }}
                className="rounded-lg bg-surface p-3.5 border border-border hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-sky-400 group-hover:scale-105 transition-transform">
                    {modifiedBlocks.length}
                  </span>
                  <ArrowRight className="size-4 text-muted group-hover:text-sky-400 transition-colors" />
                </div>
                <span className="font-semibold text-xs text-fg block mt-1">Modified Blocks</span>
                <span className="text-[11px] text-muted">Timing shifted or concurrence updated</span>
              </Link>
            </div>
          </section>

          {/* "New Department Requests" Panel */}
          <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-fg flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <span>Incoming Department Demands</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Requisitions submitted from Engineering, Signal &amp; Telecom, and TRD requiring review
                </p>
              </div>
              <Button asChild size="sm" variant="ghost" className="text-xs text-primary gap-1">
                <Link to="/control" search={{ tab: "approvals", status: "new" }}>
                  <span>View all in Action Center</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>

            {unreviewedRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-1.5">
                <CheckCircle2 className="size-6 text-emerald-400 mx-auto" />
                <p className="font-medium text-sm text-fg">No Unreviewed Requests</p>
                <p className="text-xs text-muted">All incoming departmental demands have been processed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-surface-2/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                    <tr>
                      <th className="px-3.5 py-2.5">Priority</th>
                      <th className="px-3.5 py-2.5">Dept</th>
                      <th className="px-3.5 py-2.5">Request Title</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5">Duration</th>
                      <th className="px-3.5 py-2.5">Source</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unreviewedRequests.slice(0, 5).map((req) => (
                      <tr key={req.id} className="hover:bg-surface transition-colors">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-amber-400">
                          {priorityScore(req).toFixed(0)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <DeptBadge d={req.department} />
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-fg max-w-xs truncate">
                          {req.title}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-muted">
                          {formatSpan(req.fromKm, req.toKm)} {req.line}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-muted">
                          {formatHours(req.durationHours)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-muted">
                          {req.source}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setDrawerTask(req);
                              setHighlightSpan({ fromKm: req.fromKm, toKm: req.toKm, label: req.id });
                            }}
                          >
                            <span>Review</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Operational KPI Strip (Placed below actionable requests) */}
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-5">
            <Kpi label="Asset availability" value={`${kpis.assetAvailability.toFixed(1)}%`} hint="modelled free path" />
            <Kpi label="Block hours" value={kpis.blockHours.toFixed(1)} hint={`${kpis.hoursSavedPct.toFixed(0)}% vs silos`} />
            <Kpi label="Bundling" value={`${kpis.bundlingRate.toFixed(0)}%`} hint="shared possessions" />
            <Kpi label="High-priority" value={`${kpis.highPriorityCoverage.toFixed(0)}%`} hint="covered this solve" />
            <Kpi label="Detention" value={`${kpis.detentionMin}`} hint="train-minutes" className="col-span-2 md:col-span-1" />
          </section>

          {/* Corridor Track Ribbon */}
          <CorridorRibbon blocks={week} highlightSpan={highlightSpan} />

          {/* AI Briefing & Corridor Exceptions */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span>AI Control Order Brief</span>
                </h2>
                <Button size="sm" variant="secondary" onClick={onBrief} disabled={grokBusy} className="text-xs">
                  <Radio className="size-3.5" />
                  <span>{grokBusy ? "Synthesizing…" : "Rewrite Order"}</span>
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-fg">{brief}</p>
            </section>

            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                <span>Corridor Exceptions</span>
              </h2>
              <ul className="space-y-2 text-xs">
                {warnings.length === 0 ? (
                  <li className="text-muted">No hard conflicts on the current solve.</li>
                ) : (
                  warnings.slice(0, 4).map((w) => (
                    <li key={w.id} className="text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                      {w.text}
                    </li>
                  ))
                )}
              </ul>
              <p className="text-[11px] text-muted pt-1">
                {kpis.windowsUsed}/{kpis.windowsTotal} windows occupied · {kpis.tasksPlanned} tasks seated
              </p>
            </section>
          </div>
        </div>
      )}

      {/* Tab 2: BLOCK PLAN */}
      {currentTab === "plan" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Corridor Block Plan</h1>
              <p className="text-xs text-muted">
                {kpis.tasksPlanned} tasks seated · {kpis.blockHours.toFixed(1)}h possession · {kpis.hoursSavedPct.toFixed(0)}% fewer hours than uncoordinated bids
              </p>
            </div>
            <div className="flex rounded-md bg-surface-2 p-1 border border-border">
              {(["week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGanttView(v)}
                  className={`h-8 rounded px-3 text-xs capitalize transition-all ${
                    ganttView === v ? "bg-surface text-fg shadow-sm font-medium" : "text-muted hover:text-fg"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <CorridorRibbon blocks={ganttView === "week" ? week : blocks} compact highlightSpan={highlightSpan} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 rounded-xl bg-surface p-4 border border-border">
              {ganttView === "week" ? <WeekGantt blocks={blocks} /> : <MonthBoard blocks={blocks} />}
            </div>
            <aside className="rounded-xl bg-surface p-5 border border-border">
              <BlockDetail />
            </aside>
          </div>
        </div>
      )}

      {/* Tab 3: OPTIMIZATION */}
      {currentTab === "optimization" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">
                Corridor Possession Optimizer
              </h1>
              <p className="text-xs text-muted mt-1">
                Multi-department constraint satisfaction engine clustering Engineering, S&amp;T, and TRD into shared shadow blocks.
              </p>
            </div>

            <Button onClick={handleRunOptimizer} disabled={optimizing} size="lg" className="gap-2">
              <Sparkles className="size-4" />
              <span>{optimizing ? "Evaluating Solver…" : "Optimize & Bundle Corridor"}</span>
            </Button>
          </header>

          {/* Planning Input Pipeline */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div>
              <span className="font-mono text-muted text-[11px] uppercase font-bold block">Planning Input Pipeline</span>
              <p className="text-fg font-medium mt-0.5">
                {tasks.filter((t) => t.status === "ACCEPTED" || t.status === "NEW" || t.status === "OPEN").length} departmental demands ready for scheduling
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded bg-surface px-2.5 py-1 font-mono text-muted border border-border">
                {tasks.filter((t) => t.canBundle).length} candidate bundles
              </span>
              <span className="rounded bg-surface px-2.5 py-1 font-mono text-muted border border-border">
                {warnings.length} conflict flags
              </span>
            </div>
          </div>

          {/* What-if Operational Conditions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-5 rounded-2xl bg-surface p-5 border border-border">
              <h2 className="font-display text-xl font-bold">What-If Operating Picture</h2>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Extra Freight Density</span>
                  <span className="font-mono font-bold text-fg">+{scenario.extraFreightPct}%</span>
                </div>
                <Slider
                  min={0}
                  max={80}
                  step={5}
                  value={[scenario.extraFreightPct]}
                  onValueChange={([v]) => setScenario({ extraFreightPct: v ?? 0 })}
                />
                <p className="text-[11px] text-muted">Above 40% freight surge closes midday traffic slots.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Manpower &amp; Machine Availability</span>
                  <span className="font-mono font-bold text-fg">{scenario.gangAvailabilityPct}%</span>
                </div>
                <Slider
                  min={50}
                  max={100}
                  step={5}
                  value={[scenario.gangAvailabilityPct]}
                  onValueChange={([v]) => setScenario({ gangAvailabilityPct: v ?? 100 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono">Weather Condition</Label>
                  <Select
                    value={scenario.weather}
                    onValueChange={(v) => setScenario({ weather: v as Weather })}
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
                    value={scenario.sundayMega ? "yes" : "no"}
                    onValueChange={(v) => setScenario({ sundayMega: v === "yes" })}
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
            </section>

            {/* Optimizer Result Comparison */}
            <section className="rounded-2xl bg-surface p-5 border border-border space-y-4">
              <h2 className="font-display text-xl font-bold">Solver Metrics Comparison</h2>

              {optimizedResult ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-primary/10 p-3.5 border border-primary/20 text-xs space-y-1">
                    <span className="font-bold font-mono text-primary uppercase block">Optimized Possession Plan</span>
                    <p className="text-fg">
                      {optimizedResult.kpis.tasksPlanned} tasks scheduled into corridor shadow windows · {tasks.length - optimizedResult.kpis.tasksPlanned} remaining backlog · {optimizedResult.kpis.bundlingRate.toFixed(0)}% multi-department bundling rate.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-surface-2 p-3 border border-border">
                      <span className="text-muted text-[11px] block">Bundling Rate</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-display text-2xl font-bold text-emerald-400">
                          {optimizedResult.kpis.bundlingRate.toFixed(0)}%
                        </span>
                        <span className="text-xs text-muted font-mono">
                          (Current: {kpis.bundlingRate.toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-surface-2 p-3 border border-border">
                      <span className="text-muted text-[11px] block">Hours Saved vs Silos</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-display text-2xl font-bold text-primary">
                          {optimizedResult.kpis.hoursSavedPct.toFixed(0)}%
                        </span>
                        <span className="text-xs text-muted font-mono">
                          (Current: {kpis.hoursSavedPct.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-2 p-3 border border-border space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted">Total Seated Tasks:</span>
                      <span className="text-fg font-bold">{optimizedResult.kpis.tasksPlanned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Corridor Detention:</span>
                      <span className="text-fg font-bold">{optimizedResult.kpis.detentionMin} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Availability Factor:</span>
                      <span className="text-emerald-400 font-bold">
                        {optimizedResult.kpis.assetAvailability.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={applyOptimization} className="flex-1 gap-2">
                      <Check className="size-4" />
                      <span>Apply Optimized Schedule</span>
                    </Button>
                    <Button variant="outline" onClick={() => setOptimizedResult(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center text-center text-muted text-xs space-y-2">
                  <Sparkles className="size-8 text-primary/50" />
                  <p>Click "Optimize &amp; Bundle Corridor" above to run the multi-department constraint packer and compare before/after possession efficiency.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Tab 4: REQUESTS & APPROVALS */}
      {currentTab === "approvals" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase text-muted">
                <CheckSquare className="size-3.5 text-primary" />
                <span>Operational Action Center</span>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold mt-0.5">
                Requests &amp; Approvals
              </h1>
              <p className="text-xs text-muted">
                Review incoming departmental demands, accept demands for planning, and grant formal possession sanctions.
              </p>
            </div>

            <span className="font-mono text-xs text-muted rounded bg-surface-2 px-3 py-1 border border-border">
              {needsAttentionCount} items needing attention
            </span>
          </header>

          {/* Filter Status Chips */}
          <div className="flex flex-wrap gap-2 pt-1 border-b border-border pb-3">
            {[
              { id: "needs-action", label: "Needs Action", count: needsAttentionCount },
              { id: "new", label: "New Requests", count: unreviewedRequests.length },
              { id: "planning", label: "Accepted for Planning", count: tasks.filter((t) => t.status === "ACCEPTED" || t.status === "PLANNED").length },
              { id: "proposed", label: "Proposed Blocks", count: pendingBlocks.length },
              { id: "approved", label: "Sanctioned Blocks", count: week.filter((b) => b.status === "APPROVED").length },
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

          {/* Search & Secondary Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
              <Input
                placeholder="Search ID, title, station, Km..."
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

          {/* FILTERED ENTITIES LOGIC */}
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
                  t.source.toLowerCase().includes(q);
                if (!match) return false;
              }

              if (approvalFilter === "needs-action" || approvalFilter === "new") {
                return t.status === "NEW" || t.status === "OPEN" || t.status === "UNDER_REVIEW";
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
                  <p className="font-semibold text-fg text-sm">No Actionable Items in Selected View</p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    All incoming departmental maintenance demands and corridor possession requests under the &quot;{approvalFilter}&quot; filter have been processed.
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
                        Requisitions asking for track access
                      </span>
                    </div>

                    {filteredTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                        No departmental requests matching the selected view.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTasks.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-xl border border-border bg-surface p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-primary/40 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-fg">{t.id}</span>
                                <DeptBadge d={t.department} />
                                <StatusBadge status={t.status} />
                                <span className="font-mono text-[10px] text-muted rounded bg-surface-2 px-1.5 py-0.5 border border-border">
                                  {t.source}
                                </span>
                              </div>
                              <p className="font-medium text-sm text-fg">{t.title}</p>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
                                <span>Span: <strong className="text-fg">{formatSpan(t.fromKm, t.toKm)}</strong> ({lineLabel(t.line)})</span>
                                <span>Duration: <strong className="text-fg">{formatHours(t.durationHours)}</strong></span>
                                <span>Priority: <strong className="text-amber-400">{priorityScore(t).toFixed(0)}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => {
                                  setDrawerTask(t);
                                  setHighlightSpan({ fromKm: t.fromKm, toKm: t.toKm, label: t.id });
                                }}
                              >
                                <span>Review Request</span>
                                <ArrowRight className="size-3.5" />
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
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <span>Corridor Possessions (Operational Blocks)</span>
                      </h2>
                      <span className="text-xs font-mono text-muted">
                        Formal track possession windows awaiting/granted sanction
                      </span>
                    </div>

                    {filteredBlocks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                        No operational blocks matching the selected view.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredBlocks.map((b) => {
                          const isApproved = b.status === "APPROVED";
                          const isRejected = b.status === "REJECTED";

                          // Preview shift times
                          const shiftMinusPreview = `${minToHhmm(Math.max(0, b.startMin - 30))}–${minToHhmm(Math.max(0, b.endMin - 30))}`;
                          const shiftPlusPreview = `${minToHhmm(Math.min(1200, b.startMin + 30))}–${minToHhmm(Math.min(1200, b.endMin + 30))}`;

                          return (
                            <div
                              key={b.id}
                              className="rounded-xl border border-border bg-surface p-4 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm font-bold text-fg">{b.id}</span>
                                  <span className="font-mono text-xs text-muted">
                                    {weekday(b.date)} {minToHhmm(b.startMin)}–{minToHhmm(b.endMin)}
                                  </span>
                                  <StatusBadge status={b.status} />
                                  {b.bundled && (
                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                      BUNDLED ({b.departments.length} DEPTS)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-muted">
                                    Span: <strong className="text-fg">{formatSpan(b.fromKm, b.toKm)}</strong> ({lineLabel(b.line)})
                                  </span>
                                  <span className="text-xs font-mono text-muted">
                                    Detention: <strong className="text-fg">{b.disruptionMin}m</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-3 text-xs">
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

                                {/* Controller Action Controls */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 text-xs font-mono"
                                    title={`Shift -30m to ${shiftMinusPreview}`}
                                    onClick={() => {
                                      shiftBlock(b.id, -30);
                                      toast.info(`Block ${b.id} shifted -30m (Now ${shiftMinusPreview})`);
                                    }}
                                  >
                                    <Minus className="size-3" />
                                    <span>30m ({shiftMinusPreview})</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 text-xs font-mono"
                                    title={`Shift +30m to ${shiftPlusPreview}`}
                                    onClick={() => {
                                      shiftBlock(b.id, 30);
                                      toast.info(`Block ${b.id} shifted +30m (Now ${shiftPlusPreview})`);
                                    }}
                                  >
                                    <Plus className="size-3" />
                                    <span>30m ({shiftPlusPreview})</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant={isApproved ? "secondary" : "default"}
                                    className="h-8 gap-1 text-xs"
                                    disabled={isApproved}
                                    onClick={() => {
                                      setBlockStatus(b.id, "APPROVED", "Sanctioned by Chief Section Controller");
                                      toast.success(`Corridor Possession ${b.id} formally approved`);
                                    }}
                                  >
                                    <Check className="size-3.5" />
                                    <span>{isApproved ? "Sanctioned" : "Approve Block"}</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="danger"
                                    className="h-8 gap-1 text-xs"
                                    disabled={isRejected}
                                    onClick={() => setRejectingBlockId(b.id)}
                                  >
                                    <X className="size-3.5" />
                                    <span>Reject</span>
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

      {/* Tab 5: REPORTS */}
      {currentTab === "reports" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">Operational Impact &amp; Savings</h1>
              <p className="text-xs text-muted mt-1">
                Quantifiable performance metrics comparing RailBlock AI multi-department possession bundling against conventional manual bids.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-mono"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span>Export Division Block Plan</span>
            </Button>
          </header>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-surface p-4 border border-border">
              <span className="text-[11px] uppercase font-mono text-muted">Block Hours Saved</span>
              <p className="font-display text-3xl font-bold mt-1 text-primary">{kpis.hoursSavedPct.toFixed(0)}%</p>
              <p className="text-[11px] text-muted mt-1">vs uncoordinated departmental bids</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <span className="text-[11px] uppercase font-mono text-muted">Bundling Rate</span>
              <p className="font-display text-3xl font-bold mt-1 text-emerald-400">{kpis.bundlingRate.toFixed(0)}%</p>
              <p className="text-[11px] text-muted mt-1">Possessions with 2+ departments</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <span className="text-[11px] uppercase font-mono text-muted">Asset Availability</span>
              <p className="font-display text-3xl font-bold mt-1 text-fg">{kpis.assetAvailability.toFixed(1)}%</p>
              <p className="text-[11px] text-muted mt-1">NDLS–UMB double track free path</p>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-border">
              <span className="text-[11px] uppercase font-mono text-muted">Train Detention</span>
              <p className="font-display text-3xl font-bold mt-1 text-amber-400">{kpis.detentionMin} min</p>
              <p className="text-[11px] text-muted mt-1">Passenger &amp; goods delay</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <h3 className="font-display text-lg font-bold">Departmental Participation</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between py-1">
                    <span>Engineering (P-Way)</span>
                    <span className="font-mono font-bold">14 Tasks Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: "65%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1">
                    <span>Signal &amp; Telecom (S&amp;T)</span>
                    <span className="font-mono font-bold">9 Disconnections Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full" style={{ width: "45%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1">
                    <span>Traction Distribution (TRD)</span>
                    <span className="font-mono font-bold">7 Power Blocks Seated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "35%" }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-surface p-5 border border-border space-y-3">
              <h3 className="font-display text-lg font-bold">Corridor Schedule Health</h3>
              <ul className="space-y-2 text-xs font-mono">
                <li className="flex items-center justify-between py-1 border-b border-border">
                  <span className="text-muted">Windows Utilized:</span>
                  <span className="text-fg font-bold">{kpis.windowsUsed} of {kpis.windowsTotal}</span>
                </li>
                <li className="flex items-center justify-between py-1 border-b border-border">
                  <span className="text-muted">High Priority Seating:</span>
                  <span className="text-emerald-400 font-bold">{kpis.highPriorityCoverage.toFixed(0)}%</span>
                </li>
                <li className="flex items-center justify-between py-1">
                  <span className="text-muted">Unresolved Backlog:</span>
                  <span className="text-amber-400 font-bold">{kpis.tasksOpen} tasks</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Division Corridor Possession Plan (Provisional Summary Table) */}
          <section className="rounded-xl bg-surface p-5 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="font-display text-lg font-bold">Division Corridor Possession Plan</h3>
                <p className="text-xs text-muted font-mono">
                  NDLS–UMB (Km 0–199) · Planning Horizon: 07 – 13 Sep 2026 · Provisional Operating Summary
                </p>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {week.filter((b) => b.status === "APPROVED").length} Sanctioned · {week.filter((b) => b.status === "PENDING" || b.status === "DRAFT").length} Proposed
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="px-3 py-2">Block ID</th>
                    <th className="px-3 py-2">Date &amp; Window</th>
                    <th className="px-3 py-2">Km Span &amp; Line</th>
                    <th className="px-3 py-2">Depts</th>
                    <th className="px-3 py-2">Tasks Seated</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Detention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {week.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-2/40 transition-colors">
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
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-fg">
                        {b.disruptionMin}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Block Rejection Confirmation Modal */}
      {rejectingBlockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-fg flex items-center gap-2">
                <Ban className="size-5 text-danger" />
                <span>Reject Block {rejectingBlockId}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingBlockId(null)}
                className="text-muted hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-mono text-muted">Rejection Reason Category</label>
              <select
                value={blockRejectCategory}
                onChange={(e) => setBlockRejectCategory(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-mono"
              >
                <option value="Train conflict">Train conflict (Passenger train priority)</option>
                <option value="Capacity constraint">Corridor capacity constraint</option>
                <option value="Unsafe timing">Unsafe timing / Weather risk</option>
                <option value="Insufficient concurrence">Insufficient concurrence</option>
                <option value="Other">Other operational reason</option>
              </select>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-mono text-muted">Remarks for Logging</label>
              <Input
                value={blockRejectRemarks}
                onChange={(e) => setBlockRejectRemarks(e.target.value)}
                placeholder="e.g. Conflicts with 12011 Kalka Shatabdi Express"
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={handleRejectBlockConfirm}
              >
                Confirm Block Rejection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingBlockId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Request Drawer for Control Office */}
      <RequestDrawer
        task={drawerTask}
        isOpen={Boolean(drawerTask)}
        onClose={() => {
          setDrawerTask(null);
          setHighlightSpan(undefined);
        }}
        onSelectBlock={(bId) => {
          selectBlock(bId);
          navigate({ to: "/control", search: { tab: "plan" } });
          setDrawerTask(null);
        }}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={`bg-surface px-4 py-4 ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display mt-1 text-3xl leading-none tabular md:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}
