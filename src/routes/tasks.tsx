import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRailStore } from "@/lib/rail/store";

export const Route = createFileRoute("/tasks")({ component: TasksRedirector });

function TasksRedirector() {
  const session = useRailStore((s) => s.session);
  const role = session?.role;

  if (role === "ENGG") {
    return <Navigate to="/workspace/engineering" search={{ tab: "work" }} replace />;
  }
  if (role === "SNT") {
    return <Navigate to="/workspace/snt" search={{ tab: "work" }} replace />;
  }
  if (role === "TRD") {
    return <Navigate to="/workspace/trd" search={{ tab: "work" }} replace />;
  }

  return <Navigate to="/control" search={{ tab: "control-desk" }} replace />;
}
