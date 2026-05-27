"use client";

// Shared modal + button + stats helpers for the "click to expand" pattern.
// TUI restyle: bracket button trigger, dashed modal frame, ── TITLE ── cap.
//
// Every chart panel (CPA, ROAS, Macro) and the Anomalies panel share:
//   - <ExpandButton/> in their header — opens the modal
//   - <ExpandedPanel/> as the modal shell — backdrop, Esc/click-outside
//   - <StatsRow/> at the top of the expanded chart view
//
// Kept in one file because they're a coordinated set; importing one usually
// means importing the others.

import { useEffect } from "react";

import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";

import type { LineChartDatum } from "./line-chart";

// =============================================================================
// ExpandButton — `[ ⛶ ]` bracket button rendered in a panel's actions slot.
// =============================================================================

export function ExpandButton({
  onClick,
  label = "Expand view",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group inline-flex items-center px-1 text-xs text-ctp-subtext1 transition-colors hover:text-ctp-text focus-visible:outline-none focus-visible:underline"
    >
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">[</span>
      <span className="px-0.5" aria-hidden>
        ⛶
      </span>
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">]</span>
    </button>
  );
}

// =============================================================================
// ExpandedPanel (modal shell)
// =============================================================================

interface ExpandedPanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function ExpandedPanel({
  title,
  subtitle,
  onClose,
  children,
}: ExpandedPanelProps) {
  // Esc to close. No focus trap or in-modal tab cycling — basic dialog
  // semantics are enough for a presentation-focused dashboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ctp-crust/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — TuiPanel handles the dashed frame + title cap. Close button
          sits in the actions slot so it composes with the title row. */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto">
        <TuiPanel
          title={title}
          subtitle={subtitle}
          tone="active"
          actions={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="group inline-flex items-center text-xs text-ctp-subtext1 transition-colors hover:text-ctp-red focus-visible:outline-none focus-visible:underline"
            >
              <span className="text-ctp-overlay0 group-hover:text-ctp-red/60">[</span>
              <span className="px-0.5" aria-hidden>
                ×
              </span>
              <span className="text-ctp-overlay0 group-hover:text-ctp-red/60">]</span>
            </button>
          }
        >
          {children}
        </TuiPanel>
      </div>
    </div>
  );
}

// =============================================================================
// StatsRow
// =============================================================================

interface SeriesStats {
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export function computeSeriesStats(data: LineChartDatum[]): SeriesStats {
  const values: number[] = [];
  for (const d of data) {
    if (d.value !== null && Number.isFinite(d.value)) values.push(d.value);
  }
  if (values.length === 0) {
    return { avg: null, min: null, max: null, count: 0 };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

export function StatsRow({
  data,
  format,
}: {
  data: LineChartDatum[];
  format: (n: number) => string;
}) {
  const stats = computeSeriesStats(data);
  const fmt = (n: number | null) => (n === null ? "—" : format(n));

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Average" value={fmt(stats.avg)} />
      <StatCard label="Minimum" value={fmt(stats.min)} />
      <StatCard label="Maximum" value={fmt(stats.max)} />
      <StatCard label="Data points" value={String(stats.count)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <TuiPanel title={label} className="!pt-4 !pb-3">
      <div className="text-xl font-semibold tabular-nums text-ctp-text">
        {value}
      </div>
    </TuiPanel>
  );
}
