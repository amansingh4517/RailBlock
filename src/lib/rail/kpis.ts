import { WINDOWS } from "./data";
import { WEEK_START, WEEK_END, CURRENT_WEEK_HORIZON, type Kpis, type PlannedBlock, type Scenario, type Task } from "./types";
import { activeTasks, uncoordinatedHours } from "./optimizer";
import { isHighPriority, priorityScore } from "./scoring";

export function computeKpis(blocks: PlannedBlock[], scenario: Scenario, allTasks: Task[]): Kpis {
  const liveBlocks = blocks.filter((b) => b.status !== "REJECTED");
  const tasks = activeTasks(scenario);
  const plannedIds = new Set(liveBlocks.flatMap((b) => b.taskIds));
  const blockHours = liveBlocks.reduce((s, b) => s + b.durationHours, 0);
  const naive = uncoordinatedHours(tasks, scenario);
  const hoursSavedPct = naive > 0 ? ((naive - blockHours) / naive) * 100 : 0;
  const bundledTasks = liveBlocks.filter((b) => b.bundled).reduce((s, b) => s + b.taskIds.length, 0);
  const plannedCount = liveBlocks.reduce((s, b) => s + b.taskIds.length, 0);
  const gang = scenario.gangAvailabilityPct / 100;
  const high = tasks.filter((t) => isHighPriority(priorityScore(t, gang)));
  const highCovered = high.filter((t) => plannedIds.has(t.id)).length;
  const weekBlocks = liveBlocks.filter((b) => b.date >= WEEK_START && b.date <= WEEK_END);
  const weekHours = weekBlocks.reduce((s, b) => s + b.durationHours, 0);
  const corridorHours = 24 * 7 * 2;
  const assetAvailability = Math.max(82, 100 - (weekHours / corridorHours) * 100 * 3.4);
  const detentionMin = liveBlocks.reduce((s, b) => s + b.disruptionMin, 0);
  const weekWindows = WINDOWS.filter((w) => w.date >= WEEK_START && w.date <= WEEK_END);
  const used = new Set(weekBlocks.map((b) => b.windowId));

  return {
    assetAvailability: Math.round(assetAvailability * 10) / 10,
    blockHours: Math.round(blockHours * 10) / 10,
    uncoordinatedHours: Math.round(naive * 10) / 10,
    hoursSavedPct: Math.round(hoursSavedPct * 10) / 10,
    bundlingRate: plannedCount ? Math.round((bundledTasks / plannedCount) * 1000) / 10 : 0,
    highPriorityCoverage: high.length ? Math.round((highCovered / high.length) * 1000) / 10 : 100,
    detentionMin,
    tasksPlanned: plannedCount,
    tasksOpen: tasks.filter((t) => !plannedIds.has(t.id)).length,
    windowsUsed: used.size,
    windowsTotal: weekWindows.length,
  };
}

export function localBriefing(kpis: Kpis, blocks: PlannedBlock[], tasks: Task[], scenario: Scenario) {
  const week = blocks.filter((b) => b.date >= WEEK_START && b.date <= WEEK_END && b.status !== "REJECTED");
  const bundled = week.filter((b) => b.departments.length > 1).length;
  const top = [...tasks]
    .filter((t) => t.status === "OPEN")
    .sort((a, b) => b.severity - a.severity || b.safetyRisk - a.safetyRisk)[0];
  const weather =
    scenario.weather === "CLEAR"
      ? "Fair weather — full night possessions stand."
      : scenario.weather === "RAIN"
        ? "Rain protocol: mega block cut, durations inflated 18%."
        : scenario.weather === "FOG"
          ? "Fog: first 2h of night blocks withheld for movement."
          : "Heat: destressing confined to night rail-temp window.";
  const freight =
    scenario.extraFreightPct > 0
      ? ` Goods pathing +${scenario.extraFreightPct}% tightens midday gaps.`
      : "";
  const emergency = scenario.emergencyDefect
    ? " Emergency weld at km 91.4 is in the queue and should lead Panipat possessions."
    : "";

  return [
    `Delhi Division control order for NDLS–UMB, week of ${CURRENT_WEEK_HORIZON}.`,
    `${week.length} integrated blocks, ${kpis.blockHours.toFixed(1)}h of possession versus ${kpis.uncoordinatedHours.toFixed(1)}h if departments ran separately (${kpis.hoursSavedPct.toFixed(0)}% fewer block hours).`,
    `${bundled} multi-department possessions; bundling rate ${kpis.bundlingRate.toFixed(0)}%. Asset availability modelled at ${kpis.assetAvailability.toFixed(1)}%.`,
    `High-priority coverage ${kpis.highPriorityCoverage.toFixed(0)}%. Estimated detention ${kpis.detentionMin} train-minutes.`,
    top ? `Lead risk: ${top.id} — ${top.title}.` : "",
    weather + freight + emergency,
  ]
    .filter(Boolean)
    .join(" ");
}
