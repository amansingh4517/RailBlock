import { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Clock,
  MapPin,
  TrainTrack,
  ShieldAlert,
  Wrench,
  Ban,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { DeptBadge, StatusBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatHours, formatSpan, lineLabel, minToHhmm, weekday } from "@/lib/rail/format";
import { priorityScore } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";
import type { Task } from "@/lib/rail/types";

interface RequestDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectBlock?: (blockId: string) => void;
}

export function RequestDrawer({
  task,
  isOpen,
  onClose,
  onSelectBlock,
}: RequestDrawerProps) {
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);
  const updateTaskStatus = useRailStore((s) => s.updateTaskStatus);

  // Rejection confirmation dialog state
  const [rejecting, setRejecting] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState("Train conflict");
  const [rejectionRemark, setRejectionRemark] = useState("");

  if (!isOpen || !task) return null;

  // Nearby departmental work correlation (+/- 5 km)
  const nearbyWork = tasks.filter(
    (t) =>
      t.id !== task.id &&
      t.status !== "REJECTED" &&
      Math.abs(t.fromKm - task.fromKm) <= 5.0
  );

  // Check if seated in an operational block
  const resultingBlock = blocks.find((b) => b.taskIds.includes(task.id));

  // Handle Accept
  function handleAccept() {
    updateTaskStatus(task!.id, "ACCEPTED", "Accepted for planning and multi-department bundling");
    toast.success(`Request ${task!.id} accepted for corridor planning`);
    onClose();
  }

  // Handle Reject
  function handleRejectSubmit() {
    updateTaskStatus(
      task!.id,
      "REJECTED",
      rejectionRemark || "Rejected by Control Officer",
      rejectionCategory
    );
    toast.error(`Request ${task!.id} rejected (${rejectionCategory})`);
    setRejecting(false);
    onClose();
  }

  const pScore = priorityScore(task).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-surface border-l border-border shadow-2xl overflow-hidden">
        {/* Sticky Drawer Header */}
        <div className="flex items-start justify-between border-b border-border p-5 bg-surface-2/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted">{task.id}</span>
              <DeptBadge d={task.department} />
              <StatusBadge status={task.status} />
              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted border border-border">
                {task.source}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-fg leading-tight">
              {task.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-surface transition-colors"
            aria-label="Close request drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Rejection notice if rejected */}
          {task.status === "REJECTED" && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 space-y-1">
              <div className="flex items-center gap-2 text-danger font-semibold text-xs font-mono uppercase">
                <Ban className="size-4" />
                <span>Requisition Rejected by Control</span>
              </div>
              <p className="text-xs text-muted">
                Reason: <strong className="text-fg">{task.rejectionReason || "Operational constraint"}</strong>
              </p>
            </div>
          )}

          {/* Operational Parameters Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Location</span>
              <span className="font-mono font-bold text-xs text-fg mt-0.5 block">
                {formatSpan(task.fromKm, task.toKm)}
              </span>
              <span className="text-[10px] text-muted">{lineLabel(task.line)}</span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Duration</span>
              <span className="font-mono font-bold text-xs text-fg mt-0.5 block">
                {formatHours(task.durationHours)}
              </span>
              <span className="text-[10px] text-muted">Possession request</span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Priority Score</span>
              <span className="font-mono font-bold text-xs text-amber-400 mt-0.5 block">
                {pScore} / 100
              </span>
              <span className="text-[10px] text-muted">Severity {task.severity}/5</span>
            </div>

            <div className="rounded-xl bg-surface-2 p-3 border border-border">
              <span className="text-[11px] font-mono text-muted block">Window Limit</span>
              <span className="font-mono font-bold text-[11px] text-fg mt-0.5 block truncate">
                {task.latest}
              </span>
              <span className="text-[10px] text-muted">Planning target</span>
            </div>
          </div>

          {/* Work Description */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Wrench className="size-3.5 text-primary" />
              <span>Engineering Description &amp; Requirements</span>
            </h3>
            <p className="text-xs text-fg leading-relaxed">{task.detail}</p>
            {task.resourceIds.length > 0 && (
              <div className="pt-1 flex items-center gap-2 text-xs">
                <span className="font-mono text-[11px] text-muted">Resources/Machinery:</span>
                <span className="font-mono text-xs text-primary font-medium">
                  {task.resourceIds.join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Operational Impact & Conflict Check */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-amber-400" />
              <span>Operational Impact Analysis</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted font-mono block text-[11px]">Detention Exposure</span>
                <span className="font-bold text-fg">
                  ~{(task.trafficImpact * 5.5).toFixed(0)} min potential delay
                </span>
              </div>
              <div>
                <span className="text-muted font-mono block text-[11px]">Headway Constraint</span>
                <span className="font-bold text-fg">15 min safety buffer</span>
              </div>
            </div>
            <p className="text-[11px] text-muted">
              Traffic simulation flags high passenger train density between 06:00 and 22:00. Shadow night slotting recommended.
            </p>
          </div>

          {/* Related Nearby Departmental Work */}
          <div className="rounded-xl bg-surface-2 p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Layers className="size-3.5 text-emerald-400" />
                <span>Related Nearby Demands (&plusmn;5 km)</span>
              </h3>
              <span className="text-[11px] font-mono text-muted">{nearbyWork.length} nearby</span>
            </div>

            {nearbyWork.length === 0 ? (
              <p className="text-xs text-muted">No nearby demands found in this corridor section.</p>
            ) : (
              <ul className="space-y-2">
                {nearbyWork.slice(0, 3).map((nw) => (
                  <li
                    key={nw.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <DeptBadge d={nw.department} />
                        <span className="font-mono text-[10px] text-muted">{nw.id}</span>
                        <span className="font-medium text-fg">{nw.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted">
                        {formatSpan(nw.fromKm, nw.toKm)} · {formatHours(nw.durationHours)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {nearbyWork.length > 0 && (
              <div className="rounded-lg bg-primary/10 p-2.5 text-[11px] text-primary border border-primary/20 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>AI Bundling Opportunity: Multiple departments can share this single track possession.</span>
              </div>
            )}
          </div>

          {/* Traceability: Resulting Block */}
          {resultingBlock && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-primary font-bold block">
                Resulting Corridor Block
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-fg">{resultingBlock.id}</p>
                  <p className="text-xs text-muted">
                    {weekday(resultingBlock.date)} · {minToHhmm(resultingBlock.startMin)}–{minToHhmm(resultingBlock.endMin)}
                  </p>
                </div>
                {onSelectBlock && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => {
                      onSelectBlock(resultingBlock.id);
                      onClose();
                    }}
                  >
                    <span>View Block</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rejection Dialog or Actions Footer */}
        <div className="border-t border-border p-4 bg-surface-2/60">
          {rejecting ? (
            <div className="space-y-3 rounded-xl bg-danger/10 p-3 border border-danger/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-danger uppercase">
                  Confirm Rejection of {task.id}
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
                <label className="text-[11px] font-mono text-muted">Rejection Category</label>
                <select
                  value={rejectionCategory}
                  onChange={(e) => setRejectionCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-mono"
                >
                  <option value="Train conflict">Train conflict (Passenger priority)</option>
                  <option value="Capacity constraint">Corridor capacity constraint</option>
                  <option value="Unsafe timing">Unsafe timing / Fog restriction</option>
                  <option value="Insufficient concurrence">Insufficient departmental concurrence</option>
                  <option value="Other operational reason">Other operational reason</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-muted">Remarks for Department</label>
                <input
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  placeholder="e.g. Reschedule to Sunday shadow corridor"
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

              {task.status !== "ACCEPTED" && task.status !== "PLANNED" && task.status !== "APPROVED" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRejecting(true)}
                    className="text-xs"
                  >
                    Reject Request
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAccept}
                    className="gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>Accept for Planning</span>
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
