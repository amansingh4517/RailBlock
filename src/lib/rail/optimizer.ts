import { EMERGENCY_TASK, RESOURCES, TASKS, buildWindows } from "./data";
import { addDays } from "./format";
import { priorityScore } from "./scoring";
import {
  WEEK_START,
  type PlannedBlock,
  type Scenario,
  type Task,
  type WindowSlot,
} from "./types";

function overlapsKm(a: { fromKm: number; toKm: number }, b: { fromKm: number; toKm: number }, buffer = 4) {
  return a.fromKm - buffer < b.toKm && b.fromKm - buffer < a.toKm;
}

function linesConflict(a: Task, b: Task) {
  if (a.line === "BOTH" || b.line === "BOTH") return overlapsKm(a, b, 0.2);
  return a.line === b.line && overlapsKm(a, b, 0.2);
}

function windowHours(w: WindowSlot) {
  return (w.endMin - w.startMin) / 60;
}

function weatherDurationFactor(weather: Scenario["weather"]) {
  if (weather === "RAIN") return 1.18;
  if (weather === "FOG") return 1.08;
  if (weather === "HEAT") return 1.12;
  return 1;
}

function taskDuration(task: Task, scenario: Scenario) {
  return task.durationHours * weatherDurationFactor(scenario.weather);
}

export function bundleDuration(tasks: Task[], scenario: Scenario) {
  if (tasks.length === 0) return 0;
  const durs = tasks.map((t) => taskDuration(t, scenario));
  const max = Math.max(...durs);
  const rest = durs.reduce((s, n) => s + n, 0) - max;
  const extraDepts = new Set(tasks.map((t) => t.department)).size - 1;
  const coord = extraDepts > 0 ? 0.32 : 0.45;
  return Math.round((max + rest * coord) * 100) / 100;
}

function resourceOk(used: Set<string>, task: Task) {
  return task.resourceIds.every((id) => !used.has(id));
}

function dateInRange(date: string, task: Task) {
  return date >= task.earliest && date <= task.latest;
}

function heatBlocked(task: Task, scenario: Scenario, window: WindowSlot) {
  if (scenario.weather !== "HEAT") return false;
  if (!task.title.toLowerCase().includes("destress")) return false;
  return window.kind !== "NIGHT";
}

function fogBlocked(window: WindowSlot, scenario: Scenario) {
  if (scenario.weather !== "FOG") return false;
  return window.kind === "NIGHT" && window.startMin < 120;
}

export function activeTasks(scenario: Scenario): Task[] {
  const base = TASKS.filter((t) => t.status === "OPEN" || t.status === "DEFERRED");
  if (scenario.emergencyDefect && !base.some((t) => t.id === EMERGENCY_TASK.id)) {
    return [...base, EMERGENCY_TASK];
  }
  return base;
}

function windowCapacityHours(window: WindowSlot, scenario: Scenario) {
  let hours = windowHours(window);
  if (scenario.weather === "RAIN" && window.kind === "MEGA") hours *= 0.75;
  if (scenario.weather === "FOG" && window.kind === "NIGHT") hours = Math.max(2.5, hours - 0.75);
  hours *= scenario.gangAvailabilityPct / 100;
  return hours;
}

function disruptionOf(window: WindowSlot, durationH: number, tasks: Task[], scenario: Scenario) {
  const occupancy = durationH / Math.max(windowHours(window), 0.5);
  const depts = new Set(tasks.map((t) => t.department)).size;
  const bundleRelief = 1 - Math.min(0.28, (depts - 1) * 0.12);
  const freight = 1 + scenario.extraFreightPct / 200;
  const kindBoost = window.kind === "MIDDAY" ? 1.25 : window.kind === "MEGA" ? 0.9 : 0.7;
  const spanKm = Math.max(...tasks.map((t) => t.toKm)) - Math.min(...tasks.map((t) => t.fromKm));
  const spanFactor = 1 + Math.min(0.4, spanKm / 120);
  return Math.round(window.disruptionCost * occupancy * bundleRelief * freight * kindBoost * spanFactor);
}

function packCluster(
  window: WindowSlot,
  pool: Task[],
  taken: Set<string>,
  usedRes: Set<string>,
  scenario: Scenario,
  scores: Map<string, number>,
): Task[] {
  if (fogBlocked(window, scenario)) return [];
  const cap = windowCapacityHours(window, scenario);
  const remainingCap = cap;
  const candidates = pool
    .filter((t) => !taken.has(t.id) && dateInRange(window.date, t) && t.canBundle)
    .filter((t) => taskDuration(t, scenario) <= remainingCap + 0.35)
    .filter((t) => !heatBlocked(t, scenario, window))
    .filter((t) => resourceOk(usedRes, t))
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

  const seed = candidates[0];
  if (!seed) return [];

  const selected: Task[] = [];
  const clusterRes = new Set(usedRes);

  const tryAdd = (task: Task) => {
    if (taken.has(task.id) || selected.some((s) => s.id === task.id)) return false;
    if (!resourceOk(clusterRes, task)) return false;
    if (selected.length > 0 && !selected.some((s) => overlapsKm(s, task, 6))) return false;
    const spanFrom = Math.min(task.fromKm, ...selected.map((s) => s.fromKm));
    const spanTo = Math.max(task.toKm, ...selected.map((s) => s.toKm));
    if (spanTo - spanFrom > 28) return false;
    const next = [...selected, task];
    if (bundleDuration(next, scenario) > cap + 0.2) return false;
    selected.push(task);
    for (const id of task.resourceIds) clusterRes.add(id);
    return true;
  };

  tryAdd(seed);

  const neighbours = candidates
    .filter((t) => t.id !== seed.id)
    .sort((a, b) => {
      const aN = overlapsKm(a, seed, 6) ? 1 : 0;
      const bN = overlapsKm(b, seed, 6) ? 1 : 0;
      const aD = a.department !== seed.department ? 1 : 0;
      const bD = b.department !== seed.department ? 1 : 0;
      if (aN !== bN) return bN - aN;
      if (aD !== bD) return bD - aD;
      return (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
    });

  for (const t of neighbours) {
    if (selected.length >= 4) break;
    tryAdd(t);
  }

  return selected;
}

export function optimize(scenario: Scenario): PlannedBlock[] {
  const windows = buildWindows(scenario.sundayMega).filter((w) => {
    if (scenario.extraFreightPct >= 40 && w.kind === "MIDDAY") return false;
    if (scenario.extraFreightPct >= 70 && w.kind === "NIGHT" && w.date > addDays(WEEK_START, 10)) return false;
    return true;
  });

  const pool = activeTasks(scenario);
  const gangFactor = scenario.gangAvailabilityPct / 100;
  const scores = new Map(pool.map((t) => [t.id, priorityScore(t, gangFactor)]));
  const taken = new Set<string>();
  const blocks: PlannedBlock[] = [];

  const rankedWindows = [...windows].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const kindRank = { MEGA: 0, NIGHT: 1, MIDDAY: 2, SHADOW: 3 };
    return kindRank[a.kind] - kindRank[b.kind];
  });

  let seq = 1;
  for (const window of rankedWindows) {
    const usedRes = new Set<string>();
    for (let n = 0; n < 6; n++) {
      const packed = packCluster(window, pool, taken, usedRes, scenario, scores);
      if (packed.length === 0) break;
      for (const t of packed) {
        taken.add(t.id);
        for (const id of t.resourceIds) usedRes.add(id);
      }
      const durationHours = bundleDuration(packed, scenario);
      const fromKm = Math.min(...packed.map((t) => t.fromKm));
      const toKm = Math.max(...packed.map((t) => t.toKm));
      const depts = [...new Set(packed.map((t) => t.department))];
      const line = packed.every((t) => t.line === packed[0].line) ? packed[0].line : "BOTH";
      const startMin = window.startMin;
      const endMin = Math.min(window.endMin, startMin + Math.round(durationHours * 60));
      blocks.push({
        id: `B-${String(seq).padStart(3, "0")}`,
        windowId: window.id,
        date: window.date,
        startMin,
        endMin,
        fromKm,
        toKm,
        line,
        taskIds: packed.map((t) => t.id),
        departments: depts,
        bundled: depts.length > 1 || packed.length > 1,
        status: "PENDING",
        workStatus: "NOT_STARTED",
        disruptionMin: disruptionOf(window, durationHours, packed, scenario),
        durationHours,
      });
      seq += 1;
    }
  }

  return blocks;
}

export function uncoordinatedHours(tasks: Task[], scenario: Scenario) {
  return tasks.reduce((s, t) => s + taskDuration(t, scenario), 0);
}

export function findConflicts(blocks: PlannedBlock[], tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const notes: { id: string; severity: "warn" | "info"; text: string }[] = [];
  for (const b of blocks) {
    if (b.durationHours > 6.5) {
      notes.push({
        id: `${b.id}-long`,
        severity: "warn",
        text: `${b.id} runs ${b.durationHours.toFixed(1)}h — exceeds typical 6h possession.`,
      });
    }
    const packed = b.taskIds.map((id) => byId.get(id)).filter(Boolean) as Task[];
    const resCount = new Map<string, number>();
    for (const t of packed) {
      for (const r of t.resourceIds) resCount.set(r, (resCount.get(r) ?? 0) + 1);
    }
    for (const [rid, n] of resCount) {
      if (n > 1) {
        const name = RESOURCES.find((r) => r.id === rid)?.name ?? rid;
        notes.push({
          id: `${b.id}-${rid}`,
          severity: "warn",
          text: `${b.id} double-books ${name}.`,
        });
      }
    }
  }
  const sameDay = new Map<string, PlannedBlock[]>();
  for (const b of blocks) {
    const arr = sameDay.get(b.date) ?? [];
    arr.push(b);
    sameDay.set(b.date, arr);
  }
  for (const [, arr] of sameDay) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const timeOverlap = a.startMin < b.endMin && b.startMin < a.endMin;
        const geo = a.fromKm < b.toKm && b.fromKm < a.toKm;
        if (timeOverlap && geo && (a.line === "BOTH" || b.line === "BOTH" || a.line === b.line)) {
          notes.push({
            id: `${a.id}-${b.id}`,
            severity: "warn",
            text: `${a.id} overlaps ${b.id} on ${a.date} (${a.fromKm.toFixed(0)}–${b.toKm.toFixed(0)} km).`,
          });
        }
      }
    }
  }
  const planned = new Set(blocks.flatMap((b) => b.taskIds));
  const criticalLeft = tasks.filter((t) => t.status === "OPEN" && t.severity >= 5 && !planned.has(t.id));
  for (const t of criticalLeft) {
    notes.push({
      id: `open-${t.id}`,
      severity: "warn",
      text: `Critical ${t.id} is still unplanned: ${t.title}.`,
    });
  }
  if (notes.length === 0) {
    notes.push({
      id: "clear",
      severity: "info",
      text: "No hard conflicts. Bundled possessions respect resource and geography rules.",
    });
  }
  return notes;
}

export { windowHours, linesConflict };
