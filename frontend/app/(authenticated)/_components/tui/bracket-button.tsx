// TuiBracketButton — `[ ↑ Upload data ]` style buttons.
//
// The reference image uses bracketed labels for every actionable element
// (`[ Home ]`, `[C] Start Charging`, `[ M ] Play/Pause`). This component
// is the shared shell for that pattern. Active state mimics the highlight
// row from the image (mauve text, no background — the brackets carry it).

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface TuiBracketButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function TuiBracketButton({
  active = false,
  icon,
  children,
  className = "",
  ...rest
}: TuiBracketButtonProps) {
  const base =
    "inline-flex items-center gap-1.5 px-1 text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:underline disabled:opacity-40 disabled:pointer-events-none";
  const tone = active
    ? "text-ctp-mauve"
    : "text-ctp-subtext1 hover:text-ctp-text";
  return (
    <button type="button" className={`${base} ${tone} ${className}`} {...rest}>
      <span className="text-ctp-overlay0">[</span>
      {icon ? <span className="flex items-center">{icon}</span> : null}
      <span>{children}</span>
      <span className="text-ctp-overlay0">]</span>
    </button>
  );
}
