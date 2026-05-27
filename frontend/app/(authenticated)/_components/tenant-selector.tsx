"use client";

// TenantSelector — TUI list-style picker for the topbar.
//
// Visual model lifted from the reference image's Settings menu:
//   - Trigger reads `TENANT: [ acme ▾ ]` in the bar, monospace.
//   - Dropdown is a vertical list, each row prefixed by `>` when it's the
//     active option (mauve accent), aligned in a monospace column.
//
// Tenant resolution (URL is source of truth, Clerk JWT is fallback) is
// unchanged — see lib/use-active-tenant.ts. Selecting writes ?tenant=<slug>
// to the URL, which useActiveTenant reads back.

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useActiveTenant } from "@/lib/use-active-tenant";

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function TenantSelector() {
  const { active, tenants, isReady } = useActiveTenant();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onEscape);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!isReady) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-ctp-overlay0">
        <span className="text-ctp-subtext0">TENANT:</span>
        <span className="animate-pulse">[ loading… ]</span>
      </span>
    );
  }

  if (tenants.length === 0 || !active) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-ctp-red">
        <span className="text-ctp-subtext0">TENANT:</span>
        [ NONE ]
      </span>
    );
  }

  function selectTenant(t: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", t);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  // Single-tenant user → read-only bracket text.
  if (tenants.length === 1) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="text-ctp-subtext0">TENANT:</span>
        <span className="text-ctp-text">
          <span className="text-ctp-overlay0">[</span>
          {" "}
          {titleCase(active)}
          {" "}
          <span className="text-ctp-overlay0">]</span>
        </span>
      </span>
    );
  }

  // Multi-tenant user → dropdown.
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-2 text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:underline"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-ctp-subtext0">TENANT:</span>
        <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">[</span>
        <span className="text-ctp-text">{titleCase(active)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ctp-subtext0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        <span className="text-ctp-overlay0 group-hover:text-ctp-subtext0">]</span>
      </button>

      <div
        className={`absolute left-0 top-full z-20 mt-2 min-w-[14rem] border border-dashed border-ctp-overlay0/70 bg-ctp-crust py-1 shadow-2xl shadow-black/40 transition-all duration-150 ease-out ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
        role="listbox"
      >
        {tenants.map((t) => {
          const isActive = t === active;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => selectTenant(t)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-75 ${
                isActive
                  ? "bg-ctp-mauve/15 text-ctp-mauve"
                  : "text-ctp-subtext1 hover:bg-ctp-surface0/40 hover:text-ctp-text"
              }`}
            >
              <span
                aria-hidden
                className={`w-3 text-ctp-mauve ${isActive ? "opacity-100" : "opacity-0"}`}
              >
                {">"}
              </span>
              <span>{titleCase(t)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
