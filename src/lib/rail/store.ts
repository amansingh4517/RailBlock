import { create } from "zustand";
import { TASKS } from "./data";
import { computeKpis } from "./kpis";
import { activeTasks, optimize } from "./optimizer";
import {
  DEFAULT_SCENARIO,
  type AuditEvent,
  type BlockStatus,
  type Role,
  type Scenario,
  type Task,
  type TaskStatus,
} from "./types";

function applyPlan(scenario: Scenario): { blocks: ReturnType<typeof optimize>; tasks: Task[] } {
  const blocks = optimize(scenario);
  const planned = new Set(blocks.flatMap((b) => b.taskIds));
  const live = activeTasks(scenario).map((t) => ({
    ...t,
    status: (planned.has(t.id) ? "PLANNED" : t.status) as TaskStatus,
  }));
  const done = TASKS.filter((t) => t.status === "DONE");
  const tasks = [...live.filter((t) => t.id !== "T-ENGG-EMG" || scenario.emergencyDefect), ...done];
  return { blocks, tasks };
}

const initialScenario = DEFAULT_SCENARIO;
const seeded = applyPlan(initialScenario);
const initialKpis = computeKpis(seeded.blocks, initialScenario, seeded.tasks);

interface RailState {
  role: Role;
  scenario: Scenario;
  blocks: ReturnType<typeof optimize>;
  tasks: Task[];
  kpis: typeof initialKpis;
  audit: AuditEvent[];
  selectedBlockId: string | null;
  selectedTaskId: string | null;
  grokBrief: string | null;
  grokBusy: boolean;
  setRole: (role: Role) => void;
  setScenario: (patch: Partial<Scenario>) => void;
  reoptimize: () => void;
  selectBlock: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  setBlockStatus: (id: string, status: BlockStatus, note?: string) => void;
  shiftBlock: (id: string, minutes: number) => void;
  setGrokBrief: (text: string | null) => void;
  setGrokBusy: (busy: boolean) => void;
}

let auditSeq = 1;

function stamp(actor: Role, action: string, detail: string, blockId?: string): AuditEvent {
  const n = auditSeq++;
  const hh = 8 + (n % 5);
  const mm = (n * 7) % 60;
  return {
    id: `A-${n}`,
    at: `2026-09-04T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`,
    actor,
    action,
    blockId,
    detail,
  };
}

export const useRailStore = create<RailState>((set, get) => ({
  role: "CONTROL",
  scenario: initialScenario,
  blocks: seeded.blocks,
  tasks: seeded.tasks,
  kpis: initialKpis,
  audit: [
    stamp("ADMIN", "INGEST", "TMS / SMMS / TDMS snapshot loaded for Delhi Division."),
    stamp("CONTROL", "SOLVE", "Constraint packer produced the week-1 integrated plan."),
  ],
  selectedBlockId: seeded.blocks[0]?.id ?? null,
  selectedTaskId: null,
  grokBrief: null,
  grokBusy: false,
  setRole: (role) => set({ role }),
  setScenario: (patch) => set({ scenario: { ...get().scenario, ...patch } }),
  reoptimize: () => {
    const { scenario, role } = get();
    const next = applyPlan(scenario);
    set({
      blocks: next.blocks,
      tasks: next.tasks,
      kpis: computeKpis(next.blocks, scenario, next.tasks),
      selectedBlockId: next.blocks[0]?.id ?? null,
      grokBrief: null,
      audit: [
        stamp(
          role,
          "REOPTIMIZE",
          `Solver rerun · weather ${scenario.weather} · gangs ${scenario.gangAvailabilityPct}% · freight +${scenario.extraFreightPct}%.`,
        ),
        ...get().audit,
      ],
    });
  },
  selectBlock: (id) => set({ selectedBlockId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
  setBlockStatus: (id, status, note) => {
    const { role, scenario } = get();
    const blocks = get().blocks.map((b) => (b.id === id ? { ...b, status, note: note ?? b.note } : b));
    set({
      blocks,
      kpis: computeKpis(blocks, scenario, get().tasks),
      audit: [stamp(role, status, `${id} marked ${status}${note ? ` — ${note}` : ""}.`, id), ...get().audit],
    });
  },
  shiftBlock: (id, minutes) => {
    const { role, scenario } = get();
    const blocks = get().blocks.map((b) => {
      if (b.id !== id) return b;
      const startMin = Math.max(0, Math.min(1200, b.startMin + minutes));
      const dur = b.endMin - b.startMin;
      return { ...b, startMin, endMin: startMin + dur, status: "MODIFIED" as const };
    });
    set({
      blocks,
      kpis: computeKpis(blocks, scenario, get().tasks),
      audit: [
        stamp(role, "SHIFT", `${id} shifted ${minutes > 0 ? "+" : ""}${minutes} min.`, id),
        ...get().audit,
      ],
    });
  },
  setGrokBrief: (text) => set({ grokBrief: text }),
  setGrokBusy: (busy) => set({ grokBusy: busy }),
}));
