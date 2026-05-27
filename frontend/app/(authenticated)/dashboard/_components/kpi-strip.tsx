"use client";

// The orchestrator card row at the top of the dashboard.
//
// Owns three queries:
//   1. /performance for the current window   → marketing KPIs (now)
//   2. /performance for the prior window     → Δ vs prior
//   3. /macro for unemployment + fed_funds   → macro KPIs (+ Δ over the window)
//
// All three are tenant-aware (well, macro is tenant-independent but still
// gated on Clerk being ready) and refetch automatically when the user
// switches range — useRange flips the URL param, the query keys include the
// new window, TanStack picks it up.
//
// Layout: marketing KPIs left, a thin vertical divider, macro KPIs right.
// On narrow viewports the row wraps; the divider's `self-stretch` keeps it
// visually grouped with the macro cards.

import { useMacro, usePerformance } from "@/lib/queries";
import { useRange } from "@/lib/use-range";
import {
  computeMarketingKpis,
  formatCount,
  formatCpa,
  formatCurrency,
  formatDelta,
  formatMultiplier,
  formatPercent,
  formatSignedFixed,
  latestAndDelta,
} from "@/lib/format";

import { KpiCard } from "./kpi-card";

// FRED requests need a window — pull a year of history so we always have
// enough monthly observations (unemployment cadence) to compute the delta,
// regardless of which marketing window the user picked.
const MACRO_LOOKBACK_DAYS = 365;

export function KpiStrip() {
  const { days, window } = useRange();

  const current = usePerformance({
    start_date: window.start,
    end_date: window.end,
    limit: 500,
  });
  const prior = usePerformance({
    start_date: window.priorStart,
    end_date: window.priorEnd,
    limit: 500,
  });

  // Stretch start back a full year so the macro hook always has enough
  // monthly observations (UNRATE) to compute a delta vs `days` ago.
  const macroStart = subtractDays(window.end, MACRO_LOOKBACK_DAYS);
  const macro = useMacro({
    series: ["unemployment", "fed_funds"],
    start_date: macroStart,
    end_date: window.end,
  });

  const currentKpis = current.data
    ? computeMarketingKpis(current.data.items)
    : null;
  const priorKpis = prior.data ? computeMarketingKpis(prior.data.items) : null;

  const isMarketingLoading = current.isLoading || prior.isLoading;
  const marketingError = current.error || prior.error;

  const unemployment = pickSeries(macro.data?.items, "unemployment", days);
  const fedFunds = pickSeries(macro.data?.items, "fed_funds", days);

  return (
    <section aria-label="Key performance indicators" className="flex flex-wrap items-stretch gap-3">
      {/* Marketing KPIs */}
      <KpiCard
        label="Spend"
        value={currentKpis ? formatCurrency(currentKpis.spend) : ""}
        delta={
          currentKpis && priorKpis
            ? formatDelta(currentKpis.spend, priorKpis.spend, "neutral")
            : null
        }
        isLoading={isMarketingLoading}
        error={!!marketingError}
        tooltip="Sum of daily ad spend across all clients in the window — Google Ads and Meta combined, from the performance mart."
      />
      <KpiCard
        label="Conv"
        value={currentKpis ? formatCount(currentKpis.conversions) : ""}
        delta={
          currentKpis && priorKpis
            ? formatDelta(currentKpis.conversions, priorKpis.conversions, "higher_is_better")
            : null
        }
        isLoading={isMarketingLoading}
        error={!!marketingError}
        tooltip="Total conversions in the window — Google Ads conversions plus Meta results whose result type is a conversion goal."
      />
      <KpiCard
        label="Revenue"
        value={currentKpis ? formatCurrency(currentKpis.revenue) : ""}
        delta={
          currentKpis && priorKpis
            ? formatDelta(currentKpis.revenue, priorKpis.revenue, "higher_is_better")
            : null
        }
        isLoading={isMarketingLoading}
        error={!!marketingError}
        tooltip="Modelled as conversions × expected revenue per acquisition (the per-client value from the client table). The brief gives no other revenue input."
      />
      <KpiCard
        label="CPA"
        value={currentKpis ? formatCpa(currentKpis.cpa) : ""}
        delta={
          currentKpis && priorKpis
            ? formatDelta(currentKpis.cpa, priorKpis.cpa, "lower_is_better")
            : null
        }
        isLoading={isMarketingLoading}
        error={!!marketingError}
        tooltip="Blended cost per acquisition: total spend ÷ total conversions for the window. Lower is better — Δ is coloured accordingly."
      />
      <KpiCard
        label="ROAS"
        value={currentKpis ? formatMultiplier(currentKpis.roas) : ""}
        delta={
          currentKpis && priorKpis
            ? formatDelta(currentKpis.roas, priorKpis.roas, "higher_is_better")
            : null
        }
        isLoading={isMarketingLoading}
        error={!!marketingError}
        tooltip="Return on ad spend: total revenue ÷ total spend for the window. 1.00x = breakeven on the modeled revenue input."
      />

      {/* Divider between performance and macro context */}
      <div
        aria-hidden
        className="mx-1 w-px self-stretch bg-ctp-surface0/60"
      />

      {/* Macro KPIs */}
      <KpiCard
        label="Unemp"
        value={
          unemployment
            ? formatPercent(unemployment.latest)
            : ""
        }
        delta={
          unemployment && unemployment.delta !== null
            ? {
                arrow: unemployment.delta > 0 ? "up" : unemployment.delta < 0 ? "down" : "flat",
                color: "neutral",
                label: `${formatSignedFixed(unemployment.delta, 1)} pp`,
              }
            : null
        }
        hint={unemployment ? `as of ${unemployment.latestDate}` : undefined}
        isLoading={macro.isLoading}
        error={!!macro.error}
        tooltip="US unemployment rate from FRED (series UNRATE, monthly). Latest observation in the window; Δ is in percentage points vs roughly N days earlier."
        tooltipAlign="end"
      />
      <KpiCard
        label="Fed"
        value={fedFunds ? formatPercent(fedFunds.latest, 2) : ""}
        delta={
          fedFunds && fedFunds.delta !== null
            ? {
                arrow: fedFunds.delta > 0 ? "up" : fedFunds.delta < 0 ? "down" : "flat",
                color: "neutral",
                label: `${formatSignedFixed(fedFunds.delta * 100, 0)} bp`,
              }
            : null
        }
        hint={fedFunds ? `as of ${fedFunds.latestDate}` : undefined}
        isLoading={macro.isLoading}
        error={!!macro.error}
        tooltip="US federal funds effective rate from FRED (series DFF, daily). Latest observation in the window; Δ is in basis points (100 bp = 1%) vs roughly N days earlier."
        tooltipAlign="end"
      />
    </section>
  );
}

// =============================================================================
// helpers
// =============================================================================

function pickSeries(
  items: { key: string; observations: { date: string; value: string | null }[] }[] | undefined,
  key: string,
  windowDays: number,
) {
  const series = items?.find((s) => s.key === key);
  if (!series) return null;
  return latestAndDelta(series.observations, windowDays);
}

function subtractDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
