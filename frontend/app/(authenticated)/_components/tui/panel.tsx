// TuiPanel — the dashed-border card used everywhere on the restyled dashboard.
//
// Mimics the reference image's `╭── SETTINGS ──╮` panel chrome with three
// pieces:
//   1. A 1px dashed border (Tailwind border-dashed) around the body.
//   2. A title chip absolute-positioned over the top border, with the page
//      background painted behind the text to "cut" the border line.
//   3. An optional actions slot (expand button, status text) painted the
//      same way on the right side of the top border.
//
// The chip background colour assumes the panel sits on a `bg-ctp-crust`
// surface (the authenticated layout's body). Nesting a TuiPanel inside
// another panel will leave a visible seam — fine; we don't nest today.

import type { ReactNode } from "react";

export type TuiPanelTone = "default" | "active" | "warn" | "crit";

interface TuiPanelProps {
  title?: string;
  subtitle?: string;
  tone?: TuiPanelTone;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONE_BORDER: Record<TuiPanelTone, string> = {
  default: "border-ctp-overlay0/60",
  active: "border-ctp-mauve",
  warn: "border-ctp-yellow",
  crit: "border-ctp-red",
};

const TONE_TITLE: Record<TuiPanelTone, string> = {
  default: "text-ctp-teal",
  active: "text-ctp-mauve",
  warn: "text-ctp-yellow",
  crit: "text-ctp-red",
};

export function TuiPanel({
  title,
  subtitle,
  tone = "default",
  actions,
  children,
  className = "",
}: TuiPanelProps) {
  return (
    <section
      className={`relative border border-dashed bg-ctp-base/30 px-5 pt-5 pb-5 ${TONE_BORDER[tone]} ${className}`}
    >
      {title ? (
        <span
          className={`absolute -top-[0.6rem] left-4 bg-ctp-crust px-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${TONE_TITLE[tone]}`}
        >
          ── {title} ──
        </span>
      ) : null}
      {actions ? (
        <div className="absolute -top-[0.6rem] right-4 bg-ctp-crust px-2 text-xs">
          {actions}
        </div>
      ) : null}
      {subtitle ? (
        <p className="mb-3 text-xs text-ctp-subtext0">{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}
