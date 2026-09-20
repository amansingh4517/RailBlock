import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  ShieldCheck,
  Users,
  Sliders,
  Database,
  FileText,
  RefreshCw,
  Lock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  UserPlus,
  Search,
  Filter,
  Save,
  Layers,
  ArrowRight,
  Cpu,
  Download,
  Trash2,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequestDrawer } from "@/components/control/request-drawer";
import { getAllUsers, registerUser, revokeUser, type PrototypeUser } from "@/lib/rail/auth";
import { useRailStore } from "@/lib/rail/store";
import { ROLE_LABEL, WEEK_START, WEEK_END, CURRENT_WEEK_HORIZON, type Role, type Task } from "@/lib/rail/types";

const searchSchema = z.object({
  tab: z.enum(["users", "config", "data", "audit"]).catch("users").optional(),
});

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: AdminWorkspacePage,
});

function AdminWorkspacePage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "users";

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <Shell currentTab={currentTab}>
        <AdminMain currentTab={currentTab} />
      </Shell>
    </AuthGuard>
  );
}

function AdminMain({ currentTab }: { currentTab: string }) {
  const resetToSeed = useRailStore((s) => s.resetToSeed);
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);
  const kpis = useRailStore((s) => s.kpis);
  const audit = useRailStore((s) => s.audit);
  const config = useRailStore((s) => s.config);
  const updateConfig = useRailStore((s) => s.updateConfig);
  const selectBlock = useRailStore((s) => s.selectBlock);
  const addTask = useRailStore((s) => s.addTask);
  const addAuditLog = useRailStore((s) => s.addAuditLog);
  const navigate = useNavigate();

  const [users, setUsers] = useState<PrototypeUser[]>(() => getAllUsers());
  const [resetConfirm, setResetConfirm] = useState(false);

  // Users tab state
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmpId, setNewEmpId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("ENGG");
  const [newDesig, setNewDesig] = useState("");
  const [newPass, setNewPass] = useState("rail123");

  // System Configuration editable state
  const [cfgMinDuration, setCfgMinDuration] = useState(config.minBlockDurationMin);
  const [cfgMaxDuration, setCfgMaxDuration] = useState(config.maxBlockDurationMin);
  const [cfgHeadway, setCfgHeadway] = useState(config.safetyHeadwayMin);
  const [cfgShadowPolicy, setCfgShadowPolicy] = useState(config.shadowPolicy);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState<string>("");
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");

  // Feature 5: Solver Engine Toggle
  const [solverEngine, setSolverEngine] = useState<"HEURISTIC" | "CP_SAT">("HEURISTIC");
  const [solverBusy, setSolverBusy] = useState(false);

  function handleSolverToggle(engine: "HEURISTIC" | "CP_SAT") {
    if (engine === "CP_SAT") {
      setSolverBusy(true);
      toast.info("Connecting to Python OR-Tools CP-SAT Solver API…");
      setTimeout(() => {
        setSolverEngine("CP_SAT");
        setSolverBusy(false);
        toast.success("Solver Engine switched to Python CP-SAT (MILP). Next Optimize run will use exact solver.");
      }, 1200);
    } else {
      setSolverEngine("HEURISTIC");
      toast.success("Solver Engine set to Client Heuristic (fast, deterministic).");
    }
  }

  // Task inspection drawer
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);

  function handleResetAll() {
    resetToSeed();
    localStorage.removeItem("railblock_users_v1");
    setUsers(getAllUsers());
    setResetConfirm(false);
    toast.success("Benchmark state restored to clean Indian Railways seed data.");
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    const res = registerUser({
      employeeId: newEmpId,
      name: newName,
      role: newRole,
      department: newRole,
      designation: newDesig || `Officer / ${ROLE_LABEL[newRole]}`,
      passwordHash: newPass,
    });

    if (res.ok) {
      toast.success(`User ${newEmpId} created successfully`);
      setUsers(getAllUsers());
      setShowAddUser(false);
      setNewEmpId("");
      setNewName("");
      setNewDesig("");
    } else {
      toast.error(res.error);
    }
  }

  function handleSaveConfiguration(e: React.FormEvent) {
    e.preventDefault();
    updateConfig({
      minBlockDurationMin: Number(cfgMinDuration),
      maxBlockDurationMin: Number(cfgMaxDuration),
      safetyHeadwayMin: Number(cfgHeadway),
      shadowPolicy: cfgShadowPolicy,
    });
    addAuditLog("CONFIG_CHANGE", `Updated system parameters: min=${cfgMinDuration}m, max=${cfgMaxDuration}m, headway=${cfgHeadway}m, policy=${cfgShadowPolicy}`);
    toast.success("System configuration saved and logged to audit trail");
  }

  function handleRevokeUser(employeeId: string) {
    const ok = revokeUser(employeeId);
    if (ok) {
      setUsers(getAllUsers());
      addAuditLog("USER_REVOCATION", `Revoked access for employee ${employeeId}`);
      toast.success(`Access revoked for employee ${employeeId}`);
    } else {
      toast.error(`Could not revoke access for ${employeeId}`);
    }
  }

  function handleSimulateFeedIngestion() {
    const newT1: Task = {
      id: `T-TMS-${Date.now().toString().slice(-4)}`,
      source: "TMS",
      department: "ENGG",
      title: "Emergency Rail Flange Inspection Km 72.4–75.0 Up",
      detail: "High-frequency ultrasonic wave detection flagged micro-crack suspect near Samalkha.",
      fromKm: 72.4,
      toKm: 75.0,
      line: "UP",
      durationHours: 3.5,
      severity: 4,
      overdueDays: 2,
      trafficImpact: 65,
      safetyRisk: 82,
      resourceIds: ["r-pwm-pnp"],
      earliest: WEEK_START,
      latest: WEEK_END,
      canBundle: true,
      status: "OPEN",
    };
    addTask(newT1);
    addAuditLog("FEED_INGESTION", "Simulated real-time TMS track defect telemetry ingestion");
    toast.success("Ingested live TMS track defect demand into active solver queue!");
  }

  function handleExportAuditCsv() {
    const headers = ["ID", "Timestamp", "Actor", "Action", "Detail", "BlockID"];
    const rows = audit.map((a) => [
      a.id,
      `"${a.at}"`,
      a.actor,
      `"${a.action}"`,
      `"${a.detail.replace(/"/g, '""')}"`,
      a.blockId || "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RailBlock_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Audit log exported as CSV file");
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      return (
        u.employeeId.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter audit events
  const filteredAudit = audit.filter((a) => {
    if (auditFilter !== "ALL" && a.actor !== auditFilter) return false;
    if (auditActionFilter !== "ALL" && !a.action.includes(auditActionFilter)) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      return (
        a.action.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q) ||
        (a.blockId && a.blockId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate benchmark reset impact preview
  const customUsersCount = users.filter(
    (u) => !["ENGG-101", "SNT-201", "TRD-301", "CTRL-401", "ADM-001"].includes(u.employeeId)
  ).length;
  const customTasksCount = tasks.filter((t) => t.status === "NEW" || t.status === "REJECTED" || t.status === "ACCEPTED").length;
  const modifiedBlocksCount = blocks.filter(
    (b) => b.status === "APPROVED" || b.status === "MODIFIED" || b.status === "REJECTED"
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Clear Governance Header */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-rose-400 uppercase text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-rose-400" />
            SYSTEM ADMINISTRATION &amp; CRIS GOVERNANCE
          </span>
          <p className="text-muted text-xs">
            User access directory, corridor safety limits, benchmark data integrity, and regulatory audit logging. Operational possession sanctioning is managed exclusively by the Control Office.
          </p>
        </div>
        <span className="rounded bg-surface px-2.5 py-1 font-mono text-[11px] text-muted border border-border shrink-0">
          Role: CRIS Administrator
        </span>
      </div>

      {/* Tab 1: USERS */}
      {currentTab === "users" && (
        <div className="space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted font-mono">
                <span>CRIS Identity &amp; Role Governance</span>
              </div>
              <h1 className="font-display mt-1 text-3xl md:text-4xl font-bold">
                User Directory
              </h1>
              <p className="text-xs text-muted">Manage authorized personnel across Engineering, S&amp;T, TRD, and Control Office.</p>
            </div>

            <Button onClick={() => setShowAddUser(!showAddUser)} size="sm" className="gap-2">
              <UserPlus className="size-4" />
              <span>{showAddUser ? "Close Form" : "Add Authorized User"}</span>
            </Button>
          </header>

          {/* Add User Modal / Form */}
          {showAddUser && (
            <form
              onSubmit={handleCreateUser}
              className="rounded-xl border border-border bg-surface p-5 space-y-4 max-w-xl"
            >
              <h3 className="font-display text-lg font-bold">Provision New Prototype User</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Employee ID</Label>
                  <Input
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="e.g. ENGG-501"
                    required
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Full Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Anand Sharma"
                    required
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Operational Role</Label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-mono"
                  >
                    <option value="ENGG">Engineering (ENGG)</option>
                    <option value="SNT">Signal &amp; Telecom (SNT)</option>
                    <option value="TRD">Traction Distribution (TRD)</option>
                    <option value="CONTROL">Control Office (CONTROL)</option>
                    <option value="ADMIN">Administrator (ADMIN)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Designation / Posting</Label>
                  <Input
                    value={newDesig}
                    onChange={(e) => setNewDesig(e.target.value)}
                    placeholder="e.g. SSE / Permanent Way"
                    className="text-sm"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full">
                Provision User
              </Button>
            </form>
          )}

          {/* Search & Role Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
              <Input
                placeholder="Search Employee ID, Name, Designation..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 h-8 text-xs font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              {["ALL", "ENGG", "SNT", "TRD", "CONTROL", "ADMIN"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                    userRoleFilter === r
                      ? "bg-primary text-primary-fg font-bold"
                      : "bg-surface-2 text-muted hover:text-fg border border-border"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* User Directory Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Designation / Posting</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No personnel found matching the query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isDemo = ["ENGG-101", "SNT-201", "TRD-301", "CTRL-401", "ADM-001"].includes(
                      u.employeeId
                    );
                    return (
                      <tr key={u.userId} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-fg">{u.employeeId}</td>
                        <td className="px-4 py-3 font-medium text-fg">{u.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold border border-border">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted font-mono">{u.designation}</td>
                        <td className="px-4 py-3">
                          {isDemo ? (
                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                              <CheckCircle2 className="size-3" />
                              Benchmark Demo Account
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                              Custom Provisioned User
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDemo ? (
                            <span className="text-[11px] text-muted font-mono">System Account</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1 font-mono"
                              onClick={() => handleRevokeUser(u.employeeId)}
                            >
                              <Trash2 className="size-3.5" />
                              <span>Revoke Access</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: SYSTEM CONFIGURATION */}
      {currentTab === "config" && (
        <div className="space-y-6">
          <header>
            <h1 className="font-display text-2xl md:text-3xl font-bold">System Configuration</h1>
            <p className="text-xs text-muted mt-1">
              Corridor operational limits, optimization parameters, and safety clearance rules.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Editable Active Operational Configuration */}
            <form onSubmit={handleSaveConfiguration} className="rounded-xl bg-surface p-5 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-fg">Active Operational Constraints</h3>
                <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-mono font-bold">
                  Configurable
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-mono text-muted">Minimum Single Block Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={cfgMinDuration}
                    onChange={(e) => setCfgMinDuration(Number(e.target.value))}
                    min={30}
                    max={240}
                    step={15}
                    className="font-mono text-xs"
                    required
                  />
                  <p className="text-[10px] text-faint">Demands requesting less time will be padded to this minimum.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-mono text-muted">Maximum Single Block Window (minutes)</Label>
                  <Input
                    type="number"
                    value={cfgMaxDuration}
                    onChange={(e) => setCfgMaxDuration(Number(e.target.value))}
                    min={180}
                    max={600}
                    step={30}
                    className="font-mono text-xs"
                    required
                  />
                  <p className="text-[10px] text-faint">Longest continuous possession allowed without train break.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-mono text-muted">Safety Headway Buffer (minutes)</Label>
                  <Input
                    type="number"
                    value={cfgHeadway}
                    onChange={(e) => setCfgHeadway(Number(e.target.value))}
                    min={5}
                    max={30}
                    step={5}
                    className="font-mono text-xs"
                    required
                  />
                  <p className="text-[10px] text-faint">Mandatory separation between last passenger train and block start.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-mono text-muted">Shadow Possession Policy</Label>
                  <select
                    value={cfgShadowPolicy}
                    onChange={(e) => setCfgShadowPolicy(e.target.value as any)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-mono"
                  >
                    <option value="AUTO_CLUSTERING">Automatic Multi-Department Clustering (Active)</option>
                    <option value="MANUAL">Manual Bundling Only</option>
                  </select>
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full gap-2">
                <Save className="size-4" />
                <span>Save Operational Configuration</span>
              </Button>
            </form>

            {/* Read-Only Prototype Boundaries */}
            <section className="rounded-xl bg-surface p-5 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-fg">Corridor Boundary Parameters</h3>
                <span className="rounded bg-surface-2 text-muted px-2 py-0.5 text-[10px] font-mono">
                  Fixed Prototype Limits
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted">Corridor Kilometres:</span>
                  <span className="text-fg font-bold">Km 0 (NDLS) – Km 199 (UMB)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted">Governed Lines:</span>
                  <span className="text-fg font-bold">Double Line (UP / DN)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted">Traction Electrification:</span>
                  <span className="text-fg font-bold">25kV AC 50Hz OHE</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted">Planning Horizon:</span>
                  <span className="text-fg font-bold">{CURRENT_WEEK_HORIZON} (7 Days)</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted">Optimization Algorithm:</span>
                  <span className="text-emerald-400 font-bold">Deterministic Constraint Packer</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 3: DATA MANAGEMENT */}
      {currentTab === "data" && (
        <div className="space-y-6">
          <header>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Data Management</h1>
            <p className="text-xs text-muted mt-1">
              Corridor benchmark dataset integrity, custom data persistence, and seed data restoration.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl bg-surface p-5 border border-border space-y-4">
              <h3 className="font-display text-lg font-bold">Benchmark Dataset Controls</h3>
              <p className="text-xs text-muted leading-relaxed">
                Restore the corridor schedule, personnel directory, and work queues back to the pristine benchmark seed state.
              </p>

              {resetConfirm ? (
                <div className="space-y-3 rounded-xl bg-danger/10 p-4 border border-danger/30">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-bold text-danger uppercase block">
                      Confirm Reset to Seed
                    </span>
                    <p className="text-xs text-muted">
                      This will reset:
                    </p>
                    <ul className="text-xs font-mono text-danger space-y-0.5 pl-3 list-disc">
                      <li>{customTasksCount} custom departmental requisitions</li>
                      <li>{customUsersCount} custom provisioned users</li>
                      <li>{modifiedBlocksCount} modified block approvals/rejections</li>
                    </ul>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="danger" onClick={handleResetAll}>
                      Yes, Restore Clean Seed
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2 text-muted hover:text-fg"
                  onClick={() => setResetConfirm(true)}
                >
                  <RefreshCw className="size-4" />
                  <span>Restore Clean Benchmark Dataset</span>
                </Button>
              )}
            </section>

            <section className="rounded-xl bg-surface p-5 border border-border space-y-4">
              <h3 className="font-display text-lg font-bold">Active Data Registry Summary</h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Active Work Orders (Tasks):</span>
                  <span className="text-fg font-bold">{tasks.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Corridor Possessions (Blocks):</span>
                  <span className="text-fg font-bold">{blocks.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Seated Tasks:</span>
                  <span className="text-emerald-400 font-bold">{kpis.tasksPlanned}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Open Backlog:</span>
                  <span className="text-amber-400 font-bold">{kpis.tasksOpen}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs gap-2"
                  onClick={handleSimulateFeedIngestion}
                >
                  <PlusCircle className="size-4 text-primary" />
                  <span>Simulate Real-Time TMS Feed Ingestion</span>
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 4: AUDIT LOG */}
      {currentTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">System Audit Trail</h1>
              <p className="text-xs text-muted">Chronological log of operational decisions and regulatory actions</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-border hover:bg-surface-2"
                onClick={handleExportAuditCsv}
              >
                <Download className="size-3.5 text-primary" />
                <span>Export Audit Log (CSV)</span>
              </Button>

              <div className="relative w-48 sm:w-60">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted" />
                <Input
                  placeholder="Search Action, ID, detail..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-8 h-8 text-xs font-mono"
                />
              </div>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-mono"
              >
                <option value="ALL">All Actors</option>
                <option value="CONTROL">Control Office</option>
                <option value="ENGG">Engineering</option>
                <option value="SNT">Signal &amp; Telecom</option>
                <option value="TRD">Traction</option>
                <option value="ADMIN">Administrator</option>
              </select>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-mono"
              >
                <option value="ALL">All Actions</option>
                <option value="APPROVE">Approvals</option>
                <option value="REJECT">Rejections</option>
                <option value="SHIFT">Shifts</option>
                <option value="REQUISITION">Requisitions</option>
                <option value="CONFIG_CHANGE">Config Changes</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wider text-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No audit events recorded matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((a) => {
                    // Extract ID if present in detail or blockId
                    const linkedTask = tasks.find((t) => a.detail.includes(t.id));

                    return (
                      <tr key={a.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3 text-muted text-[11px] whitespace-nowrap">{a.at}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold border border-border">
                            {a.actor}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-fg">{a.action}</td>
                        <td className="px-4 py-3 text-muted">
                          <span>{a.detail}</span>
                          {linkedTask && (
                            <button
                              type="button"
                              onClick={() => setDrawerTask(linkedTask)}
                              className="ml-2 text-primary underline underline-offset-2 inline-flex items-center gap-1 hover:text-primary/80"
                            >
                              <span>View {linkedTask.id}</span>
                              <ArrowRight className="size-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Drawer for Admin inspection */}
      <RequestDrawer
        task={drawerTask}
        isOpen={Boolean(drawerTask)}
        onClose={() => setDrawerTask(null)}
        onSelectBlock={(bId: string) => {
          selectBlock(bId);
          navigate({ to: "/control", search: { tab: "plan" } });
          setDrawerTask(null);
        }}
      />
    </div>
  );
}
