import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { findConflicts } from "@/lib/rail/optimizer";
import { DEFAULT_SCENARIO, type Weather } from "@/lib/rail/types";
import { useRailStore } from "@/lib/rail/store";

export const Route = createFileRoute("/simulator")({ component: SimulatorPage });

function SimulatorPage() {
  const scenario = useRailStore((s) => s.scenario);
  const setScenario = useRailStore((s) => s.setScenario);
  const reoptimize = useRailStore((s) => s.reoptimize);
  const kpis = useRailStore((s) => s.kpis);
  const blocks = useRailStore((s) => s.blocks);
  const tasks = useRailStore((s) => s.tasks);
  const conflicts = findConflicts(blocks, tasks);

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted">What-if</p>
          <h1 className="font-display text-4xl md:text-5xl">Simulator</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Change the operating picture, then rerun the constraint packer. Bundling still prefers Engineering + S&T +
            Traction on the same kilometres so one possession covers three bids.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-6 rounded-xl bg-surface p-5 hairline">
            <Field label="Extra freight on the corridor" value={`+${scenario.extraFreightPct}%`}>
              <Slider
                min={0}
                max={80}
                step={5}
                value={[scenario.extraFreightPct]}
                onValueChange={([v]) => setScenario({ extraFreightPct: v ?? 0 })}
              />
              <p className="text-xs text-faint">Above 40% midday gaps close; above 70% far-week nights drop.</p>
            </Field>

            <Field label="Gang / machine availability" value={`${scenario.gangAvailabilityPct}%`}>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[scenario.gangAvailabilityPct]}
                onValueChange={([v]) => setScenario({ gangAvailabilityPct: v ?? 100 })}
              />
            </Field>

            <div className="space-y-2">
              <Label>Weather protocol</Label>
              <Select value={scenario.weather} onValueChange={(v) => setScenario({ weather: v as Weather })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLEAR">Clear</SelectItem>
                  <SelectItem value="RAIN">Rain — mega cut, +18% duration</SelectItem>
                  <SelectItem value="FOG">Fog — first 2h of night withheld</SelectItem>
                  <SelectItem value="HEAT">Heat — destressing night-only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">Emergency weld at km 91.4</p>
                <p className="text-xs text-muted">Injects a TSR-20 insert ahead of Panipat work.</p>
              </div>
              <Switch
                checked={scenario.emergencyDefect}
                onCheckedChange={(v) => setScenario({ emergencyDefect: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">Sunday mega block</p>
                <p className="text-xs text-muted">08:00–14:00 corridor possession.</p>
              </div>
              <Switch checked={scenario.sundayMega} onCheckedChange={(v) => setScenario({ sundayMega: v })} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  reoptimize();
                  toast("Plan rebuilt against the new picture");
                }}
              >
                Re-optimize plan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setScenario(DEFAULT_SCENARIO);
                  toast("Scenario reset — rerun to restore the base plan");
                }}
              >
                Reset levers
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border">
              <Stat k="Availability" v={`${kpis.assetAvailability.toFixed(1)}%`} />
              <Stat k="Block hours" v={kpis.blockHours.toFixed(1)} />
              <Stat k="Hours saved" v={`${kpis.hoursSavedPct.toFixed(0)}%`} />
              <Stat k="Bundling" v={`${kpis.bundlingRate.toFixed(0)}%`} />
              <Stat k="High-priority" v={`${kpis.highPriorityCoverage.toFixed(0)}%`} />
              <Stat k="Detention min" v={`${kpis.detentionMin}`} />
            </div>
            <div className="rounded-xl bg-surface p-5 hairline">
              <h2 className="font-display text-xl">How the packer works</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted">
                <li>Score every open task with the weighted priority formula.</li>
                <li>Walk corridor windows in date order (mega, then night, then midday).</li>
                <li>Seed each window with the highest-value fit, then add geographic neighbours from other departments.</li>
                <li>Shared possession time is max(duration) + 32% of the rest — that is the bundling saving.</li>
                <li>Resources cannot double-book; heat/fog/rain clip windows before packing.</li>
              </ol>
            </div>
            <div className="rounded-xl bg-surface p-5 hairline">
              <h2 className="font-display text-xl">Conflicts after last solve</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {conflicts.slice(0, 6).map((c) => (
                  <li key={c.id} className={c.severity === "warn" ? "text-caution" : "text-muted"}>
                    {c.text}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-sm tabular">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="text-xs uppercase tracking-wider text-muted">{k}</p>
      <p className="font-display text-3xl tabular">{v}</p>
    </div>
  );
}
