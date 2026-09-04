import { SECTIONS, WINDOWS } from "@/lib/rail/data";
import { addDays, formatHours, minToHhmm, weekday } from "@/lib/rail/format";
import { WEEK_START, type PlannedBlock } from "@/lib/rail/types";
import { useRailStore } from "@/lib/rail/store";
import { cn } from "@/lib/utils";
import { DeptDots } from "@/components/rail/bits";

const WEEK_DATES = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

function blockColor(b: PlannedBlock) {
  if (b.departments.length > 1) return "bg-primary/80";
  if (b.departments[0] === "ENGG") return "bg-engg/80";
  if (b.departments[0] === "SNT") return "bg-snt/80";
  return "bg-trd/80";
}

export function WeekGantt({ blocks }: { blocks: PlannedBlock[] }) {
  const selected = useRailStore((s) => s.selectedBlockId);
  const selectBlock = useRailStore((s) => s.selectBlock);
  const live = blocks.filter((b) => WEEK_DATES.includes(b.date) && b.status !== "REJECTED");

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="min-w-[52rem]">
        <div className="grid grid-cols-[7rem_repeat(7,minmax(0,1fr))] gap-px bg-border">
          <div className="bg-surface px-2 py-2 text-xs uppercase tracking-wider text-muted">Section</div>
          {WEEK_DATES.map((d) => {
            const mega = WINDOWS.some((w) => w.date === d && w.kind === "MEGA");
            return (
              <div key={d} className="bg-surface px-2 py-2">
                <p className="font-display text-lg leading-none">{weekday(d)}</p>
                <p className="font-mono text-xs text-muted">
                  {d.slice(8)}
                  {mega ? " · mega" : ""}
                </p>
              </div>
            );
          })}
          {SECTIONS.map((sec) => (
            <SectionRow
              key={sec.id}
              from={sec.fromKm}
              to={sec.toKm}
              label={sec.label}
              dates={WEEK_DATES}
              blocks={live}
              selected={selected}
              onSelect={selectBlock}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionRow({
  from,
  to,
  label,
  dates,
  blocks,
  selected,
  onSelect,
}: {
  from: number;
  to: number;
  label: string;
  dates: string[];
  blocks: PlannedBlock[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col justify-center bg-bg px-2 py-2">
        <p className="font-mono text-xs text-fg">{label}</p>
        <p className="text-xs text-faint">
          {from.toFixed(0)}–{to.toFixed(0)}
        </p>
      </div>
      {dates.map((d) => {
        const cell = blocks.filter((b) => b.date === d && b.fromKm < to && b.toKm > from);
        return (
          <div key={d} className="min-h-16 bg-bg p-1.5">
            <div className="flex flex-col gap-1">
              {cell.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className={cn(
                    "rounded-sm px-1.5 py-1 text-left text-xs text-primary-fg transition-opacity duration-150",
                    blockColor(b),
                    selected === b.id ? "ring-1 ring-fg" : "opacity-90 hover:opacity-100",
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="font-mono">{minToHhmm(b.startMin)}</span>
                    <DeptDots depts={b.departments} />
                  </span>
                  <span className="block truncate text-primary-fg/80">
                    {formatHours(b.durationHours)} · {b.taskIds.length}t
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function MonthBoard({ blocks }: { blocks: PlannedBlock[] }) {
  const selectBlock = useRailStore((s) => s.selectBlock);
  const selected = useRailStore((s) => s.selectedBlockId);
  const weeks = [0, 7, 14].map((offset) => {
    const start = addDays(WEEK_START, offset);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const slice = blocks.filter((b) => dates.includes(b.date) && b.status !== "REJECTED");
    return { start, dates, slice };
  });

  return (
    <div className="space-y-6">
      {weeks.map((w) => (
        <section key={w.start}>
          <h3 className="mb-2 font-display text-xl">
            Week of {w.start.slice(8)} Sep
            <span className="ml-2 font-sans text-sm font-normal text-muted">
              {w.slice.length} blocks · {w.slice.reduce((s, b) => s + b.durationHours, 0).toFixed(1)}h
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {w.slice.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => selectBlock(b.id)}
                className={cn(
                  "rounded-md px-2.5 py-2 text-left hairline",
                  selected === b.id ? "bg-surface-2" : "bg-surface",
                )}
              >
                <p className="font-mono text-xs text-muted">
                  {b.id} · {weekday(b.date)}
                </p>
                <p className="text-sm text-fg">{formatHours(b.durationHours)}</p>
                <DeptDots depts={b.departments} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
