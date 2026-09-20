/**
 * RequestDrawer — Detail slide-over drawer for BDMS/TMS/TDMS/SMMS maintenance tasks
 */
import { X, Calendar, Clock, MapPin, AlertTriangle, CheckCircle2, Shield, ArrowRight } from "lucide-react";
import { DeptBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
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

export function RequestDrawer({ task, isOpen, onClose, onSelectBlock }: RequestDrawerProps) {
  const blocks = useRailStore((s) => s.blocks);

  if (!isOpen || !task) return null;

  const assignedBlock = blocks.find((b) => b.taskIds.includes(task.id));
  const pScore = priorityScore(task);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-md h-full bg-surface border-l border-border p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DeptBadge d={task.department} />
                <span className="font-mono text-xs text-muted">{task.id}</span>
              </div>
              <h3 className="font-display text-2xl mt-2 text-fg">{task.title}</h3>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Source System & Priority Badge */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted">Source Integration System</p>
              <p className="text-sm font-semibold text-fg">{task.source}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted">Priority Weight</p>
              <p className="text-lg font-bold text-amber-400 font-mono">{pScore.toFixed(0)}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted mb-1">Work Description</h4>
              <p className="text-sm text-fg/90 bg-surface-2/50 p-3 rounded-md border border-border/50">
                {task.detail}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-md bg-surface-2 border border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>Location</span>
                </div>
                <p className="font-mono font-medium text-fg">{formatSpan(task.fromKm, task.toKm)}</p>
                <p className="text-xs text-muted">{lineLabel(task.line)}</p>
              </div>

              <div className="p-3 rounded-md bg-surface-2 border border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Duration Required</span>
                </div>
                <p className="font-mono font-medium text-fg">{formatHours(task.durationHours)}</p>
                <p className="text-xs text-muted">Earliest: {task.earliest}</p>
              </div>
            </div>

            {/* Special Safety / Severity Alert */}
            {task.severity >= 4 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>High Severity Maintenance Task ({task.severity}/5) — Priority scheduling required</span>
              </div>
            )}

            {/* Assigned Possession Block Status */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted mb-2">Block Assignment</h4>
              {assignedBlock ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="h-4 w-4" /> Assigned to Block {assignedBlock.id}
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {weekday(assignedBlock.date)} {minToHhmm(assignedBlock.startMin)}–{minToHhmm(assignedBlock.endMin)}
                    </span>
                  </div>
                  {onSelectBlock && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                      onClick={() => {
                        onSelectBlock(assignedBlock.id);
                        onClose();
                      }}
                    >
                      Inspect Possession Block &rarr;
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-surface-2 border border-border text-center text-xs text-muted">
                  Not currently bundled into an active block possession.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>SIH 2026 AI Planning Engine</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
