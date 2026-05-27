"use client";

// Orchestrator for the CPA-over-time chart. Mirrors the KpiCard / KpiStrip
// split: LineChart is the dumb d3 presenter; this file owns the queries
// (/performance + /anomalies for the active window), shapes them into
// LineChart's data contract, and supplies CPA-flavoured formatters.

import { useMemo, useState } from "react";

import type { AnomalyRow, PerformanceRow } from "@/lib/api";
import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";
import { formatCpa } from "@/lib/format";
import { useAnomalies, usePerformance } from "@/lib/queries";
import { useRange } from "@/lib/use-range";

import { ExpandButton, ExpandedPanel, StatsRow } from "./expanded-panel";
import {
  LineChart,
  type AnomalyMarker,
  type LineChartDatum,
  type LineSeries,
} from "./line-chart";

const CPA_LINE_COLOR = "var(--color-ctp-blue)";

export function CpaChart() {
  const { window: w, days } = useRange();
  const [isExpanded, setIsExpanded] = useState(false);

  const performance = usePerformance({
    start_date: w.start,
    end_date: w.end,
    limit: 500,
  });
  const anomalies = useAnomalies({
    start_date: w.start,
    end_date: w.end,
    flag_type: "cpa_spike",
    limit: 500,
  });

  // The mart already aggregates spend + conversions per client per day. CPA
  // is computed in SQL, but it's null on zero-conversion days — those
  // surface as gaps in the line via LineChart's `.defined()` rule.
  // Aggregate across clients (single-tenant users see one client anyway;
  // for multi-tenant agency staff this is the rolled-up tenant view).
  const series: LineSeries[] = useMemo(() => {
    const data = aggregateCpaByDay(performance.data?.items ?? []);
    return [
      {
        id: "cpa",
        label: "CPA",
        color: CPA_LINE_COLOR,
        data,
      },
    ];
  }, [performance.data]);

  const markers: AnomalyMarker[] = useMemo(() => {
    return (anomalies.data?.items ?? []).map((row) => toMarker(row));
  }, [anomalies.data]);

  const isLoading = performance.isLoading || anomalies.isLoading;
  const hasError = performance.error || anomalies.error;

  return (
    <>
      <TuiPanel
        title="CPA over time"
        subtitle={`Last ${days} days · anomalies overlaid in red`}
        actions={
          <ExpandButton onClick={() => setIsExpanded(true)} label="Expand CPA chart" />
        }
      >
        {hasError ? (
          <div className="border border-dashed border-ctp-red/40 p-4 text-xs text-ctp-red">
            Failed to load CPA data.
          </div>
        ) : (
          <LineChart
            series={series}
            anomalies={markers}
            formatY={formatCpa}
            formatTooltipValue={formatCpa}
            isLoading={isLoading}
            emptyMessage="No CPA data for this period (no conversions logged)."
          />
        )}
      </TuiPanel>

      {isExpanded ? (
        <ExpandedPanel
          title="CPA over time"
          subtitle={`Last ${days} days · ${markers.length} flagged day${markers.length === 1 ? "" : "s"}`}
          onClose={() => setIsExpanded(false)}
        >
          <StatsRow data={series[0].data} format={formatCpa} />
          <LineChart
            series={series}
            anomalies={markers}
            formatY={formatCpa}
            formatTooltipValue={formatCpa}
            height={480}
            yTickCount={10}
            isLoading={isLoading}
            emptyMessage="No CPA data for this period (no conversions logged)."
          />
        </ExpandedPanel>
      ) : null}
    </>
  );
}

// =============================================================================
// shapers
// =============================================================================

// Roll daily client-rows up to a single CPA-per-day. Single-tenant users
// already have one client per day; agency staff get a tenant-level CPA.
function aggregateCpaByDay(rows: PerformanceRow[]): LineChartDatum[] {
  const byDate = new Map<string, { spend: number; conversions: number }>();
  for (const r of rows) {
    const spend = Number(r.total_spend) || 0;
    const conv = Number(r.total_conversions) || 0;
    const entry = byDate.get(r.activity_date) ?? { spend: 0, conversions: 0 };
    entry.spend += spend;
    entry.conversions += conv;
    byDate.set(r.activity_date, entry);
  }

  const out: LineChartDatum[] = [];
  for (const [date, agg] of byDate) {
    out.push({
      date: new Date(`${date}T00:00:00Z`),
      // Match the mart's NULLIF: no conversions → CPA is undefined.
      value: agg.conversions > 0 ? agg.spend / agg.conversions : null,
    });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

function toMarker(row: AnomalyRow): AnomalyMarker {
  const cpa = row.cpa !== null ? Number(row.cpa) : 0;
  const z = row.cpa_zscore !== null ? Number(row.cpa_zscore) : null;
  const zLabel = z !== null ? ` (z=${z >= 0 ? "+" : ""}${z.toFixed(1)})` : "";
  return {
    date: new Date(`${row.activity_date}T00:00:00Z`),
    value: cpa,
    label: `cpa_spike${zLabel}`,
  };
}
