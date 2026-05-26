"use client";

// Shared modal + button + stats helpers for the "click to expand" pattern.
//
// Every chart panel (CPA, ROAS, Macro) and the Anomalies panel share:
//   - <ExpandButton/> in their header — opens the modal
//   - <ExpandedPanel/> as the modal shell — backdrop, Esc/click-outside,
//     wider than the upload dialog (max-w-5xl) so charts breathe
//   - <StatsRow/> at the top of the expanded chart view — Avg / Min / Max /
//     Data points computed from the same data series the chart renders
//
// Kept in one file because they're a coordinated set; importing one usually
// means importing the others.

import { Maximize2, X } from "lucide-react";
import { useEffect } from "react";

import type { LineChartDatum } from "./line-chart";

// =============================================================================
// ExpandButton
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
      className="rounded-md border border-ctp-surface0/60 bg-ctp-base/60 p-1.5 text-ctp-subtext0 transition-colors duration-150 hover:bg-ctp-surface0/60 hover:text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
    >
      <Maximize2 className="h-3.5 w-3.5" />
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

      {/* Panel */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-ctp-surface0/80 bg-ctp-mantle p-6 shadow-2xl shadow-black/60">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ctp-text">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-ctp-subtext0">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ctp-subtext0 transition-colors hover:bg-ctp-surface0/60 hover:text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {children}
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
    <div className="rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-ctp-text">
        {value}
      </div>
    </div>
  );
}
