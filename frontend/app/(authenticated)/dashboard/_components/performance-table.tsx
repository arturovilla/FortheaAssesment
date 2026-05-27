"use client";

// Cursor-paginated performance table — the drill-down surface beneath the
// charts and panels. Each row is one client-day from
// `marts.mart_client_daily_performance`, with anomaly flag pills joined in
// client-side from the same /anomalies query the panel uses (cache reuse
// means no extra request).
//
// Pagination model: backend gives us `next_cursor` per page; Prev is local —
// we keep a stack of the cursors we've already paged through so going back
// is a pop, not another request beyond the normal page fetch.
//
// State-reset on tenant/range change uses the React-recommended "key prop
// to reset state" pattern: a thin wrapper computes a resetKey and the inner
// component re-mounts whenever the scope changes. No setState-in-effect.

import { useMemo, useState } from "react";

import type { AnomalyRow, PerformanceRow } from "@/lib/api";
import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";
import { TuiStatusPill } from "@/app/(authenticated)/_components/tui/status-pill";
import { useActiveTenant } from "@/lib/use-active-tenant";
import { useAnomalies, usePerformance } from "@/lib/queries";
import { useRange } from "@/lib/use-range";
import type { DateWindow } from "@/lib/range";

const PAGE_SIZE = 50;

// Flag display order matches the anomalies panel so a row's pills read the
// same in both places.
const FLAG_DISPLAY_ORDER = [
  "zero_conversions",
  "cpa_spike",
  "roas_collapse",
  "spend_spike",
] as const;

const FLAG_LABELS: Record<string, string> = {
  zero_conversions: "Zero conv",
  cpa_spike: "CPA spike",
  roas_collapse: "ROAS collapse",
  spend_spike: "Spend spike",
};

// =============================================================================
// Public wrapper — assembles the resetKey, no own state
// =============================================================================

export function PerformanceTable() {
  const { window: w, days } = useRange();
  const { active } = useActiveTenant();

  // Force a re-mount of the inner component (and thus a fresh cursor stack)
  // whenever the data scope changes. Without this, a cursor from the old
  // slice could 400 the backend or surface unrelated rows.
  const resetKey = `${active ?? "_"}|${w.start}|${w.end}`;

  return <PerformanceTableInner key={resetKey} window={w} days={days} />;
}

// =============================================================================
// Inner — owns pagination state, lives only for one (tenant, window) scope
// =============================================================================

function PerformanceTableInner({ window: w, days }: { window: DateWindow; days: number }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  const performance = usePerformance({
    start_date: w.start,
    end_date: w.end,
    cursor: cursor ?? undefined,
    limit: PAGE_SIZE,
  });

  // Same filter args as AnomaliesPanel → shared cache, single network round
  // trip for both consumers. The flag map keys on (client_id|date) for O(1)
  // lookup per performance row.
  const anomalies = useAnomalies({
    start_date: w.start,
    end_date: w.end,
    limit: 500,
  });

  const flagMap = useMemo(() => {
    const m = new Map<string, AnomalyRow>();
    for (const row of anomalies.data?.items ?? []) {
      m.set(`${row.client_id}|${row.activity_date}`, row);
    }
    return m;
  }, [anomalies.data]);

  const rows = performance.data?.items ?? [];
  const hasNext = performance.data?.has_more === true && !!performance.data?.next_cursor;
  const hasPrev = cursorStack.length > 0;
  const pageNumber = cursorStack.length + 1;

  function handleNext() {
    if (!hasNext) return;
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(performance.data!.next_cursor);
  }

  function handlePrev() {
    if (!hasPrev) return;
    const previousCursor = cursorStack[cursorStack.length - 1];
    setCursorStack((prev) => prev.slice(0, -1));
    setCursor(previousCursor);
  }

  return (
    <TuiPanel
      title="Performance"
      subtitle={`Daily client-level rows · last ${days} days · sorted newest first`}
    >
      {performance.error ? (
        <ErrorState />
      ) : performance.isLoading ? (
        <LoadingTable />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-dashed border-ctp-teal/40 text-left text-[10px] uppercase tracking-[0.12em] text-ctp-teal">
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th align="right">Spend</Th>
                  <Th align="right">Conv</Th>
                  <Th align="right">CPA</Th>
                  <Th align="right">ROAS</Th>
                  <Th>Flags</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Row
                    key={`${row.client_id}-${row.activity_date}`}
                    row={row}
                    anomaly={flagMap.get(`${row.client_id}|${row.activity_date}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            pageNumber={pageNumber}
            count={rows.length}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </>
      )}
    </TuiPanel>
  );
}

// =============================================================================
// Row
// =============================================================================

function Row({ row, anomaly }: { row: PerformanceRow; anomaly: AnomalyRow | undefined }) {
  const triggered = anomaly
    ? FLAG_DISPLAY_ORDER.filter((flag) => isFlagSet(anomaly, flag))
    : [];

  return (
    <tr className="group border-b border-dashed border-ctp-overlay0/15 transition-colors hover:bg-ctp-surface0/20">
      <Td className="text-xs text-ctp-subtext1">
        <span aria-hidden className="mr-1 text-ctp-mauve opacity-0 group-hover:opacity-100">
          {">"}
        </span>
        {row.activity_date}
      </Td>
      <Td>{row.client_name}</Td>
      <Td align="right" className="tabular-nums">{formatMoney(row.total_spend)}</Td>
      <Td align="right" className="tabular-nums">{formatInt(row.total_conversions)}</Td>
      <Td align="right" className="tabular-nums">{formatCpaCell(row.cpa)}</Td>
      <Td align="right" className="tabular-nums">{formatRoasCell(row.roas)}</Td>
      <Td>
        {triggered.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {triggered.map((flag) => (
              <TuiStatusPill key={flag} kind="crit">
                {FLAG_LABELS[flag] ?? flag}
              </TuiStatusPill>
            ))}
          </div>
        ) : (
          <span className="text-ctp-subtext0">—</span>
        )}
      </Td>
    </tr>
  );
}

// =============================================================================
// Pagination
// =============================================================================

function Pagination({
  pageNumber,
  count,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  pageNumber: number;
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <footer className="mt-4 flex items-center justify-between text-xs text-ctp-subtext0">
      <span className="tabular-nums">
        Page {pageNumber} · {count} {count === 1 ? "row" : "rows"}
      </span>
      <div className="flex items-center gap-3">
        <PageButton onClick={onPrev} disabled={!hasPrev} aria-label="Previous page">
          ◀ Prev
        </PageButton>
        <PageButton onClick={onNext} disabled={!hasNext} aria-label="Next page">
          Next ▶
        </PageButton>
      </div>
    </footer>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center px-1 text-xs text-ctp-subtext1 transition-colors hover:text-ctp-text focus-visible:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ctp-subtext1"
      {...rest}
    >
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">[</span>
      <span className="px-1.5">{children}</span>
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">]</span>
    </button>
  );
}

// =============================================================================
// Cell helpers
// =============================================================================

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = "",
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} text-ctp-text ${className}`}>
      {children}
    </td>
  );
}

function formatMoney(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatInt(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function formatCpaCell(s: string | null): string {
  if (s === null) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRoasCell(s: string | null): string {
  if (s === null) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}x`;
}

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

// =============================================================================
// States
// =============================================================================

function LoadingTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse border border-dashed border-ctp-surface0/40 bg-ctp-surface0/20"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-32 items-center justify-center border border-dashed border-ctp-overlay0/40 text-xs text-ctp-subtext0">
      No performance data for this period.
    </div>
  );
}

function ErrorState() {
  return (
    <div className="border border-dashed border-ctp-red/40 p-4 text-xs text-ctp-red">
      Failed to load performance data.
    </div>
  );
}
