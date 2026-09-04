import type { Task } from "./types";

/** Weights from the SIH solution: severity, overdue, traffic, safety, resources. */
export const WEIGHTS = {
  severity: 0.28,
  overdue: 0.18,
  traffic: 0.22,
  safety: 0.24,
  resources: 0.08,
} as const;

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function priorityScore(task: Task, resourceAvailability = 1) {
  const severity = (task.severity / 5) * 100;
  const overdue = clamp((task.overdueDays / 45) * 100);
  const traffic = clamp(task.trafficImpact);
  const safety = clamp(task.safetyRisk);
  const resources = clamp(resourceAvailability * 100);
  const raw =
    WEIGHTS.severity * severity +
    WEIGHTS.overdue * overdue +
    WEIGHTS.traffic * traffic +
    WEIGHTS.safety * safety +
    WEIGHTS.resources * resources;
  return Math.round(raw * 10) / 10;
}

export function scoreBreakdown(task: Task, resourceAvailability = 1) {
  return {
    severity: Math.round((task.severity / 5) * 100),
    overdue: Math.round(clamp((task.overdueDays / 45) * 100)),
    traffic: Math.round(clamp(task.trafficImpact)),
    safety: Math.round(clamp(task.safetyRisk)),
    resources: Math.round(clamp(resourceAvailability * 100)),
    total: priorityScore(task, resourceAvailability),
  };
}

export function isHighPriority(score: number) {
  return score >= 70;
}
