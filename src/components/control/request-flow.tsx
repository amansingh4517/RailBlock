import { CheckCircle2, ClipboardList, Route, Sparkles } from "lucide-react";
import type { Department } from "@/lib/rail/types";

const LABEL: Record<Department, string> = {
  ENGG: "Engineering",
  SNT: "Signal & Telecom",
  TRD: "Traction Distribution",
};

/** A compact, consistent explanation of what happens after a department submits work. */
export function RequestFlow({ department }: { department: Department }) {
  return (
    <section className="rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="Requisition workflow">
      <div className="flex items-center gap-2">
        <Route className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-fg">Where this {LABEL[department]} request goes</h2>
      </div>
      <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <li className="rounded-lg border border-border bg-surface p-2.5">
          <ClipboardList className="mb-1 size-3.5 text-primary" />
          <span className="font-semibold text-fg">1. Submit</span>
          <span className="mt-0.5 block text-muted">It enters Control Office as a new request.</span>
        </li>
        <li className="rounded-lg border border-border bg-surface p-2.5">
          <CheckCircle2 className="mb-1 size-3.5 text-amber-400" />
          <span className="font-semibold text-fg">2. Control review</span>
          <span className="mt-0.5 block text-muted">Control accepts it for planning or records a rejection reason.</span>
        </li>
        <li className="rounded-lg border border-border bg-surface p-2.5">
          <Sparkles className="mb-1 size-3.5 text-emerald-400" />
          <span className="font-semibold text-fg">3. Plan & sanction</span>
          <span className="mt-0.5 block text-muted">Accepted work is included in the next corridor optimization run.</span>
        </li>
      </ol>
    </section>
  );
}
