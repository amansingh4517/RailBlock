import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRailStore } from "@/lib/rail/store";

export const Route = createFileRoute("/plan")({ component: PlanRedirector });

function PlanRedirector() {
  const session = useRailStore((s) => s.session);
  const role = session?.role;

  if (role === "ENGG") {
    return <Navigate to="/workspace/engineering" search={{ tab: "possessions" }} replace />;
  }
  if (role === "SNT") {
    return <Navigate to="/workspace/snt" search={{ tab: "possessions" }} replace />;
  }
  if (role === "TRD") {
    return <Navigate to="/workspace/trd" search={{ tab: "power-blocks" }} replace />;
  }

  return <Navigate to="/control" search={{ tab: "plan" }} replace />;
}
