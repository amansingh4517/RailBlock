import type { Department, Line, WindowKind } from "./types";

export function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function minToHhmm(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatKm(km: number) {
  return `${km.toFixed(1)}`;
}

export function formatSpan(fromKm: number, toKm: number) {
  return `km ${fromKm.toFixed(1)}–${toKm.toFixed(1)}`;
}

export function formatHours(h: number) {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${pad2(mins)}m`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function weekday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function dayIndex(iso: string, start: string) {
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${start}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export function deptClass(d: Department) {
  if (d === "ENGG") return "text-engg";
  if (d === "SNT") return "text-snt";
  return "text-trd";
}

export function deptBg(d: Department) {
  if (d === "ENGG") return "bg-engg";
  if (d === "SNT") return "bg-snt";
  return "bg-trd";
}

export function lineLabel(line: Line) {
  if (line === "BOTH") return "Up + Dn";
  return line === "UP" ? "Up line" : "Dn line";
}

export function kindLabel(kind: WindowKind) {
  if (kind === "NIGHT") return "Night traffic block";
  if (kind === "MIDDAY") return "Midday goods gap";
  if (kind === "MEGA") return "Sunday mega block";
  return "Shadow block";
}

export function pct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

export function severityLabel(s: number) {
  if (s >= 5) return "Safety critical";
  if (s >= 4) return "Urgent";
  if (s >= 3) return "Priority";
  if (s >= 2) return "Routine";
  return "Backlog";
}
