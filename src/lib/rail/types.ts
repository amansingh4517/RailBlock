export type Department = "ENGG" | "SNT" | "TRD";
export type Role = "CONTROL" | "ENGG" | "SNT" | "TRD" | "ADMIN";
export type TaskSource = "TMS" | "SMMS" | "TDMS" | "BDMS";
export type Line = "UP" | "DN" | "BOTH";
export type TaskStatus = "OPEN" | "PLANNED" | "APPROVED" | "DONE" | "DEFERRED";
export type BlockStatus = "DRAFT" | "PENDING" | "APPROVED" | "MODIFIED" | "REJECTED";
export type WindowKind = "NIGHT" | "MIDDAY" | "MEGA" | "SHADOW";
export type Weather = "CLEAR" | "RAIN" | "FOG" | "HEAT";
export type AssetType =
  | "TRACK"
  | "POINT"
  | "SIGNAL"
  | "OHE"
  | "BRIDGE"
  | "LC"
  | "AXLE_COUNTER"
  | "TSS";

export interface Station {
  code: string;
  name: string;
  km: number;
}

export interface SectionRow {
  id: string;
  label: string;
  fromKm: number;
  toKm: number;
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  km: number;
  health: number;
  lastMaintained: string;
  department: Department;
  riskNote: string;
}

export interface Resource {
  id: string;
  name: string;
  kind: "GANG" | "MACHINE" | "CREW";
  department: Department;
  base: string;
  capacity: number;
}

export interface Task {
  id: string;
  source: TaskSource;
  department: Department;
  title: string;
  detail: string;
  fromKm: number;
  toKm: number;
  line: Line;
  durationHours: number;
  severity: 1 | 2 | 3 | 4 | 5;
  overdueDays: number;
  trafficImpact: number;
  safetyRisk: number;
  resourceIds: string[];
  earliest: string;
  latest: string;
  canBundle: boolean;
  status: TaskStatus;
}

export interface WindowSlot {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  kind: WindowKind;
  line: Line;
  fromKm: number;
  toKm: number;
  disruptionCost: number;
}

export interface PlannedBlock {
  id: string;
  windowId: string;
  date: string;
  startMin: number;
  endMin: number;
  fromKm: number;
  toKm: number;
  line: Line;
  taskIds: string[];
  departments: Department[];
  bundled: boolean;
  status: BlockStatus;
  disruptionMin: number;
  durationHours: number;
  note?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: Role;
  action: string;
  blockId?: string;
  detail: string;
}

export interface Scenario {
  extraFreightPct: number;
  emergencyDefect: boolean;
  gangAvailabilityPct: number;
  weather: Weather;
  sundayMega: boolean;
}

export interface Kpis {
  assetAvailability: number;
  blockHours: number;
  uncoordinatedHours: number;
  hoursSavedPct: number;
  bundlingRate: number;
  highPriorityCoverage: number;
  detentionMin: number;
  tasksPlanned: number;
  tasksOpen: number;
  windowsUsed: number;
  windowsTotal: number;
}

export interface TrainPath {
  number: string;
  name: string;
  dir: Line;
  passPnp: string;
  class: "RAJ" | "SHATABDI" | "MAIL" | "PASS" | "GOODS";
}

export const DEPT_LABEL: Record<Department, string> = {
  ENGG: "Engineering",
  SNT: "Signal & Telecom",
  TRD: "Traction Distribution",
};

export const ROLE_LABEL: Record<Role, string> = {
  CONTROL: "Control Office",
  ENGG: "Engineering",
  SNT: "S&T",
  TRD: "Traction",
  ADMIN: "Administrator",
};

export const SOURCE_LABEL: Record<TaskSource, string> = {
  TMS: "Track Management System",
  SMMS: "Signalling Maintenance",
  TDMS: "Traction Distribution",
  BDMS: "Block Demand (BDMS)",
};

export const DEFAULT_SCENARIO: Scenario = {
  extraFreightPct: 0,
  emergencyDefect: false,
  gangAvailabilityPct: 100,
  weather: "CLEAR",
  sundayMega: true,
};

export const WEEK_START = "2026-09-07";
export const HORIZON_END = "2026-09-27";
export const CORRIDOR_KM = 199;
export const DIVISION = "Northern Railway · Delhi Division";
export const CORRIDOR_NAME = "New Delhi – Ambala Cantt";
