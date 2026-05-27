// TuiStatusPill — bracketed inline status text, e.g. [ON], [CPA SPIKE].
//
// Matches the reference image's `[ON]` / `[OFF]` row decorations and the
// anomaly flags in the panel. Deliberately plain text + Tailwind colour;
// no background fill, no border. The brackets are the affordance.

import type { ReactNode } from "react";

export type TuiStatusKind = "ok" | "warn" | "crit" | "neutral" | "info";

interface TuiStatusPillProps {
  kind?: TuiStatusKind;
  children: ReactNode;
  className?: string;
}

const KIND_COLOR: Record<TuiStatusKind, string> = {
  ok: "text-ctp-green",
  warn: "text-ctp-yellow",
  crit: "text-ctp-red",
  neutral: "text-ctp-subtext0",
  info: "text-ctp-teal",
};

export function TuiStatusPill({
  kind = "neutral",
  children,
  className = "",
}: TuiStatusPillProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium uppercase tracking-[0.12em] ${KIND_COLOR[kind]} ${className}`}
    >
      [{children}]
    </span>
  );
}
