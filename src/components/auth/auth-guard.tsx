import { Link, Navigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type Role } from "@/lib/rail/types";
import { getRoleDefaultPath } from "@/lib/rail/auth";
import { useRailStore } from "@/lib/rail/store";

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const session = useRailStore((s) => s.session);
  const logout = useRailStore((s) => s.logout);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid SSR / hydration flicker
  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span className="size-2 rounded-full bg-primary animate-ping" />
          <span>Verifying operational credentials…</span>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to Access Portal
  if (!session) {
    return <Navigate to="/access" replace />;
  }

  // Authenticated but unauthorized for this role-specific area
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    const defaultPath = getRoleDefaultPath(session.role);
    const requiredRoles = allowedRoles.map((r) => ROLE_LABEL[r]).join(" or ");

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg p-6 text-center text-fg">
        <div className="mx-auto max-w-md space-y-6 rounded-2xl bg-surface p-8 hairline shadow-xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger/15 text-danger">
            <ShieldAlert className="size-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full bg-danger/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-danger">
              Restricted Operational Area
            </span>
            <h1 className="font-display text-2xl md:text-3xl">Access Denied</h1>
            <p className="text-sm text-muted">
              You are signed in as <strong className="text-fg">{session.name}</strong> ({session.designation} · {ROLE_LABEL[session.role]}).
            </p>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              This operational workspace requires <strong className="text-fg">{requiredRoles}</strong> authorization.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button asChild variant="default" className="gap-2">
              <Link to={defaultPath}>
                <ArrowLeft className="size-4" />
                <span>Go to {ROLE_LABEL[session.role]}</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-muted hover:text-fg"
              onClick={() => logout()}
            >
              <LogOut className="size-4" />
              <span>Switch Account</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
