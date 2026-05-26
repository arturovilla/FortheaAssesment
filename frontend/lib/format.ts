// Display formatters + numeric aggregators for the KPI strip.
//
// Two responsibilities:
//   1. Parse backend Decimal-as-string values into numbers (`parseDecimal`),
//      and aggregate /performance rows into the five marketing KPIs.
//   2. Format numbers for display ($12.4k, 3.91x, +5.2%) and compute the
//      direction-aware delta that KpiCard renders as ▲/▼ + good/bad color.
//
// "Direction-aware" means: for CPA, a *lower* current vs prior is *good* (so
// the arrow is ▼ but the color is green). The caller declares the metric's
// direction; this module does the math.

import type { Observation, PerformanceRow } from "./api";

// =============================================================================
// Decimal parsing
// =============================================================================

export function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// =============================================================================
// Marketing KPI aggregation
// =============================================================================

export interface MarketingKpis {
  spend: number;
  conversions: number;
  revenue: number;
  cpa: number | null;   // null when conversions = 0 (matches the mart's NULLIF)
  roas: number | null;  // null when spend = 0
}

export function computeMarketingKpis(rows: PerformanceRow[]): MarketingKpis {
  let spend = 0;
  let conversions = 0;
  let revenue = 0;
  for (const r of rows) {
    spend += parseDecimal(r.total_spend) ?? 0;
    conversions += parseDecimal(r.total_conversions) ?? 0;
    revenue += parseDecimal(r.total_revenue) ?? 0;
  }
  return {
    spend,
    conversions,
    revenue,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: spend > 0 ? revenue / spend : null,
  };
}

// =============================================================================
// Macro: latest observation + delta vs prior point
// =============================================================================

export interface MacroSnapshot {
  latest: number;
  latestDate: string;
  delta: number | null;       // absolute change (latest - prior); units depend on series
  deltaPriorDate: string | null;
}

// Picks the latest non-null observation and a comparison observation closest
// to (latest_date - windowDays). Falls back gracefully when the series cadence
// is coarser than the window (e.g. monthly unemployment with a 7-day window).
export function latestAndDelta(
  observations: Observation[],
  windowDays: number,
): MacroSnapshot | null {
  const nonNull: { date: string; value: number }[] = [];
  for (const o of observations) {
    const v = parseDecimal(o.value);
    if (v !== null) nonNull.push({ date: o.date, value: v });
  }
  if (nonNull.length === 0) return null;

  // Observations from FRED come date-ascending, but don't assume — sort to be safe.
  nonNull.sort((a, b) => a.date.localeCompare(b.date));

  const latest = nonNull[nonNull.length - 1];
  const latestMs = Date.parse(latest.date);
  const targetMs = latestMs - windowDays * 86_400_000;

  // Search prior observations (strictly before `latest`) for the one closest
  // to the target date.
  let prior: { date: string; value: number } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obs of nonNull) {
    if (obs.date >= latest.date) break;
    const dist = Math.abs(Date.parse(obs.date) - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      prior = obs;
    }
  }

  return {
    latest: latest.value,
    latestDate: latest.date,
    delta: prior ? latest.value - prior.value : null,
    deltaPriorDate: prior?.date ?? null,
  };
}

// =============================================================================
// Display formatters
// =============================================================================

export function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
  return `$${n.toFixed(0)}`;
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatMultiplier(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(2)}x`;
}

export function formatCpa(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toFixed(2)}`;
}

export function formatPercent(n: number | null, decimals = 1): string {
  if (n === null) return "—";
  return `${n.toFixed(decimals)}%`;
}

// Fixed-point absolute delta (used for macro series like "+0.2pp", "+25bp").
// Caller picks the unit label; this only formats the magnitude with a sign.
export function formatSignedFixed(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(decimals)}`;
}

// =============================================================================
// Direction-aware Δ (percent change vs prior period)
// =============================================================================

export type DeltaDirection = "higher_is_better" | "lower_is_better" | "neutral";

export interface DeltaInfo {
  arrow: "up" | "down" | "flat";
  // good/bad/neutral controls colour in KpiCard. "neutral" is the
  // direction-less case (spend went up — fine or bad, depends on context).
  color: "good" | "bad" | "neutral";
  label: string;  // "+5.2%", "−1.8%", "flat"
}

// Returns null when there's nothing meaningful to compare (missing data, or
// prior=0 which makes percent-change undefined). The card then hides the row.
export function formatDelta(
  current: number | null,
  prior: number | null,
  direction: DeltaDirection,
): DeltaInfo | null {
  if (current === null || prior === null) return null;
  if (prior === 0) {
    // Going from 0 to anything is "new", not a percent change. Mark as flat
    // to keep the UI predictable; reviewers can read the absolute value above.
    return current === 0
      ? { arrow: "flat", color: "neutral", label: "flat" }
      : null;
  }

  const pctChange = ((current - prior) / Math.abs(prior)) * 100;

  // Treat sub-0.5% movement as flat so tiny noise doesn't paint the card.
  if (Math.abs(pctChange) < 0.5) {
    return { arrow: "flat", color: "neutral", label: "flat" };
  }

  const isIncrease = pctChange > 0;
  const arrow: "up" | "down" = isIncrease ? "up" : "down";
  let color: "good" | "bad" | "neutral" = "neutral";
  if (direction === "higher_is_better") color = isIncrease ? "good" : "bad";
  if (direction === "lower_is_better") color = isIncrease ? "bad" : "good";

  return {
    arrow,
    color,
    label: `${isIncrease ? "+" : "−"}${Math.abs(pctChange).toFixed(1)}%`,
  };
}
