/**
 * GovernancePipeline — Role-Based Approval Pipeline Banner
 * Shows visual DRAFT → DEPT_APPROVED → SR_DOM_APPROVED → PUBLISHED_TO_COA
 * per block plan, with who acts at each stage and current position.
 */
import { ShieldCheck, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import type { PlannedBlock } from "@/lib/rail/types";

type GovernanceStage = "DRAFT" | "DEPT_APPROVED" | "SR_DOM_APPROVED" | "PUBLISHED_TO_COA";

function blockToStage(b: PlannedBlock): GovernanceStage {
  if (b.status === "APPROVED") return "SR_DOM_APPROVED";
  if (b.status === "PENDING") return "DEPT_APPROVED";
  return "DRAFT";
}

const STAGES: { id: GovernanceStage; label: string; actor: string; color: string; ring: string }[] = [
  {
    id: "DRAFT",
    label: "DRAFT",
    actor: "SSE / Department",
    color: "text-muted",
    ring: "border-border",
  },
  {
    id: "DEPT_APPROVED",
    label: "DEPT APPROVED",
    actor: "Dept. In-Charge / AEN",
    color: "text-sky-400",
    ring: "border-sky-500/40",
  },
  {
    id: "SR_DOM_APPROVED",
    label: "SR. DOM APPROVED",
    actor: "Sr. DOM / Chief Controller",
    color: "text-emerald-400",
    ring: "border-emerald-500/40",
  },
  {
    id: "PUBLISHED_TO_COA",
    label: "PUBLISHED TO COA",
    actor: "Control Office",
    color: "text-primary",
    ring: "border-primary/40",
  },
];

function stageIndex(s: GovernanceStage) {
  return STAGES.findIndex((st) => st.id === s);
}

export function GovernancePipelineStrip({ blocks }: { blocks: PlannedBlock[] }) {
  const liveBlocks = blocks.filter((b) => b.status !== "REJECTED").slice(0, 4);

  if (liveBlocks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <h3 className="font-display text-base font-bold text-fg">
          Governance Approval Pipeline
        </h3>
        <span className="font-mono text-[10px] text-muted rounded bg-surface-2 px-2 py-0.5 border border-border uppercase">
          SSE → Dept In-Charge → Sr. DOM → COA
        </span>
      </div>

      {/* Pipeline stages legend */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-1 shrink-0">
            <div className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-mono font-bold ${stage.ring} ${stage.color} bg-surface-2`}>
              <span className="block">{i + 1}. {stage.label}</span>
              <span className="text-muted font-normal text-[9px] block">{stage.actor}</span>
            </div>
            {i < STAGES.length - 1 && (
              <ArrowRight className="size-3 text-muted shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Per-block progress */}
      <div className="space-y-2">
        {liveBlocks.map((b) => {
          const current = blockToStage(b);
          const currentIdx = stageIndex(current);
          const isPublished = current === "PUBLISHED_TO_COA" || b.status === "APPROVED";

          return (
            <div
              key={b.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3.5 py-2.5"
            >
              {/* Block ID & summary */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-fg">{b.id}</span>
                  <span className="font-mono text-[10px] text-muted">
                    {b.departments.join("+")} · {b.taskIds.length} tasks
                  </span>
                </div>
              </div>

              {/* Pipeline progress dots */}
              <div className="flex items-center gap-1.5">
                {STAGES.map((stage, i) => {
                  const done = i <= currentIdx;
                  const active = i === currentIdx;
                  return (
                    <div key={stage.id} className="flex items-center gap-1">
                      <div
                        className={`size-5 rounded-full flex items-center justify-center border transition-all ${
                          done
                            ? active
                              ? `${stage.ring} border-2`
                              : "bg-emerald-500/20 border-emerald-500/40"
                            : "bg-surface border-border"
                        }`}
                        title={stage.label}
                      >
                        {done && !active && (
                          <CheckCircle2 className="size-3 text-emerald-400" />
                        )}
                        {active && (
                          <Clock className="size-3" style={{ color: stage.color.replace("text-", "") }} />
                        )}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div
                          className={`h-px w-4 transition-all ${
                            i < currentIdx ? "bg-emerald-500/40" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current stage label */}
              <div className="shrink-0">
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isPublished
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : current === "DEPT_APPROVED"
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                        : "bg-surface border-border text-muted"
                  }`}
                >
                  {STAGES[currentIdx]?.label ?? current}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
