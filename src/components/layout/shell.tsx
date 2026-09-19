import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Menu,
  LogOut,
  User,
  ShieldCheck,
  HardHat,
  Radio,
  Zap,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { RailMark } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CORRIDOR_NAME, DIVISION, ROLE_LABEL, type Role } from "@/lib/rail/types";
import { getRoleDefaultPath } from "@/lib/rail/auth";
import { getNavForRole, type RoleNavItem } from "@/lib/rail/navigation";
import { useRailStore } from "@/lib/rail/store";
import { findConflicts } from "@/lib/rail/optimizer";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<Role, typeof HardHat> = {
  ENGG: HardHat,
  SNT: Radio,
  TRD: Zap,
  CONTROL: Gauge,
  ADMIN: ShieldCheck,
};

const DEPARTMENT_TITLE: Record<Role, string> = {
  ENGG: "Civil & Permanent Way",
  SNT: "Signal & Telecommunication",
  TRD: "Traction Distribution (25kV OHE)",
  CONTROL: "Control Office (Operations)",
  ADMIN: "System Administration",
};

function NavLinks({
  role,
  tab,
  pathname,
  onClick,
}: {
  role?: Role;
  tab?: string;
  pathname: string;
  onClick?: () => void;
}) {
  if (!role) return null;
  const navItems = getNavForRole(role);
  const tasks = useRailStore((s) => s.tasks);
  const blocks = useRailStore((s) => s.blocks);

  const unreviewedRequests = tasks.filter(
    (t) => t.status === "NEW" || t.status === "OPEN" || t.status === "UNDER_REVIEW"
  ).length;
  const pendingBlocks = blocks.filter((b) => b.status === "PENDING" || b.status === "DRAFT").length;
  const modifiedBlocks = blocks.filter((b) => b.status === "MODIFIED").length;
  const attentionCount = unreviewedRequests + pendingBlocks + modifiedBlocks;

  return (
    <>
      {navItems.map((item) => {
        const itemUrl = new URL(item.path, "http://localhost");
        const itemTab = itemUrl.searchParams.get("tab");
        const basePath = itemUrl.pathname;

        const isCurrentRoute = pathname === basePath;
        const active =
          isCurrentRoute &&
          ((!itemTab && (!tab || tab === item.id)) || (itemTab && tab === itemTab));

        const Icon = item.icon;
        const showBadge = item.id === "approvals" && attentionCount > 0;

        return (
          <Link
            key={item.id}
            to={item.path as any}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2 shrink-0 px-2.5 py-2 text-sm transition-all duration-150 font-medium rounded-lg",
              active
                ? "text-primary bg-primary/10 shadow-sm"
                : "text-muted hover:text-fg hover:bg-surface-2"
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted")} />
            <span>{item.label}</span>
            {showBadge && (
              <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
                {attentionCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

export function Shell({
  children,
  currentTab,
}: {
  children: ReactNode;
  currentTab?: string;
}) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const searchTab = (routerState.location.search as any)?.tab;
  const activeTab = currentTab ?? searchTab;

  const session = useRailStore((s) => s.session);
  const logout = useRailStore((s) => s.logout);
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const conflicts = findConflicts(blocks, tasks);
  const warningCount = conflicts.filter((c) => c.severity === "warn").length;

  function handleLogout() {
    logout();
    navigate({ to: "/access" as any });
  }

  const role = session?.role;
  const RoleIcon = role ? ROLE_ICONS[role] : User;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Refined Operational Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          {/* RailBlock Logo */}
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <RailMark />
            <div className="min-w-0">
              <span className="font-display block text-lg font-bold leading-none tracking-wide">
                RAILBLOCK AI
              </span>
              <span className="block truncate text-[11px] text-muted">
                {role ? DEPARTMENT_TITLE[role] : DIVISION}
              </span>
            </div>
          </Link>

          {/* Corridor Coordinates & Planning Horizon */}
          <div className="ml-auto hidden text-right text-xs text-muted xl:block font-mono">
            <span>{CORRIDOR_NAME} (NDLS 0 — UMB 199)</span>
            <span className="mt-0.5 block tabular text-fg font-medium">
              Horizon: 07 – 13 Sep 2026
            </span>
          </div>

          {/* Exceptions Indicator */}
          {warningCount > 0 && role === "CONTROL" && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400 border border-amber-500/20 font-mono">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>{warningCount} Exceptions</span>
            </div>
          )}

          {/* Officer Profile & Logout */}
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2 rounded-xl bg-surface p-1.5 border border-border">
                <Link
                  to={getRoleDefaultPath(session.role) as any}
                  className="flex items-center gap-2.5 px-2 py-1 text-xs hover:bg-surface-2 rounded-lg transition-colors"
                  title="Designated workspace home"
                >
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <RoleIcon className="size-4" />
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <span className="font-semibold text-fg block truncate max-w-[150px]">
                      {session.name}
                    </span>
                    <span className="text-[10px] text-muted font-mono block truncate max-w-[150px]">
                      {session.designation}
                    </span>
                  </div>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-7 px-2 text-xs text-muted hover:text-danger hover:bg-danger/10 gap-1.5"
                  title="Sign out of current workspace"
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden md:inline font-mono">Sign out</span>
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" variant="default">
                <Link to="/access">Sign in</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Role-Aware Primary Navigation Bar */}
        {role && (
          <nav className="hidden items-center gap-1 overflow-x-auto px-6 py-1.5 md:flex border-t border-border/50 bg-surface/40">
            <NavLinks pathname={pathname} tab={activeTab} role={role} />
          </nav>
        )}
      </header>

      {/* Mobile Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col gap-1 pt-14">
          <SheetTitle className="sr-only">Workspace Navigation</SheetTitle>
          <div className="mb-4">
            <span className="font-display block text-lg font-bold">RAILBLOCK</span>
            <span className="text-xs text-muted font-mono">{role ? DEPARTMENT_TITLE[role] : ""}</span>
          </div>
          <div className="flex flex-col gap-1">
            <NavLinks
              pathname={pathname}
              tab={activeTab}
              role={role}
              onClick={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
