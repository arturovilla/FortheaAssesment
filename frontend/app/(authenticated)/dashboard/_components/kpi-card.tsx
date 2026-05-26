// Single KPI card — label on top, value in the middle, optional delta row at
// the bottom. The card is purely presentational; the orchestrator (KpiStrip)
// owns data fetching and decides what's good/bad per metric.
//
// States:
//   - loading: pulsing bar in place of the value, no delta row.
//   - error:   red-bordered card with a short message.
//   - data:    formatted value + (optional) delta arrow & label.
//
// Optional `tooltip` prop renders a small ⓘ icon next to the label that
// reveals a popover on hover or keyboard focus, explaining how the metric
// is derived. CSS-only (group-hover + group-focus-within) so no JS state
// is needed.

import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";

import type { DeltaInfo } from "@/lib/format";

type TooltipAlign = "start" | "end";

interface KpiCardProps {
  label: string;
  // Pre-formatted value string (formatter lives in lib/format.ts because the
  // orchestrator knows the unit). Card just renders the string.
  value: string;
  delta?: DeltaInfo | null;
  isLoading?: boolean;
  error?: boolean;
  // Optional secondary line shown under the value (e.g. "as of 2026-05-25").
  hint?: string;
  // Optional explanation shown on hover/focus of the ⓘ icon next to the
  // label. Keep to 1-2 sentences — anything longer should live in docs.
  tooltip?: string;
  // Which edge of the ⓘ icon the tooltip popover anchors to. "start" (the
  // default) extends right; "end" extends left — use it for cards near the
  // right edge of the viewport so the popover doesn't clip off-screen.
  tooltipAlign?: TooltipAlign;
}

export function KpiCard({
  label,
  value,
  delta,
  isLoading,
  error,
  hint,
  tooltip,
  tooltipAlign = "start",
}: KpiCardProps) {
  if (error) {
    return (
      <div className="min-w-[8rem] flex-1 rounded-xl border border-ctp-red/30 bg-ctp-red/5 p-4">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs uppercase tracking-wider text-ctp-red">
            {label}
          </span>
          {tooltip ? <InfoTooltip text={tooltip} tone="red" align={tooltipAlign} /> : null}
        </div>
        <div className="mt-1 text-xs text-ctp-red">failed to load</div>
      </div>
    );
  }

  return (
    <div className="min-w-[8rem] flex-1 rounded-xl border border-ctp-surface0/60 bg-ctp-base/60 p-4">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs uppercase tracking-wider text-ctp-subtext0">
          {label}
        </span>
        {tooltip ? <InfoTooltip text={tooltip} align={tooltipAlign} /> : null}
      </div>

      {isLoading ? (
        <div className="mt-2 h-7 w-3/4 animate-pulse rounded bg-ctp-surface0/60" />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums text-ctp-text">
          {value}
        </div>
      )}

      {!isLoading && delta ? <DeltaRow delta={delta} /> : null}
      {!isLoading && hint ? (
        <div className="mt-1 text-xs text-ctp-subtext0">{hint}</div>
      ) : null}
    </div>
  );
}

// CSS-only popover: the parent <span class="group"> drives visibility via
// group-hover / group-focus-within. `pointer-events-none` while hidden so
// stray hovers on the invisible box don't trigger it.
//
// `break-words` makes long unbreakable tokens (think SQL identifiers with
// underscores) wrap inside the popover instead of pushing past its right
// edge. `align` controls which side of the icon the popover anchors to —
// rightmost cards need `end` so the popover doesn't clip off-screen.
function InfoTooltip({
  text,
  tone = "default",
  align = "start",
}: {
  text: string;
  tone?: "default" | "red";
  align?: TooltipAlign;
}) {
  const iconColor =
    tone === "red"
      ? "text-ctp-red/70 hover:text-ctp-red focus-visible:text-ctp-red"
      : "text-ctp-subtext0 hover:text-ctp-text focus-visible:text-ctp-text";
  const anchor = align === "end" ? "right-0" : "left-0";

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="how this is derived"
        className={`inline-flex cursor-help items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40 ${iconColor}`}
      >
        <Info className="h-3 w-3" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-30 mt-1.5 w-60 break-words rounded-md border border-ctp-surface0/80 bg-ctp-mantle p-2.5 text-xs leading-snug text-ctp-subtext1 opacity-0 shadow-xl shadow-black/40 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${anchor}`}
      >
        {text}
      </span>
    </span>
  );
}

function DeltaRow({ delta }: { delta: DeltaInfo }) {
  const colorClass =
    delta.color === "good"
      ? "text-ctp-green"
      : delta.color === "bad"
        ? "text-ctp-red"
        : "text-ctp-subtext0";

  const Icon =
    delta.arrow === "up"
      ? ArrowUp
      : delta.arrow === "down"
        ? ArrowDown
        : Minus;

  return (
    <div className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span>{delta.label}</span>
    </div>
  );
}
