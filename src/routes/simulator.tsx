import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/simulator")({ component: SimulatorRedirector });

function SimulatorRedirector() {
  return <Navigate to="/control" search={{ tab: "optimization" }} replace />;
}

