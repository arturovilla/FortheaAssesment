"use client";

// Segmented control for the dashboard time range (7d / 30d / 90d).
// Reads + writes the ?range URL param via useRange — every consumer
// (KPI strip, charts, table) gates its queries on the same value.

import { RANGE_KEYS, type RangeKey } from "@/lib/range";
import { useRange } from "@/lib/use-range";

export function RangeSwitcher() {
  const { range, setRange } = useRange();

  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex items-center gap-0.5 rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 p-1"
    >
      {RANGE_KEYS.map((key) => (
        <RangeButton
          key={key}
          rangeKey={key}
          isActive={key === range}
          onSelect={setRange}
        />
      ))}
    </div>
  );
}

function RangeButton({
  rangeKey,
  isActive,
  onSelect,
}: {
  rangeKey: RangeKey;
  isActive: boolean;
  onSelect: (next: RangeKey) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(rangeKey)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40 ${
        isActive
          ? "bg-ctp-surface0/80 text-ctp-text"
          : "text-ctp-subtext0 hover:bg-ctp-surface0/40 hover:text-ctp-text"
      }`}
    >
      {rangeKey}
    </button>
  );
}
