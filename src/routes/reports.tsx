import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({ component: ReportsRedirector });

function ReportsRedirector() {
  return <Navigate to="/control" search={{ tab: "reports" }} replace />;
}
