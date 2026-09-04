import { toast } from "sonner";
import { DeptBadge, StatusBadge } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WINDOWS } from "@/lib/rail/data";
import { formatHours, formatSpan, kindLabel, lineLabel, minToHhmm, weekday } from "@/lib/rail/format";
import { priorityScore } from "@/lib/rail/scoring";
import { useRailStore } from "@/lib/rail/store";

export function BlockDetail() {
  const id = useRailStore((s) => s.selectedBlockId);
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge status={block.status} />
          {block.departments.map((d) => (
            <DeptBadge key={d} d={d} />
          ))}
          {block.bundled ? (
            <span className="text-[11px] uppercase tracking-wider text-ok">Bundled</span>
          ) : null}
        </div>
      </header>

      <p className="text-sm text-muted">
        {window ? kindLabel(window.kind) : "Window"} · est. detention {block.disruptionMin} train-min
        {block.note ? ` · ${block.note}` : ""}
      </p>

      <Separator />

      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted">Work in this possession</p>
        <ul className="space-y-3">
          {packed.map((t) =>
            t ? (
              <li key={t.id} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-fg">{t.title}</p>
                  <span className="font-mono text-xs text-muted">{priorityScore(t).toFixed(0)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{t.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-faint">
                  {t.id} · {t.source} · {formatHours(t.durationHours)}
                </p>
              </li>
            ) : null,
          )}
        </ul>
      </div>

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
