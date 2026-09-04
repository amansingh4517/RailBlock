import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { RailMark } from "@/components/rail/bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CORRIDOR_NAME, DIVISION, ROLE_LABEL, type Role } from "@/lib/rail/types";
import { useRailStore } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command" },
  { to: "/plan", label: "Block plan" },
  { to: "/tasks", label: "Work queue" },
  { to: "/assets", label: "Assets" },
  { to: "/data", label: "Data hub" },
  { to: "/simulator", label: "Simulator" },
  { to: "/reports", label: "Impact" },
] as const;

function NavLinks({ onClick, pathname }: { onClick?: () => void; pathname: string }) {
  return (
    <>
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              "shrink-0 px-1 py-2 text-sm transition-colors duration-150",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {item.label}
            {active ? (
              <span className="mt-1 block h-px bg-primary" />
            ) : (
              <span className="mt-1 block h-px bg-transparent" />
            )}
          </Link>
        );
      })}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useRailStore((s) => s.role);
  const setRole = useRailStore((s) => s.setRole);
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <RailMark />
            <span className="min-w-0">
              <span className="font-display block text-xl leading-none tracking-wide">RAILBLOCK AI</span>
              <span className="block truncate text-[11px] text-muted">{DIVISION}</span>
            </span>
          </Link>
          <p className="ml-auto hidden text-right text-xs text-muted lg:block">
            {CORRIDOR_NAME}
            <span className="mt-0.5 block font-mono tabular text-fg">NDLS 0 — UMB 199</span>
          </p>
          <div className="ml-auto w-[11.5rem] lg:ml-4">
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger aria-label="Acting as" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <nav className="hidden items-center gap-5 overflow-x-auto px-6 md:flex">
          <NavLinks pathname={pathname} />
        </nav>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col gap-1 pt-14">
          <SheetTitle className="sr-only">Navigate</SheetTitle>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Navigate</p>
          <div className="flex flex-col">
            <NavLinks pathname={pathname} onClick={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
