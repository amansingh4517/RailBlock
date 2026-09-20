import { create } from "zustand";
import { clearSession, getSession, saveSession, type UserSession } from "./auth";
import { TASKS } from "./data";
import { computeKpis } from "./kpis";
import { activeTasks, optimize } from "./optimizer";
import {
  DEFAULT_SCENARIO,
  type AuditEvent,
  type BlockStatus,
  type Department,
  type Role,
  type Scenario,
  type Task,
  type TaskStatus,
  type WorkStatus,
  type SystemConfig,
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

const initialScenario: Scenario = { ...DEFAULT_SCENARIO };
const seeded = applyPlan(initialScenario);
const initialKpis = computeKpis(seeded.blocks, initialScenario, seeded.tasks);

const initialConfig: SystemConfig = {
  minBlockDurationMin: 120,
  maxBlockDurationMin: 360,
  safetyHeadwayMin: 15,
  shadowPolicy: "AUTO_CLUSTERING",
};

interface RailState {
  session: UserSession | null;
  role: Role;
  scenario: Scenario;
  config: SystemConfig;
  blocks: ReturnType<typeof optimize>;
  tasks: Task[];
  kpis: typeof initialKpis;
  audit: AuditEvent[];
  selectedBlockId: string | null;
  selectedTaskId: string | null;
  grokBrief: string | null;
  grokBusy: boolean;
  setSession: (session: UserSession | null) => void;
  setRole: (role: Role) => void;
  logout: () => void;
  setScenario: (patch: Partial<Scenario>) => void;
  updateConfig: (patch: Partial<SystemConfig>) => void;
  reoptimize: () => void;
  selectBlock: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  setBlockStatus: (id: string, status: BlockStatus, note?: string) => void;
  setWorkStatus: (
    id: string,
    workStatus: WorkStatus,
    actor?: { role: Role; department?: string; name?: string }
  ) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, note?: string, reason?: string) => void;
  shiftBlock: (id: string, minutes: number) => void;
  setGrokBrief: (text: string | null) => void;
  setGrokBusy: (busy: boolean) => void;
  resetToSeed: () => void;
  addTask: (task: Task) => void;
  addAuditLog: (action: string, detail: string, blockId?: string) => void;
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

const STORAGE_KEY = "railblock_state_v2";

function loadPersistedState(): { blocks: ReturnType<typeof optimize>; tasks: Task[]; audit?: AuditEvent[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.blocks) && Array.isArray(parsed.tasks)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Could not parse persisted rail state:", err);
  }
  return null;
}

function persistState(blocks: ReturnType<typeof optimize>, tasks: Task[], audit?: AuditEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ blocks, tasks, audit }));
  } catch (err) {
    console.warn("Could not save rail state to localStorage:", err);
  }
}

const initialSession = getSession();
const savedState = loadPersistedState();
const initialBlocks = savedState ? savedState.blocks : seeded.blocks;
const initialTasks = savedState ? savedState.tasks : seeded.tasks;
const initialAuditEvents = savedState?.audit ?? [
  stamp("ADMIN", "INGEST", "TMS / SMMS / TDMS snapshot loaded for Delhi Division."),
  stamp("CONTROL", "SOLVE", "Constraint packer produced the week-1 integrated plan."),
];

export const useRailStore = create<RailState>((set, get) => ({
  session: initialSession,
  role: initialSession ? initialSession.role : "CONTROL",
  scenario: initialScenario,
  config: initialConfig,
  blocks: initialBlocks,
  tasks: initialTasks,
  kpis: computeKpis(initialBlocks, initialScenario, initialTasks),
  audit: initialAuditEvents,
  selectedBlockId: initialBlocks[0]?.id ?? null,
  selectedTaskId: null,
  grokBrief: null,
  grokBusy: false,
  setSession: (session) => {
    if (session) {
      saveSession(session);
      set({ session, role: session.role });
    } else {
      clearSession();
      set({ session: null });
    }
  },
  logout: () => {
    clearSession();
    set({ session: null });
  },
  setRole: (role) => set({ role }),
  setScenario: (patch) => set({ scenario: { ...get().scenario, ...patch } }),
  updateConfig: (patch) => {
    const { role } = get();
    const nextConfig = { ...get().config, ...patch };
    set({
      config: nextConfig,
      audit: [
        stamp(role, "CONFIG_CHANGE", `System configuration updated: ${Object.keys(patch).join(", ")}.`),
        ...get().audit,
      ],
    });
  },
  reoptimize: () => {
    const { scenario, role } = get();
    const next = applyPlan(scenario);
    const nextAudit = [
      stamp(
        role,
        "REOPTIMIZE",
        `Solver rerun · weather ${scenario.weather} · gangs ${scenario.gangAvailabilityPct}% · freight +${scenario.extraFreightPct}%.`,
      ),
      ...get().audit,
    ];
    set({
      blocks: next.blocks,
      tasks: next.tasks,
      kpis: computeKpis(next.blocks, scenario, next.tasks),
      selectedBlockId: next.blocks[0]?.id ?? null,
      grokBrief: null,
      audit: nextAudit,
    });
    persistState(next.blocks, next.tasks, nextAudit);
  },
  selectBlock: (id) => set({ selectedBlockId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
  setBlockStatus: (id, status, note) => {
    const { role, scenario } = get();
    const blocks = get().blocks.map((b) =>
      b.id === id
        ? {
            ...b,
            status,
            workStatus: b.workStatus || (status === "APPROVED" ? "NOT_STARTED" : b.workStatus),
            note: note ?? b.note,
          }
        : b
    );
    const nextAudit = [stamp(role, status, `${id} marked ${status}${note ? ` — ${note}` : ""}.`, id), ...get().audit];
    set({
      blocks,
      kpis: computeKpis(blocks, scenario, get().tasks),
      audit: nextAudit,
    });
    persistState(blocks, get().tasks, nextAudit);
  },
  setWorkStatus: (id, workStatus, actor) => {
    const { role, scenario } = get();
    const targetBlock = get().blocks.find((b) => b.id === id);
    if (!targetBlock) return;

    const now = new Date().toISOString();
    const actorRole = actor?.role || role;
    const actorName = actor?.name || actorRole;
    const actorDept =
      actor?.department || (actorRole !== "ADMIN" && actorRole !== "CONTROL" ? (actorRole as Department) : undefined);

    const blocks = get().blocks.map((b) => {
      if (b.id !== id) return b;
      return {
        ...b,
        workStatus,
        startedAt: workStatus === "ACTIVE" && !b.startedAt ? now : b.startedAt,
        completedAt: workStatus === "COMPLETED" ? now : b.completedAt,
        completedBy:
          workStatus === "COMPLETED"
            ? { role: actorRole, department: actorDept, name: actorName }
            : b.completedBy,
      };
    });

    let tasks = get().tasks;
    if (workStatus === "COMPLETED" && targetBlock.taskIds.length > 0) {
      const taskSet = new Set(targetBlock.taskIds);
      tasks = tasks.map((t) => (taskSet.has(t.id) ? { ...t, status: "DONE" as const } : t));
    }

    const action =
      workStatus === "COMPLETED"
        ? "WORK_COMPLETED"
        : workStatus === "ACTIVE"
          ? "WORK_STARTED"
          : "WORK_UPDATE";
    const detail =
      workStatus === "COMPLETED"
        ? `Maintenance work on possession ${id} confirmed COMPLETED by ${actorName} (${actorDept || actorRole}). Associated tasks marked DONE.`
        : workStatus === "ACTIVE"
          ? `Maintenance work on possession ${id} marked ACTIVE (started) by ${actorName}.`
          : `Possession ${id} work status updated to ${workStatus}.`;

    const nextAudit = [stamp(actorRole, action, detail, id), ...get().audit];
    set({
      blocks,
      tasks,
      kpis: computeKpis(blocks, scenario, tasks),
      audit: nextAudit,
    });
    persistState(blocks, tasks, nextAudit);
  },
  updateTaskStatus: (taskId, status, note, reason) => {
    const { role, scenario, blocks } = get();
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, status, rejectionReason: reason ?? t.rejectionReason } : t
    );
    const nextAudit = [
        stamp(
          role,
          status === "ACCEPTED" ? "ACCEPT_REQUEST" : status === "REJECTED" ? "REJECT_REQUEST" : "TASK_UPDATE",
          `Request ${taskId} marked ${status}${reason ? ` (Reason: ${reason})` : note ? ` — ${note}` : ""}.`,
        ),
        ...get().audit,
      ];
    set({
      tasks,
      kpis: computeKpis(blocks, scenario, tasks),
      audit: nextAudit,
    });
    persistState(blocks, tasks, nextAudit);
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
  resetToSeed: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    const fresh = applyPlan(DEFAULT_SCENARIO);
    set({
      scenario: DEFAULT_SCENARIO,
      config: initialConfig,
      blocks: fresh.blocks,
      tasks: fresh.tasks,
      kpis: computeKpis(fresh.blocks, DEFAULT_SCENARIO, fresh.tasks),
      selectedBlockId: null,
      selectedTaskId: null,
      grokBrief: null,
      grokBusy: false,
    });
  },
  addTask: (task) => {
    const enrichedTask: Task = {
      ...task,
      status: task.status || "NEW",
      submittedAt: task.submittedAt || new Date().toISOString(),
    };
    const tasks = [enrichedTask, ...get().tasks];
    const { role, scenario, blocks } = get();
    const nextAudit = [
      stamp(role, "REQUISITION", `Requisition ${task.id} (${task.department}) submitted: ${task.title}`),
      ...get().audit,
    ];
    set({
      tasks,
      kpis: computeKpis(blocks, scenario, tasks),
      audit: nextAudit,
    });
    persistState(blocks, tasks, nextAudit);
  },
  addAuditLog: (action, detail, blockId) => {
    const { role } = get();
    set({
      audit: [stamp(role, action, detail, blockId), ...get().audit],
    });
  },
}));
