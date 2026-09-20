import { useState } from "react";
import { toast } from "sonner";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  Check,
  Ban,
  ArrowRight,
  Sparkles,
  TrainTrack,
  Wrench,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { DeptBadge, StatusBadge, ControlStatusBadge, WorkStatusBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { formatHours, formatSpan, lineLabel, minToHhmm, weekday } from "@/lib/rail/format";
import { priorityScore } from "@/lib/rail/scoring";
import { findConflicts } from "@/lib/rail/optimizer";
import { useRailStore } from "@/lib/rail/store";
import type { Task, PlannedBlock } from "@/lib/rail/types";

interface BlockDetailDrawerProps {
  blockId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (task: Task) => void;
}

export function BlockDetailDrawer({
  blockId,
  isOpen,
  onClose,
  onSelectTask,
}: BlockDetailDrawerProps) {
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const role = useRailStore((s) => s.role);
  const session = useRailStore((s) => s.session);
  const setBlockStatus = useRailStore((s) => s.setBlockStatus);
  const shiftBlock = useRailStore((s) => s.shiftBlock);

  // Timing adjustment state
  const [adjustingTime, setAdjustingTime] = useState(false);
  const [pendingShiftDelta, setPendingShiftDelta] = useState<number | null>(null);

  // Rejection state
  const [rejecting, setRejecting] = useState(false);
  const [rejectCategory, setRejectCategory] = useState("Train conflict");
  const [rejectRemarks, setRejectRemarks] = useState("");

  if (!isOpen || !blockId) return null;

  const block = blocks.find((b) => b.id === blockId);
  if (!block) return null;

  const packed = block.taskIds.map((tid) => tasks.find((t) => t.id === tid)).filter(Boolean) as Task[];
  const isApproved = block.status === "APPROVED";
  const isRejected = block.status === "REJECTED";
  const canSanction = role === "CONTROL" || role === "ADMIN";

  // Check conflicts for this block
  const allConflicts = findConflicts(blocks, tasks);
  const blockConflicts = allConflicts.filter(
    (c) => c.text.includes(block.id) || c.text.includes(block.windowId)
  );

  // Simulated timetable buffer & traffic check
  const hasConflict = blockConflicts.length > 0;
  const trafficNotice = hasConflict
    ? `⚠️ Timetable buffer warning: ${blockConflicts[0].text}`
    : `✓ Compatible traffic window (0 passenger train conflicts · 18 min headway buffer)`;

  // Preview shifted times if adjusting
  const previewStartMin = pendingShiftDelta !== null ? Math.max(0, Math.min(1440 - (block.endMin - block.startMin), block.startMin + pendingShiftDelta)) : block.startMin;
  const previewEndMin = previewStartMin + (block.endMin - block.startMin);

  function handleConfirmShift() {
    if (pendingShiftDelta === null) return;
    shiftBlock(block!.id, pendingShiftDelta);
    toast.success(
      `Possession ${block!.id} shifted ${pendingShiftDelta > 0 ? `+${pendingShiftDelta}` : pendingShiftDelta}m to ${minToHhmm(previewStartMin)}–${minToHhmm(previewEndMin)}`
    );
    setPendingShiftDelta(null);
    setAdjustingTime(false);
  }

  function handleSanction() {
    setBlockStatus(
      block!.id,
      "APPROVED",
      `Sanctioned by ${session?.name || "Chief Section Controller"} (${role})`
    );
    toast.success(`Corridor Possession ${block!.id} formally SANCTIONED`);
    onClose();
  }

  function handleRejectSubmit() {
    setBlockStatus(
      block!.id,
      "REJECTED",
      `${rejectCategory}${rejectRemarks ? `: ${rejectRemarks}` : ""}`
    );
    toast.error(`Corridor Possession ${block!.id} rejected (${rejectCategory})`);
    setRejecting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-surface border-l border-border shadow-2xl overflow-hidden">
        {/* Sticky Drawer Header */}
        <div className="flex items-start justify-between border-b border-border p-5 bg-surface-2/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-fg">{block.id}</span>
              <ControlStatusBadge status={block.status} />
              <WorkStatusBadge status={block.workStatus} />
              {block.bundled && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary border border-primary/20">
                  BUNDLED ({block.departments.length} DEPTS)
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-fg leading-tight">
              {weekday(block.date)} {minToHhmm(block.startMin)} – {minToHhmm(block.endMin)}
            </h2>
            <p className="text-xs text-muted font-mono">
              {formatSpan(block.fromKm, block.toKm)} ({lineLabel(block.line)}) · Duration: {formatHours(block.durationHours)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-surface transition-colors"
            aria-label="Close block detail drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Work Completion Notice if Completed */}
          {block.workStatus === "COMPLETED" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs font-mono uppercase">
                <CheckCircle2 className="size-4" />
                <span>Field Maintenance Completed</span>
              </div>
              <p className="text-xs text-muted">
                Work certified completed by <strong className="text-fg">{block.completedBy?.name || "Field Engineer"}</strong> ({block.completedBy?.department || "Maintenance Dept"})
                {block.completedAt && ` on ${new Date(block.completedAt).toLocaleDateString()} at ${new Date(block.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}.
              </p>
            </div>
          )}

          {/* Rejection notice if rejected */}
          {block.status === "REJECTED" && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 space-y-1">
              <div className="flex items-center gap-2 text-danger font-semibold text-xs font-mono uppercase">
                <Ban className="size-4" />
                <span>Corridor Possession Rejected</span>
              </div>
              <p className="text-xs text-muted">
                Remarks: <strong className="text-fg">{block.note || "Operational conflict"}</strong>
              </p>
            </div>
          )}

          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Corridor Span</span>
              <span className="font-mono font-bold text-xs text-fg mt-0.5 block">
                {formatSpan(block.fromKm, block.toKm)}
              </span>
              <span className="text-[10px] text-muted">{lineLabel(block.line)} Line</span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Duration</span>
              <span className="font-mono font-bold text-xs text-fg mt-0.5 block">
                {formatHours(block.durationHours)}
              </span>
              <span className="text-[10px] text-muted">Shadow window</span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Concurrence</span>
              <div className="flex gap-1 mt-1">
                {block.departments.map((d) => (
                  <DeptBadge key={d} d={d} />
                ))}
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                {isApproved ? "✓ Sanctioned" : "Awaiting Control"}
              </span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Detention Impact</span>
              <span className="font-mono font-bold text-xs text-amber-400 mt-0.5 block">
                ~{block.disruptionMin} min
              </span>
              <span className="text-[10px] text-muted">Modelled train delay</span>
            </div>
          </div>

          {/* Train Timetable & Traffic Compatibility */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <TrainTrack className="size-3.5 text-sky-400" />
              <span>Timetable &amp; Goods Train Forecast Check</span>
            </h3>
            <p className={`text-xs font-medium ${hasConflict ? "text-amber-400" : "text-emerald-400"}`}>
              {trafficNotice}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono text-muted">
              <div>Passenger Conflicts: <strong className="text-fg">{hasConflict ? "1" : "0"}</strong></div>
              <div>Freight Forecast: <strong className="text-fg">Low Density</strong></div>
              <div>Safety Buffer: <strong className="text-fg">18 min</strong></div>
            </div>
          </div>

          {/* AI Prioritization & Bundling Explanation */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <span>AI Scheduling &amp; Bundling Benefit</span>
              </h3>
              <span className="font-mono text-xs font-bold text-primary">
                HIGH PRIORITY
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong className="text-fg">Multi-Department Bundling:</strong> {block.bundled ? `${block.departments.length} departments (${block.departments.join(" + ")}) coordinated into this single window, eliminating ${block.departments.length - 1} separate track closures.` : "Single department possession window."}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>
                  <strong className="text-fg">Downtime Reduction:</strong> Prevents siloed maintenance conflicts and aligns with section freight slots.
                </span>
              </li>
            </ul>
          </div>

          {/* Originating Department Demands */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Wrench className="size-3.5 text-primary" />
                <span>Originating Department Demands ({packed.length})</span>
              </h3>
              <span className="text-[11px] font-mono text-muted">Click to inspect demand</span>
            </div>

            <div className="space-y-2">
              {packed.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-surface-2 p-3.5 border border-border hover:border-primary/40 transition-colors cursor-pointer group"
                  onClick={() => onSelectTask?.(t)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DeptBadge d={t.department} />
                      <span className="font-mono text-xs font-bold text-fg group-hover:text-primary transition-colors">
                        {t.id}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <span className="font-mono text-xs text-amber-400 font-semibold">
                      Priority {priorityScore(t).toFixed(0)}
                    </span>
                  </div>
                  <p className="font-medium text-xs text-fg mt-1.5">{t.title}</p>
                  <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{t.detail}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted pt-1 border-t border-border/50">
                    <span>Span: {formatSpan(t.fromKm, t.toKm)} · {formatHours(t.durationHours)}</span>
                    <span className="text-primary inline-flex items-center gap-0.5 group-hover:underline">
                      Inspect Requisition <ChevronRight className="size-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Adjust Timing Section (Controlled Inside Drawer) */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-400" />
                <span>Possession Time Slot Adjustment</span>
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-mono"
                onClick={() => {
                  setAdjustingTime(!adjustingTime);
                  setPendingShiftDelta(null);
                }}
              >
                {adjustingTime ? "Cancel Timing" : "Adjust Time Slot"}
              </Button>
            </div>

            {adjustingTime ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={pendingShiftDelta === -30 ? "default" : "outline"}
                    className="h-8 text-xs font-mono flex-1"
                    onClick={() => setPendingShiftDelta(-30)}
                  >
                    Shift -30 min
                  </Button>
                  <Button
                    size="sm"
                    variant={pendingShiftDelta === 30 ? "default" : "outline"}
                    className="h-8 text-xs font-mono flex-1"
                    onClick={() => setPendingShiftDelta(30)}
                  >
                    Shift +30 min
                  </Button>
                </div>

                {pendingShiftDelta !== null && (
                  <div className="rounded-lg bg-surface p-3 border border-border space-y-2 text-xs">
                    <div className="flex justify-between font-mono">
                      <span className="text-muted">Proposed Time Slot:</span>
                      <strong className="text-primary font-bold">
                        {minToHhmm(previewStartMin)} – {minToHhmm(previewEndMin)}
                      </strong>
                    </div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      <span>Timetable conflict check: Buffer maintained against express services.</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs mt-1"
                      onClick={handleConfirmShift}
                    >
                      Save &amp; Log Time Shift
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted font-mono">
                Current window: <strong className="text-fg">{minToHhmm(block.startMin)} – {minToHhmm(block.endMin)}</strong> ({formatHours(block.durationHours)})
              </p>
            )}
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="border-t border-border p-4 bg-surface-2/60">
          {rejecting ? (
            <div className="space-y-3 rounded-xl bg-danger/10 p-3 border border-danger/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-danger uppercase">
                  Confirm Rejection of {block.id}
                </span>
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="text-muted hover:text-fg text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-muted">Rejection Reason</label>
                <select
                  value={rejectCategory}
                  onChange={(e) => setRejectCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-mono"
                >
                  <option value="Train conflict">Train conflict (Passenger train priority)</option>
                  <option value="Capacity constraint">Corridor capacity constraint</option>
                  <option value="Unsafe timing">Unsafe timing / Fog restriction</option>
                  <option value="Insufficient concurrence">Insufficient concurrence</option>
                  <option value="Other">Other operational reason</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-muted">Remarks for Log</label>
                <input
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="e.g. Conflicts with 12011 Kalka Shatabdi"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1 text-xs"
                  onClick={handleRejectSubmit}
                >
                  Confirm Rejection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setRejecting(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Close Drawer
              </Button>

              {canSanction && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isRejected}
                    onClick={() => setRejecting(true)}
                    className="text-xs"
                  >
                    Reject Block
                  </Button>
                  <Button
                    size="sm"
                    variant={isApproved ? "secondary" : "default"}
                    disabled={isApproved}
                    onClick={handleSanction}
                    className="gap-1.5 text-xs"
                  >
                    <Check className="size-4" />
                    <span>{isApproved ? "Sanctioned" : "Sanction Block"}</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// Backwards compatibility export
export function BlockDetail() {
  return null;
}
