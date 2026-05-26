"use client";

// Anomalies side panel — companion to MacroChart in the lower row.
//
// Shows the most recent flagged client-days for the active window. Each row
// can trip multiple flags (the mart's view is "at least one flag true"), so
// each card lists every triggered flag as a pill, then surfaces the headline
// metric for whichever flag fired most-recently.
//
// No click target yet — slice 6 wires these to the performance table once
// it exists; for now the cards are informational.

import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";

import type { AnomalyRow } from "@/lib/api";
import { useAnomalies } from "@/lib/queries";
import { useRange } from "@/lib/use-range";

import { ExpandButton, ExpandedPanel } from "./expanded-panel";

const MAX_VISIBLE = 5;

// Display order matters: when a row has multiple flags, the FIRST one listed
// here drives the "headline" metric shown in the card. Picked so the most
// actionable signal wins (zero conversions = clearly broken > spike > collapse > volume).
const FLAG_DISPLAY_ORDER = [
  "zero_conversions",
  "cpa_spike",
  "roas_collapse",
  "spend_spike",
] as const;

const FLAG_LABELS: Record<string, string> = {
  zero_conversions: "Zero conversions",
  cpa_spike: "CPA spike",
  roas_collapse: "ROAS collapse",
  spend_spike: "Spend spike",
};

export function AnomaliesPanel() {
  const { window: w, days } = useRange();
  const [isExpanded, setIsExpanded] = useState(false);

  const anomalies = useAnomalies({
    start_date: w.start,
    end_date: w.end,
    // 500 = backend max. The performance table also calls useAnomalies with
    // these exact args to join flag pills onto its rows; matching the args
    // means both consumers hit the same TanStack cache entry, not two
    // separate network calls.
    limit: 500,
  });

  const all = anomalies.data?.items ?? [];
  const visible = all.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, all.length - visible.length);

  return (
    <>
      <section className="rounded-xl border border-ctp-surface0/60 bg-ctp-base/60 p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ctp-text">
              Anomalies
              {all.length > 0 ? (
                <span className="ml-2 font-normal text-ctp-subtext0">
                  ({all.length} flagged)
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-ctp-subtext0">
              Most recent in the last {days} days
            </p>
          </div>
          {all.length > 0 ? (
            <ExpandButton
              onClick={() => setIsExpanded(true)}
              label="Expand anomalies view"
            />
          ) : null}
        </header>

        {anomalies.error ? (
          <div className="rounded-md border border-ctp-red/30 bg-ctp-red/5 p-4 text-xs text-ctp-red">
            Failed to load anomalies.
          </div>
        ) : anomalies.isLoading ? (
          <LoadingList />
        ) : visible.length === 0 ? (
          <EmptyState days={days} />
        ) : (
          <ul className="space-y-2">
            {visible.map((row) => (
              <li key={`${row.client_id}-${row.activity_date}`}>
                <AnomalyItem row={row} />
              </li>
            ))}
            {overflow > 0 ? (
              <li className="pt-1 text-center text-xs text-ctp-subtext0">
                +{overflow} more — open expanded view to see them all
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {isExpanded ? (
        <ExpandedPanel
          title="All anomalies"
          subtitle={`${all.length} flagged client-day${all.length === 1 ? "" : "s"} in the last ${days} days`}
          onClose={() => setIsExpanded(false)}
        >
          <FlagSummary rows={all} />
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {all.map((row) => (
              <li key={`${row.client_id}-${row.activity_date}`}>
                <ExpandedAnomalyCard row={row} />
              </li>
            ))}
          </ul>
        </ExpandedPanel>
      ) : null}
    </>
  );
}

// =============================================================================
// Expanded view: summary chips + per-anomaly card with every metric exposed
// =============================================================================

function FlagSummary({ rows }: { rows: AnomalyRow[] }) {
  const counts: Record<string, number> = {};
  for (const flag of FLAG_DISPLAY_ORDER) counts[flag] = 0;
  for (const row of rows) {
    for (const flag of FLAG_DISPLAY_ORDER) {
      if (isFlagSet(row, flag)) counts[flag] += 1;
    }
  }
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {FLAG_DISPLAY_ORDER.map((flag) => (
        <div
          key={flag}
          className="rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
            {FLAG_LABELS[flag] ?? flag}
          </div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-ctp-text">
            {counts[flag]}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpandedAnomalyCard({ row }: { row: AnomalyRow }) {
  const triggered = FLAG_DISPLAY_ORDER.filter((flag) => isFlagSet(row, flag));
  const spend = Number(row.total_spend);
  const conv = Number(row.total_conversions);
  const cpa = row.cpa !== null ? Number(row.cpa) : null;
  const roas = row.roas !== null ? Number(row.roas) : null;
  const cpaZ = row.cpa_zscore !== null ? Number(row.cpa_zscore) : null;
  const roasZ = row.roas_zscore !== null ? Number(row.roas_zscore) : null;

  return (
    <article className="h-full rounded-lg border border-ctp-surface0/60 bg-ctp-mantle/60 p-4">
      <header className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-ctp-red" />
          <span className="font-medium text-ctp-text">
            {formatShortDate(row.activity_date)}
          </span>
        </div>
        <span className="text-ctp-subtext0">{row.client_name}</span>
      </header>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {triggered.map((flag) => (
          <FlagPill key={flag} flag={flag} />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs tabular-nums">
        <Metric label="Spend" value={`$${spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Metric label="Conversions" value={String(Math.round(conv))} />
        <Metric label="CPA" value={cpa === null ? "—" : `$${cpa.toFixed(2)}`} />
        <Metric label="ROAS" value={roas === null ? "—" : `${roas.toFixed(2)}x`} />
        <Metric
          label="CPA z-score"
          value={cpaZ === null ? "—" : formatSignedFixed(cpaZ, 2)}
        />
        <Metric
          label="ROAS z-score"
          value={roasZ === null ? "—" : formatSignedFixed(roasZ, 2)}
        />
      </dl>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
        {label}
      </dt>
      <dd className="text-ctp-text">{value}</dd>
    </div>
  );
}

// =============================================================================
// Anomaly item
// =============================================================================

function AnomalyItem({ row }: { row: AnomalyRow }) {
  const triggered = FLAG_DISPLAY_ORDER.filter((flag) => isFlagSet(row, flag));
  const headline = headlineFor(row, triggered[0]);

  return (
    <article className="rounded-lg border border-ctp-surface0/60 bg-ctp-mantle/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-ctp-red" />
          <span className="font-medium text-ctp-text">
            {formatShortDate(row.activity_date)}
          </span>
          <span className="text-ctp-subtext0">·</span>
          <span className="text-ctp-subtext0">{row.client_name}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {triggered.map((flag) => (
          <FlagPill key={flag} flag={flag} />
        ))}
      </div>

      {headline ? (
        <div className="mt-2 text-xs tabular-nums text-ctp-subtext1">
          {headline}
        </div>
      ) : null}
    </article>
  );
}

function FlagPill({ flag }: { flag: string }) {
  return (
    <span className="rounded-md border border-ctp-red/30 bg-ctp-red/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ctp-red">
      {FLAG_LABELS[flag] ?? flag}
    </span>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function isFlagSet(row: AnomalyRow, flag: (typeof FLAG_DISPLAY_ORDER)[number]): boolean {
  switch (flag) {
    case "zero_conversions":
      return row.is_zero_conversions_with_spend;
    case "cpa_spike":
      return row.is_cpa_spike;
    case "roas_collapse":
      return row.is_roas_collapse;
    case "spend_spike":
      return row.is_spend_spike;
  }
}

// Returns the single most informative line for the row, picked off the
// primary triggered flag. Falls back to spend if nothing else is meaningful.
function headlineFor(
  row: AnomalyRow,
  primaryFlag: (typeof FLAG_DISPLAY_ORDER)[number] | undefined,
): string | null {
  const spend = Number(row.total_spend);
  switch (primaryFlag) {
    case "zero_conversions":
      return `Spent $${spend.toFixed(0)}, 0 conversions`;
    case "cpa_spike": {
      const cpa = row.cpa !== null ? Number(row.cpa) : null;
      const z = row.cpa_zscore !== null ? Number(row.cpa_zscore) : null;
      return cpa !== null
        ? `CPA $${cpa.toFixed(2)}${z !== null ? ` (z=${formatSignedFixed(z, 1)})` : ""}`
        : null;
    }
    case "roas_collapse": {
      const roas = row.roas !== null ? Number(row.roas) : null;
      const z = row.roas_zscore !== null ? Number(row.roas_zscore) : null;
      return roas !== null
        ? `ROAS ${roas.toFixed(2)}x${z !== null ? ` (z=${formatSignedFixed(z, 1)})` : ""}`
        : null;
    }
    case "spend_spike":
      return `Spend $${spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    default:
      return null;
  }
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatSignedFixed(n: number, decimals: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(decimals)}`;
}

// =============================================================================
// Empty / loading
// =============================================================================

function LoadingList() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-20 animate-pulse rounded-lg border border-ctp-surface0/40 bg-ctp-surface0/20"
        />
      ))}
    </ul>
  );
}

function EmptyState({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-ctp-green/30 bg-ctp-green/5 p-4 text-xs text-ctp-green">
      <Check className="h-4 w-4" />
      <span>No anomalies in the last {days} days.</span>
    </div>
  );
}
