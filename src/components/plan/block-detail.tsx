import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { DeptBadge, StatusBadge, ControlStatusBadge, WorkStatusBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WINDOWS } from "@/lib/rail/data";
import { formatHours, formatSpan, kindLabel, lineLabel, minToHhmm, weekday } from "@/lib/rail/format";
import { priorityScore } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";
import { RequestDrawer } from "@/components/control/request-drawer";
import type { Task } from "@/lib/rail/types";

export function BlockDetail() {
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const id = useRailStore((s) => s.selectedBlockId);
  const selectBlock = useRailStore((s) => s.selectBlock);
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const role = useRailStore((s) => s.role);
  const setBlockStatus = useRailStore((s) => s.setBlockStatus);
  const shiftBlock = useRailStore((s) => s.shiftBlock);

  const block = blocks.find((b) => b.id === id);
  if (!block) {
    return <p className="text-sm text-muted">Select a possession on the board.</p>;
  }
  const packed = block.taskIds.map((tid) => tasks.find((t) => t.id === tid)).filter(Boolean);
  const window = WINDOWS.find((w) => w.id === block.windowId);
  const canApprove = role === "CONTROL" || role === "ADMIN";

  return (
    <div className="space-y-4">
      <header>
        <p className="font-mono text-xs text-muted">{block.id}</p>
        <h2 className="font-display text-3xl leading-none">
          {weekday(block.date)} {minToHhmm(block.startMin)}–{minToHhmm(block.endMin)}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {formatSpan(block.fromKm, block.toKm)} · {lineLabel(block.line)} · {formatHours(block.durationHours)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted uppercase">Control:</span>
            <ControlStatusBadge status={block.status} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted uppercase">Work:</span>
            <WorkStatusBadge status={block.workStatus} />
          </div>
          <div className="flex gap-1 ml-1">
            {block.departments.map((d) => (
              <DeptBadge key={d} d={d} />
            ))}
          </div>
          {block.bundled ? (
            <span className="text-[11px] uppercase tracking-wider text-ok">Bundled</span>
          ) : null}
        </div>
        {block.workStatus === "COMPLETED" && (
          <div className="mt-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-2.5 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              <strong>Maintenance Completed:</strong> Verified by {block.completedBy?.name || "Maintenance Staff"} ({block.completedBy?.department || "Dept"})
              {block.completedAt && ` on ${new Date(block.completedAt).toLocaleDateString()} at ${new Date(block.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        )}
      </header>

      <p className="text-sm text-muted">
        {window ? kindLabel(window.kind) : "Window"} · est. detention {block.disruptionMin} train-min
        {block.note ? ` · ${block.note}` : ""}
      </p>

      <Separator />

      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted">
          Originating Department Demands ({packed.length})
        </p>
        <ul className="space-y-3">
          {packed.map((t) =>
            t ? (
              <li
                key={t.id}
                className="rounded-lg bg-surface-2 p-3 border border-border/70 hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => setDrawerTask(t)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <DeptBadge d={t.department} />
                    <p className="text-sm font-medium text-fg group-hover:text-primary transition-colors">
                      {t.title}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted">{priorityScore(t).toFixed(0)}</span>
                </div>
                <p className="mt-1 text-xs text-muted line-clamp-2">{t.detail}</p>
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-faint">
                  <span>
                    {t.id} · {t.source} · {formatHours(t.durationHours)}
                  </span>
                  <span className="text-primary text-[10px] underline underline-offset-2">
                    View request details &rarr;
                  </span>
                </div>
              </li>
            ) : null,
          )}
        </ul>
      </div>

      <RequestDrawer
        task={drawerTask}
        isOpen={Boolean(drawerTask)}
        onClose={() => setDrawerTask(null)}
        onSelectBlock={(bId: string) => selectBlock(bId)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            shiftBlock(block.id, -30);
            toast("Possession shifted −30 min");
          }}
        >
          −30 min
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            shiftBlock(block.id, 30);
            toast("Possession shifted +30 min");
          }}
        >
          +30 min
        </Button>
        {canApprove ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                setBlockStatus(block.id, "APPROVED");
                toast("Block approved for publication");
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setBlockStatus(block.id, "REJECTED", "Returned by control");
                toast("Block returned");
              }}
            >
              Return
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setBlockStatus(block.id, "MODIFIED", `${role} requested a change`);
              toast("Change flagged for control");
            }}
          >
            Flag change
          </Button>
        )}
      </div>
    </div>
  );
}
