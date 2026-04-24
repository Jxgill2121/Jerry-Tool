import { useState } from "react";
import MergeTab       from "./tabs/MergeTab";
import MaxMinTab      from "./tabs/MaxMinTab";
import AvgTab         from "./tabs/AvgTab";
import ASRTab         from "./tabs/ASRTab";
import ValidationTab  from "./tabs/ValidationTab";
import CycleViewerTab from "./tabs/CycleViewerTab";
import FuelSystemsTab from "./tabs/FuelSystemsTab";

/* ── Inline SVG icons (heroicons outline 24px) ────────────────────── */
const ic = (path: string | string[]) => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24"
       strokeWidth={1.6} stroke="currentColor">
    {(Array.isArray(path) ? path : [path]).map((d, i) =>
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
  </svg>
);

const ICONS: Record<string, JSX.Element> = {
  merge:      ic("M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"),
  maxmin:     ic(["M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Z","M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625Z","M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"]),
  avg:        ic("M4.499 8.248h-1.5m1.5 0-.5 6.5m.5-6.5h14m0 0h1.5m-1.5 0 .5 6.5m0 0h-14.5m14.5 0h1M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 6v6m0 0 2-2m-2 2-2-2"),
  asr:        ic(["M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"]),
  validation: ic("M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"),
  fuel:       ic(["M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"]),
  cycle:      ic(["M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z","M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"]),
};

/* ── Nav structure ────────────────────────────────────────────────── */
const GROUPS = [
  {
    label: "Processing",
    items: [
      { id: "merge",      label: "TDMS → Cycles", component: MergeTab },
      { id: "maxmin",     label: "Max / Min",      component: MaxMinTab },
      { id: "avg",        label: "Generate Averages", component: AvgTab },
    ],
  },
  {
    label: "Analysis",
    items: [
      { id: "asr",        label: "ASR Validation", component: ASRTab },
      { id: "validation", label: "Cylinder Validation", component: ValidationTab },
      { id: "fuel",       label: "Fuel Systems",   component: FuelSystemsTab },
    ],
  },
  {
    label: "Visualization",
    items: [
      { id: "cycle",      label: "Cycle Viewer",   component: CycleViewerTab },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap(g => g.items);

/* ── App ──────────────────────────────────────────────────────────── */
export default function JerryApp() {
  const [active, setActive] = useState(ALL_ITEMS[0].id);
  const current = ALL_ITEMS.find(t => t.id === active)!;
  const ActiveComponent = current.component;

  return (
    <div className="min-h-screen flex bg-base">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col bg-surface border-r border-border/60">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center shrink-0">
              <span className="text-2xl leading-none">🐐</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Jerry</p>
              <p className="text-gray-500 text-[10px] leading-tight">Just Endless Reports, Right? Yeah.</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
          {GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = item.id === active;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActive(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-accent/15 text-accent font-medium"
                            : "text-gray-400 hover:text-gray-100 hover:bg-surface2"
                        }`}
                      >
                        <span className={isActive ? "text-accent" : "text-gray-500"}>
                          {ICONS[item.id]}
                        </span>
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/60">
          <p className="text-[10px] text-gray-600">Powertech Analysis Tools</p>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-border/60 bg-surface/50 flex items-center px-6 gap-2 shrink-0">
          <span className="text-gray-600 text-sm">{GROUPS.find(g => g.items.some(i => i.id === active))?.label}</span>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-gray-200 text-sm font-medium">{current.label}</span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
