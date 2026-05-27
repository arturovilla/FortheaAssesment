"use client";

// View toggle in the topbar — bracket-tab strip matching the reference TUI's
// bottom-nav pattern (`[ Home ]  [ Climate ]  [ Media ]`). Active tab is
// rendered with a `>` cursor prefix and mauve text, same affordance the
// reference uses for `> Driver Assistance` in the settings menu.

import { BarChart3, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ViewOption {
  key: "dashboard" | "system-design";
  label: string;
  href: string;
  Icon: typeof BarChart3;
  pathPrefix: string;
}

const OPTIONS: ViewOption[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    Icon: BarChart3,
    pathPrefix: "/dashboard",
  },
  {
    key: "system-design",
    label: "System Design",
    href: "/system-design",
    Icon: FileText,
    pathPrefix: "/system-design",
  },
];

export function ViewToggle() {
  const pathname = usePathname();

  return (
    <nav role="tablist" aria-label="View" className="inline-flex items-center gap-3">
      {OPTIONS.map((opt) => {
        const isActive = pathname.startsWith(opt.pathPrefix);
        return (
          <Link
            key={opt.key}
            href={opt.href}
            role="tab"
            aria-selected={isActive}
            className={`group inline-flex items-center gap-1.5 px-1 text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:underline ${
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
            <opt.Icon className="h-3.5 w-3.5" />
            <span>{opt.label}</span>
            <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">]</span>
          </Link>
        );
      })}
    </nav>
  );
}
