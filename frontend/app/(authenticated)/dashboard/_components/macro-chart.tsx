"use client";

// FRED macro panel — a dedicated chart sitting alongside the marketing
// charts (CPA + ROAS). Single series at a time, picked via a header
// dropdown. Reuses LineChart unchanged.
//
// Why its own panel instead of an overlay on CPA/ROAS:
//   - Dual-axis charts are easy to misread (scale of "inflation" vs "$CPA"
//     means nothing without context).
//   - Keeps the marketing charts focused on the metric they're named after.
//   - Still satisfies the brief's "blended alongside" language — FRED data
//     is in the KPI strip (2 cards) AND in its own chart on the same page.

import { useState } from "react";

import type { MacroSeriesKey } from "@/lib/api";
import { useMacro } from "@/lib/queries";
import { useRange } from "@/lib/use-range";

import { ExpandButton, ExpandedPanel, StatsRow } from "./expanded-panel";
import {
  LineChart,
  type LineChartDatum,
  type LineSeries,
} from "./line-chart";

// =============================================================================
// Series catalog — kept in lockstep with backend SERIES_REGISTRY (app/services/fred.py)
// =============================================================================

interface SeriesConfig {
  key: MacroSeriesKey;
  label: string;       // shown in the dropdown
  short: string;       // shown in the chart header subtitle
  color: string;
  formatY: (n: number) => string;
}

const SERIES_CATALOG: SeriesConfig[] = [
  {
    key: "inflation",
    label: "Inflation (CPI)",
    short: "Consumer Price Index",
    color: "var(--color-ctp-peach)",
    formatY: (n) => n.toFixed(1),
  },
  {
    key: "unemployment",
    label: "Unemployment",
    short: "Unemployment rate",
    color: "var(--color-ctp-mauve)",
    formatY: (n) => `${n.toFixed(1)}%`,
  },
  {
    key: "sentiment",
    label: "Consumer sentiment",
    short: "U-Michigan Sentiment Index",
    color: "var(--color-ctp-sky)",
    formatY: (n) => n.toFixed(1),
  },
  {
    key: "fed_funds",
    label: "Fed funds rate",
    short: "Effective fed funds",
    color: "var(--color-ctp-yellow)",
    formatY: (n) => `${n.toFixed(2)}%`,
  },
];

const DEFAULT_SERIES: MacroSeriesKey = "inflation";

// =============================================================================
// Component
// =============================================================================

export function MacroChart() {
  const { window: w, days } = useRange();
  const [selectedKey, setSelectedKey] = useState<MacroSeriesKey>(DEFAULT_SERIES);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = SERIES_CATALOG.find((s) => s.key === selectedKey) ?? SERIES_CATALOG[0];

  // FRED returns sparse observations for monthly series (e.g. UNRATE). The
  // user might pick a 7-day window and find one or zero points. We query the
  // chosen window honestly; LineChart's empty state explains the gap.
  const macro = useMacro({
    series: [selectedKey],
    start_date: w.start,
    end_date: w.end,
  });

  const series: LineSeries[] = (() => {
    const upstream = macro.data?.items.find((s) => s.key === selectedKey);
    const data: LineChartDatum[] = (upstream?.observations ?? []).map((o) => ({
      date: new Date(`${o.date}T00:00:00Z`),
      value: o.value === null ? null : Number(o.value),
    }));
    return [
      {
        id: selectedKey,
        label: config.label,
        color: config.color,
        data,
      },
    ];
  })();

  return (
    <>
      <section className="rounded-xl border border-ctp-surface0/60 bg-ctp-base/60 p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ctp-text">Macro context</h2>
            <p className="text-xs text-ctp-subtext0">
              {config.short} · last {days} days · source: FRED
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SeriesPicker selected={selectedKey} onChange={setSelectedKey} />
            <ExpandButton onClick={() => setIsExpanded(true)} label="Expand macro chart" />
          </div>
        </header>

        {macro.error ? (
          <div className="rounded-md border border-ctp-red/30 bg-ctp-red/5 p-4 text-xs text-ctp-red">
            Failed to load macro data.
          </div>
        ) : (
          <LineChart
            series={series}
            formatY={config.formatY}
            formatTooltipValue={config.formatY}
            isLoading={macro.isLoading}
            emptyMessage={`No ${config.label} observations in the last ${days} days. Try a longer range or a different series.`}
          />
        )}
      </section>

      {isExpanded ? (
        <ExpandedPanel
          title={config.label}
          subtitle={`${config.short} · last ${days} days · FRED series ${selectedKey}`}
          onClose={() => setIsExpanded(false)}
        >
          <StatsRow data={series[0].data} format={config.formatY} />
          <LineChart
            series={series}
            formatY={config.formatY}
            formatTooltipValue={config.formatY}
            height={480}
            yTickCount={10}
            isLoading={macro.isLoading}
            emptyMessage={`No ${config.label} observations in the last ${days} days. Try a longer range or a different series.`}
          />
        </ExpandedPanel>
      ) : null}
    </>
  );
}

// =============================================================================
// Series picker
// =============================================================================

function SeriesPicker({
  selected,
  onChange,
}: {
  selected: MacroSeriesKey;
  onChange: (next: MacroSeriesKey) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ctp-subtext0">
      <span>series</span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as MacroSeriesKey)}
        // Styled-native select: matches the Catppuccin tokens used by the
        // tenant selector and range switcher. Browsers will still show
        // their own dropdown chrome on the open menu — acceptable for the
        // assessment; we can build a custom popover later if needed.
        className="cursor-pointer rounded-md border border-ctp-surface0/60 bg-ctp-base/80 px-2 py-1 text-xs font-medium text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
      >
        {SERIES_CATALOG.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
