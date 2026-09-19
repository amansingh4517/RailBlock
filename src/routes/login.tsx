import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  HardHat,
  Radio,
  Zap,
  Gauge,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, type Role } from "@/lib/rail/types";
import {
  DEMO_ACCOUNTS,
  authenticate,
  getRoleDefaultPath,
} from "@/lib/rail/auth";
import { useRailStore } from "@/lib/rail/store";

const loginSearchSchema = z.object({
  role: z.enum(["ENGG", "SNT", "TRD", "CONTROL", "ADMIN"]).catch("CONTROL").optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => loginSearchSchema.parse(search),
  component: LoginPage,
});

const ROLE_INFO: Record<
  Role,
  {
    title: string;
    subtitle: string;
    icon: typeof HardHat;
    accent: string;
    badgeBg: string;
  }
> = {
  ENGG: {
    title: "Engineering (ENGG) Sign In",
    subtitle: "Permanent Way & Civil Infrastructure Maintenance",
    icon: HardHat,
    accent: "text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  SNT: {
    title: "Signal & Telecom (S&T) Sign In",
    subtitle: "Interlocking, Point Machines & Axle Counters",
    icon: Radio,
    accent: "text-sky-400",
    badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  TRD: {
    title: "Traction Distribution (TRD) Sign In",
    subtitle: "25kV AC Overhead Equipment & Power Disconnections",
    icon: Zap,
    accent: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  CONTROL: {
    title: "Control Office Sign In",
    subtitle: "Section Operations & Corridor Possession Sanctioning",
    icon: Gauge,
    accent: "text-indigo-400",
    badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  ADMIN: {
    title: "System Administration Sign In",
    subtitle: "CRIS Interface, Directory Governance & Benchmark Tools",
    icon: ShieldCheck,
    accent: "text-rose-400",
    badgeBg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};

function LoginPage() {
  const { role: rawRole } = Route.useSearch();
  const role: Role = rawRole ?? "CONTROL";
  const navigate = useNavigate();
  const setSession = useRailStore((s) => s.setSession);

  // Default prefilled demo account for convenience while keeping UI clean and standard
  const demoAccount = DEMO_ACCOUNTS[role];
  const [employeeId, setEmployeeId] = useState(demoAccount?.employeeId ?? "");
  const [password, setPassword] = useState(demoAccount?.passwordHash ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const info = ROLE_INFO[role];
  const Icon = info.icon;

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = authenticate(employeeId, password, role);
    if (res.ok) {
      setSession(res.session);
      navigate({ to: getRoleDefaultPath(res.session.role) as any });
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center bg-bg text-fg px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted hover:text-fg">
            <Link to="/access">
              <ArrowLeft className="size-4" />
              <span>Back to Portal</span>
            </Link>
          </Button>

          <span className="font-mono text-xs text-muted">
            Indian Railways · {role}
          </span>
        </div>

        {/* Clean Role Header Banner */}
        <div className="rounded-2xl bg-surface p-6 border border-border">
          <div className="flex items-center gap-4">
            <div className={`flex size-14 items-center justify-center rounded-2xl bg-surface-2 border border-border ${info.accent}`}>
              <Icon className="size-7" />
            </div>
            <div className="space-y-1">
              <span className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${info.badgeBg}`}>
                {ROLE_LABEL[role]}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{info.title}</h1>
              <p className="text-xs text-muted">{info.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Standard Single Sign-In Form */}
        <div className="rounded-2xl bg-surface p-6 border border-border space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 p-3.5 border border-danger/20 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="empId" className="text-xs font-mono">
                Employee ID / CRIS Identity
              </Label>
              <Input
                id="empId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. ENGG-101"
                required
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass" className="text-xs font-mono">
                Password
              </Label>
              <Input
                id="pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="font-mono text-sm"
              />
            </div>

            <Button type="submit" className="w-full gap-2 mt-2" size="lg" disabled={loading}>
              <KeyRound className="size-4" />
              <span>{loading ? "Authenticating…" : "Sign In"}</span>
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center font-mono text-[11px] text-muted">
          Secured for Indian Railways Internal Possession Planning
        </p>
      </div>
    </div>
  );
}
