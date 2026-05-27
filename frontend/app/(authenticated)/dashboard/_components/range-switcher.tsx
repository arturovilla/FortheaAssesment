"use client";

// Time range picker — TUI bracket tabs. Active option gets the `> 30d <`
// cursor pattern + mauve text, same affordance as the topbar ViewToggle.

import { RANGE_KEYS, type RangeKey } from "@/lib/range";
import { useRange } from "@/lib/use-range";

export function RangeSwitcher() {
  const { range, setRange } = useRange();

  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex items-center gap-3"
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
      className={`group inline-flex items-center gap-1 px-1 text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:underline ${
        isActive
          ? "text-ctp-mauve"
          : "text-ctp-subtext1 hover:text-ctp-text"
      }`}
    >
      <span
        aria-hidden
        className={`text-ctp-mauve ${isActive ? "opacity-100" : "opacity-0"}`}
      >
        {">"}
      </span>
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">[</span>
      <span className="tabular-nums">{rangeKey}</span>
      <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">]</span>
      <span
        aria-hidden
        className={`text-ctp-mauve ${isActive ? "opacity-100" : "opacity-0"}`}
      >
        {"<"}
      </span>
    </button>
  );
}
