import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRailStore } from "@/lib/rail/store";
import { getRoleDefaultPath } from "@/lib/rail/auth";

export const Route = createFileRoute("/assets")({ component: AssetsRedirector });

function AssetsRedirector() {
  const session = useRailStore((s) => s.session);
  const target = session ? getRoleDefaultPath(session.role) : "/access";
  return <Navigate to={target as any} replace />;
}
