import {
  LayoutDashboard,
  Wrench,
  TrainTrack,
  Radio,
  Network,
  Zap,
  Power,
  Gauge,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Users,
  Sliders,
  Database,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface RoleNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description?: string;
}

export const WORKSPACE_NAV: Record<Role, RoleNavItem[]> = {
  ENGG: [
    {
      id: "overview",
      label: "Overview",
      path: "/workspace/engineering",
      icon: LayoutDashboard,
      description: "P-Way operational snapshot and critical defects",
    },
    {
      id: "work",
      label: "Track Work",
      path: "/workspace/engineering?tab=work",
      icon: Wrench,
      description: "Track maintenance queue, severity, and machine needs",
    },
    {
      id: "possessions",
      label: "Possessions",
      path: "/workspace/engineering?tab=possessions",
      icon: TrainTrack,
      description: "Sanctioned track possessions and machine assignments",
    },
    {
      id: "requisitions",
      label: "Requisitions",
      path: "/workspace/engineering?tab=requisitions",
      icon: FileText,
      description: "Submit BDMS track possession demands",
    },
  ],
  SNT: [
    {
      id: "overview",
      label: "Overview",
      path: "/workspace/snt",
      icon: LayoutDashboard,
      description: "S&T operational snapshot and interlocking health",
    },
    {
      id: "work",
      label: "S&T Work",
      path: "/workspace/snt?tab=work",
      icon: Radio,
      description: "Points, track circuits, and axle counter work queue",
    },
    {
      id: "possessions",
      label: "Possessions & Disconnections",
      path: "/workspace/snt?tab=possessions",
      icon: Network,
      description: "Disconnection notices and joint possession status",
    },
    {
      id: "requisitions",
      label: "Requisitions",
      path: "/workspace/snt?tab=requisitions",
      icon: FileText,
      description: "Submit S&T disconnection and maintenance requisitions",
    },
  ],
  TRD: [
    {
      id: "overview",
      label: "Overview",
      path: "/workspace/trd",
      icon: LayoutDashboard,
      description: "25kV OHE status and electrical feeder overview",
    },
    {
      id: "work",
      label: "OHE Work",
      path: "/workspace/trd?tab=work",
      icon: Zap,
      description: "Contact wire wear, catenary, and neutral section queue",
    },
    {
      id: "power-blocks",
      label: "Power Blocks",
      path: "/workspace/trd?tab=power-blocks",
      icon: Power,
      description: "SCADA isolation status, PTW permits, and tower wagons",
    },
    {
      id: "requisitions",
      label: "Requisitions",
      path: "/workspace/trd?tab=requisitions",
      icon: FileText,
      description: "Request 25kV power block isolation",
    },
  ],
  CONTROL: [
    {
      id: "control-desk",
      label: "Control Desk",
      path: "/control",
      icon: Gauge,
      description: "199km Corridor Ribbon and operational exceptions",
    },
    {
      id: "plan",
      label: "Block Plan",
      path: "/control?tab=plan",
      icon: CalendarDays,
      description: "Central Gantt and corridor possession board",
    },
    {
      id: "optimization",
      label: "Optimization",
      path: "/control?tab=optimization",
      icon: Sparkles,
      description: "AI corridor bundling and timetable detention solver",
    },
    {
      id: "approvals",
      label: "Requests & Approvals",
      path: "/control?tab=approvals",
      icon: CheckCircle2,
      description: "Review incoming departmental demands and sanction corridor possessions",
    },
    {
      id: "reports",
      label: "Reports",
      path: "/control?tab=reports",
      icon: BarChart3,
      description: "Asset availability, block hours saved, and detention reduction",
    },
  ],
  ADMIN: [
    {
      id: "users",
      label: "Users",
      path: "/admin",
      icon: Users,
      description: "Authorized railway personnel and role directory",
    },
    {
      id: "config",
      label: "System Configuration",
      path: "/admin?tab=config",
      icon: Sliders,
      description: "Corridor block duration limits and safety buffers",
    },
    {
      id: "data",
      label: "Data Management",
      path: "/admin?tab=data",
      icon: Database,
      description: "Benchmark datasets, seed reset, and defect feeds",
    },
    {
      id: "audit",
      label: "Audit Log",
      path: "/admin?tab=audit",
      icon: FileText,
      description: "Chronological audit trail of possession actions",
    },
  ],
};

export function getNavForRole(role: Role): RoleNavItem[] {
  return WORKSPACE_NAV[role] ?? WORKSPACE_NAV.CONTROL;
}
