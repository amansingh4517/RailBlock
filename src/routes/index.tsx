import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useRailStore } from "@/lib/rail/store";
import { getRoleDefaultPath } from "@/lib/rail/auth";

export const Route = createFileRoute("/")({
  component: RootIndexRedirector,
});

function RootIndexRedirector() {
  const session = useRailStore((s) => s.session);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span className="size-2 rounded-full bg-primary animate-ping" />
          <span>Directing to operational workspace…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/access" replace />;
  }

  const target = getRoleDefaultPath(session.role);
  return <Navigate to={target as any} replace />;
}
