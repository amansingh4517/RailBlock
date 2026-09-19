import { createFileRoute, Link } from "@tanstack/react-router";
import {
  HardHat,
  Radio,
  Zap,
  Gauge,
  ShieldCheck,
  ArrowRight,
  TrainTrack,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CORRIDOR_NAME, DIVISION, type Role } from "@/lib/rail/types";

export const Route = createFileRoute("/access")({
  component: AccessPortalPage,
});

interface RoleCardConfig {
  role: Role;
  deptTitle: string;
  deptCategory: string;
  designation: string;
  icon: typeof HardHat;
  colorBorder: string;
  colorBg: string;
  colorText: string;
  colorBadge: string;
  description: string;
  responsibilities: string[];
}

const ROLES: RoleCardConfig[] = [
  {
    role: "ENGG",
    deptTitle: "Engineering (ENGG)",
    deptCategory: "Track & Civil Engineering",
    designation: "SSE / Permanent Way, Track Machine In-Charge",
    icon: HardHat,
    colorBorder: "hover:border-amber-500/50",
    colorBg: "bg-amber-500/10",
    colorText: "text-amber-400",
    colorBadge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    description:
      "Responsible for track structural integrity, ultrasonic flaw detection, rail renewal, and mechanized tamping/screening possessions.",
    responsibilities: [
      "Track fracture & IMR defect resolution",
      "BCM, CSM & Tamping machine scheduling",
      "Points & crossings renewal blocks",
      "Deep screening & ballast regulation",
    ],
  },
  {
    role: "SNT",
    deptTitle: "Signal & Telecom (S&T)",
    deptCategory: "Signaling & Interlocking",
    designation: "SSE / Signal, Telecommunication Inspector",
    icon: Radio,
    colorBorder: "hover:border-sky-500/50",
    colorBg: "bg-sky-500/10",
    colorText: "text-sky-400",
    colorBadge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    description:
      "Responsible for electronic interlocking, track circuit tuning, point machines, axle counters, and optical fiber train communication.",
    responsibilities: [
      "Point machine overhaul & testing",
      "Track circuit & digital axle counter calibration",
      "Electronic interlocking (EI) disconnections",
      "Signal aspect visibility & cabling inspections",
    ],
  },
  {
    role: "TRD",
    deptTitle: "Traction Distribution (TRD)",
    deptCategory: "Electrical & OHE 25kV Traction",
    designation: "SSE / Traction, Tower Wagon Supervisor",
    icon: Zap,
    colorBorder: "hover:border-emerald-500/50",
    colorBg: "bg-emerald-500/10",
    colorText: "text-emerald-400",
    colorBadge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    description:
      "Responsible for 25kV AC overhead equipment (OHE), power disconnections, contact wire replacement, and sub-station feeding posts.",
    responsibilities: [
      "OHE contact & catenary wire height/stagger",
      "Power block isolation & earthing discharge",
      "Insulator washing & cantilever replacement",
      "Neutral section & section insulator checks",
    ],
  },
  {
    role: "CONTROL",
    deptTitle: "Control Office",
    deptCategory: "Corridor Operations & Traffic Control",
    designation: "Chief Section Controller, Traffic Optimizer",
    icon: Gauge,
    colorBorder: "hover:border-indigo-500/50",
    colorBg: "bg-indigo-500/10",
    colorText: "text-indigo-400",
    colorBadge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    description:
      "Central command authority balancing multi-department possession requests with passenger timetables and freight traffic throughput.",
    responsibilities: [
      "Multi-department corridor block approval/veto",
      "Shadow block slotting & cross-discipline bundling",
      "Passenger train punctuality & detention minimization",
      "Emergency traffic re-routing & speed restriction sanctions",
    ],
  },
  {
    role: "ADMIN",
    deptTitle: "System Administration",
    deptCategory: "Security, CRIS & System Governance",
    designation: "Administrator / System Auditor",
    icon: ShieldCheck,
    colorBorder: "hover:border-rose-500/50",
    colorBg: "bg-rose-500/10",
    colorText: "text-rose-400",
    colorBadge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    description:
      "Full administrative oversight over user provisioning, corridor parameters, benchmark datasets, and regulatory compliance logs.",
    responsibilities: [
      "Operational user directory & role governance",
      "Corridor benchmark dataset & seed restoration",
      "Safety conflict rules & audit logs review",
      "Global platform parameters & AI model tuning",
    ],
  },
];

function AccessPortalPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Top Banner */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <TrainTrack className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-wider">RAILBLOCK AI</span>
                <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  IR-BDMS INTEGRATION
                </span>
              </div>
              <p className="text-xs text-muted">
                {DIVISION} · {CORRIDOR_NAME} (Km 0 – 199)
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-4 sm:flex text-right text-xs">
            <div>
              <span className="text-muted block">Corridor Planning Horizon</span>
              <span className="font-mono font-medium text-fg">07 – 13 Sep 2026</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-xs">CRIS Feed Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
            Select Your Operational Workspace
          </h1>
        </div>

        {/* 5 Operational Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.role}
                className={`group flex flex-col justify-between rounded-2xl bg-surface p-6 border border-border transition-all duration-200 ${item.colorBorder} hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`flex size-12 items-center justify-center rounded-xl ${item.colorBg} ${item.colorText}`}>
                      <Icon className="size-6" />
                    </div>
                    <span className={`rounded-md border px-2.5 py-1 font-mono text-xs font-medium ${item.colorBadge}`}>
                      {item.role}
                    </span>
                  </div>

                  {/* Department & Role Info */}
                  <div className="space-y-1 mb-3">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted">
                      {item.deptCategory}
                    </p>
                    <h2 className="font-display text-2xl font-bold group-hover:text-fg transition-colors">
                      {item.deptTitle}
                    </h2>
                    <p className="text-xs text-muted font-medium">
                      {item.designation}
                    </p>
                  </div>

                  <p className="text-xs text-muted/90 leading-relaxed mb-5">
                    {item.description}
                  </p>

                  {/* Key Responsibilities */}
                  <div className="mb-6 space-y-2 rounded-xl bg-surface-2/60 p-3.5 border border-border/50">
                    <p className="font-mono text-[11px] font-semibold text-fg/80 uppercase tracking-wider">
                      Operational Capabilities:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted">
                      {item.responsibilities.map((resp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" />
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-2">
                  <Button asChild className="w-full justify-between group/btn" size="lg">
                    <Link to="/login" search={{ role: item.role }}>
                      <span className="font-medium">Enter {item.deptTitle}</span>
                      <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
