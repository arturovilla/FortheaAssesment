"use client";

// Segmented control in the shared topbar: switches between the Dashboard
// view (charts + KPIs) and the System Design view (in-app docs). Stays
// visible on both routes so it works as a back-and-forth.
//
// Same visual language as RangeSwitcher (rounded outer container + per-
// option button that fills when active) so the topbar reads as one
// consistent system rather than two unrelated controls.

import { BarChart3, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ViewOption {
  key: "dashboard" | "system-design";
  label: string;
  href: string;
  Icon: typeof BarChart3;
  // Routes whose pathname starts with this prefix count as "in" this view.
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
    label: "System design",
    href: "/system-design",
    Icon: FileText,
    pathPrefix: "/system-design",
  },
];

export function ViewToggle() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="View"
      className="inline-flex items-center gap-0.5 rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 p-1"
    >
      {OPTIONS.map((opt) => {
        const isActive = pathname.startsWith(opt.pathPrefix);
        return (
          <Link
            key={opt.key}
            href={opt.href}
            role="tab"
            aria-selected={isActive}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40 ${
              isActive
                ? "bg-ctp-surface0/80 text-ctp-text"
                : "text-ctp-subtext0 hover:bg-ctp-surface0/40 hover:text-ctp-text"
            }`}
          >
            <opt.Icon className="h-3.5 w-3.5" />
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
