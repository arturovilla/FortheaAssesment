"use client";

// ROAS-over-time chart. Same shape as CpaChart (slice 2) — different metric,
// different formatter, different anomaly flag. Kept parallel rather than
// abstracted into a generic <MetricChart>: each metric's aggregation + flag
// choice is small and reads more clearly when colocated.

import { useMemo, useState } from "react";

import type { AnomalyRow, PerformanceRow } from "@/lib/api";
import { formatMultiplier } from "@/lib/format";
import { useAnomalies, usePerformance } from "@/lib/queries";
import { useRange } from "@/lib/use-range";

import { ExpandButton, ExpandedPanel, StatsRow } from "./expanded-panel";
import {
  LineChart,
  type AnomalyMarker,
  type LineChartDatum,
  type LineSeries,
} from "./line-chart";

const ROAS_LINE_COLOR = "var(--color-ctp-green)";

export function RoasChart() {
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
    flag_type: "roas_collapse",
    limit: 500,
  });

  const series: LineSeries[] = useMemo(() => {
    const data = aggregateRoasByDay(performance.data?.items ?? []);
    return [
      {
        id: "roas",
        label: "ROAS",
        color: ROAS_LINE_COLOR,
        data,
      },
    ];
  }, [performance.data]);

  const markers: AnomalyMarker[] = useMemo(() => {
    return (anomalies.data?.items ?? []).map(toMarker);
  }, [anomalies.data]);

  const isLoading = performance.isLoading || anomalies.isLoading;
  const hasError = performance.error || anomalies.error;

  return (
    <>
      <section className="rounded-xl border border-ctp-surface0/60 bg-ctp-base/60 p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ctp-text">ROAS over time</h2>
            <p className="text-xs text-ctp-subtext0">
              Last {days} days · collapses (z &lt; -3) overlaid in red
            </p>
          </div>
          <ExpandButton onClick={() => setIsExpanded(true)} label="Expand ROAS chart" />
        </header>

        {hasError ? (
          <div className="rounded-md border border-ctp-red/30 bg-ctp-red/5 p-4 text-xs text-ctp-red">
            Failed to load ROAS data.
          </div>
        ) : (
          <LineChart
            series={series}
            anomalies={markers}
            formatY={formatMultiplier}
            formatTooltipValue={formatMultiplier}
            isLoading={isLoading}
            emptyMessage="No ROAS data for this period (no spend logged)."
          />
        )}
      </section>

      {isExpanded ? (
        <ExpandedPanel
          title="ROAS over time"
          subtitle={`Last ${days} days · ${markers.length} collapse${markers.length === 1 ? "" : "s"} flagged`}
          onClose={() => setIsExpanded(false)}
        >
          <StatsRow data={series[0].data} format={formatMultiplier} />
          <LineChart
            series={series}
            anomalies={markers}
            formatY={formatMultiplier}
            formatTooltipValue={formatMultiplier}
            height={480}
            yTickCount={10}
            isLoading={isLoading}
            emptyMessage="No ROAS data for this period (no spend logged)."
          />
        </ExpandedPanel>
      ) : null}
    </>
  );
}

// =============================================================================
// shapers
// =============================================================================

// Roll daily client-rows up to one ROAS-per-day. ROAS = revenue / spend; null
// on zero-spend days (matches the mart's NULLIF) — surfaces as a gap in the
// line via LineChart's `.defined()` rule.
function aggregateRoasByDay(rows: PerformanceRow[]): LineChartDatum[] {
  const byDate = new Map<string, { spend: number; revenue: number }>();
  for (const r of rows) {
    const spend = Number(r.total_spend) || 0;
    const revenue = Number(r.total_revenue) || 0;
    const entry = byDate.get(r.activity_date) ?? { spend: 0, revenue: 0 };
    entry.spend += spend;
    entry.revenue += revenue;
    byDate.set(r.activity_date, entry);
  }

  const out: LineChartDatum[] = [];
  for (const [date, agg] of byDate) {
    out.push({
      date: new Date(`${date}T00:00:00Z`),
      value: agg.spend > 0 ? agg.revenue / agg.spend : null,
    });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

function toMarker(row: AnomalyRow): AnomalyMarker {
  const roas = row.roas !== null ? Number(row.roas) : 0;
  const z = row.roas_zscore !== null ? Number(row.roas_zscore) : null;
  const zLabel = z !== null ? ` (z=${z >= 0 ? "+" : ""}${z.toFixed(1)})` : "";
  return {
    date: new Date(`${row.activity_date}T00:00:00Z`),
    value: roas,
    label: `roas_collapse${zLabel}`,
  };
}
