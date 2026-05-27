// Single KPI card — TUI restyle.
//
//   ┌── SPEND ─────────────────────┐
//   │ $559.8k                      │
//   │ ▲ +12.4%                     │
//   └──────────────────────────────┘
//
// Label sits in the panel cap (TuiPanel handles that). Value is large
// monospace tabular-nums. Delta row uses text glyphs (▲ ▼ —) instead of
// lucide icons so it composes with the surrounding monospace grid.
//
// Tooltip stays — the ⓘ moves into the panel cap actions slot so it sits
// inline with the title chip.

import type { DeltaInfo } from "@/lib/format";

import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";

type TooltipAlign = "start" | "end";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: DeltaInfo | null;
  isLoading?: boolean;
  error?: boolean;
  hint?: string;
  tooltip?: string;
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
      <TuiPanel
        title={label}
        tone="crit"
        className="min-w-[8rem] flex-1"
        actions={tooltip ? <InfoTooltip text={tooltip} tone="red" align={tooltipAlign} /> : undefined}
      >
        <div className="text-xs text-ctp-red">failed to load</div>
      </TuiPanel>
    );
  }

  return (
    <TuiPanel
      title={label}
      className="min-w-[8rem] flex-1"
      actions={tooltip ? <InfoTooltip text={tooltip} align={tooltipAlign} /> : undefined}
    >
      {isLoading ? (
        <div className="h-7 w-3/4 animate-pulse bg-ctp-surface0/60" />
      ) : (
        <div className="text-2xl font-semibold tabular-nums text-ctp-text">
          {value}
        </div>
      )}

      {!isLoading && delta ? <DeltaRow delta={delta} /> : null}
      {!isLoading && hint ? (
        <div className="mt-1 text-xs text-ctp-subtext0">{hint}</div>
      ) : null}
    </TuiPanel>
  );
}

// CSS-only popover preserved from the original implementation. The icon is
// rendered as a literal `ⓘ` glyph instead of a lucide SVG so it composes
// with the surrounding mono grid and survives if lucide ever fails to load.
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
        className={`inline-flex cursor-help items-center text-xs leading-none focus-visible:outline-none ${iconColor}`}
      >
        ⓘ
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-30 mt-1.5 w-60 break-words border border-dashed border-ctp-overlay0/70 bg-ctp-mantle p-2.5 text-xs leading-snug text-ctp-subtext1 opacity-0 shadow-xl shadow-black/40 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${anchor}`}
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

  const arrow = delta.arrow === "up" ? "▲" : delta.arrow === "down" ? "▼" : "—";

  return (
    <div className={`mt-1 flex items-center gap-1.5 text-xs tabular-nums ${colorClass}`}>
      <span aria-hidden>{arrow}</span>
      <span>{delta.label}</span>
    </div>
  );
}
