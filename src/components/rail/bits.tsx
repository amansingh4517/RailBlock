import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { BlockStatus, Department, TaskStatus, WorkStatus } from "@/lib/rail/types";
import { DEPT_LABEL } from "@/lib/rail/types";
import { cn } from "@/lib/utils";

export function DeptBadge({ d }: { d: Department }) {
  return (
    <Badge tone={d === "ENGG" ? "engg" : d === "SNT" ? "snt" : "trd"}>{DEPT_LABEL[d]}</Badge>
  );
}

export function StatusBadge({ status }: { status: BlockStatus | TaskStatus }) {
  const tone =
    status === "APPROVED" || status === "DONE" || status === "PLANNED"
      ? "ok"
      : status === "REJECTED" || status === "DEFERRED"
        ? "danger"
        : status === "MODIFIED" || status === "PENDING"
          ? "caution"
          : "default";
  return <Badge tone={tone}>{status.replace("_", " ")}</Badge>;
}

export function ControlStatusBadge({ status }: { status: BlockStatus }) {
  const tone =
    status === "APPROVED"
      ? "ok"
      : status === "REJECTED"
        ? "danger"
        : status === "MODIFIED"
          ? "caution"
          : "caution";
  const label =
    status === "APPROVED"
      ? "SANCTIONED"
      : status === "PENDING"
        ? "AWAITING SANCTION"
        : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export function WorkStatusBadge({ status }: { status?: WorkStatus }) {
  const s = status || "NOT_STARTED";
  const tone = s === "COMPLETED" ? "ok" : s === "ACTIVE" ? "caution" : "default";
  const label = s === "NOT_STARTED" ? "NOT STARTED" : s;
  return <Badge tone={tone}>{label}</Badge>;
}

export function PriorityBar({ score }: { score: number }) {
  const bar = score >= 80 ? "bg-danger" : score >= 65 ? "bg-caution" : "bg-ok";
  return (
    <div className="flex items-center gap-2">
      <Progress value={score} className="h-1 w-16" barClassName={bar} />
      <span className="tabular font-mono text-xs text-fg">{score.toFixed(0)}</span>
    </div>
  );
}

export function DeptDots({ depts }: { depts: Department[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={depts.join(", ")}>
      {depts.map((d) => (
        <span
          key={d}
          className={cn(
            "size-1.5 rounded-full",
            d === "ENGG" ? "bg-engg" : d === "SNT" ? "bg-snt" : "bg-trd",
          )}
        />
      ))}
    </span>
  );
}

export function RailMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-7", className)} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5" className="fill-surface-2" />
      <path d="M5 8h14M5 16h14" className="stroke-muted" strokeWidth="1.4" />
      <rect x="9" y="6.2" width="6.5" height="11.6" rx="1" className="fill-primary" />
    </svg>
  );
}
