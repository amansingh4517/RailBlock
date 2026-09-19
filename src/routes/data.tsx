import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRailStore } from "@/lib/rail/store";

export const Route = createFileRoute("/data")({ component: DataRedirector });

function DataRedirector() {
  const session = useRailStore((s) => s.session);
  const role = session?.role;

  if (role === "ADMIN") {
    return <Navigate to="/admin" search={{ tab: "data" }} replace />;
  }

  return <Navigate to="/control" replace />;
}
