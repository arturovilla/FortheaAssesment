"use client";

// Active-tenant selector for the dashboard topbar.
//
// State model:
//   - User's accessible tenants come from Clerk's publicMetadata.tenants
//     (set per-user in the Clerk dashboard).
//   - The currently-active tenant lives in the URL as `?tenant=apple`.
//     URL is the source of truth — survives refresh, shareable, no global
//     state library needed.
//   - Single-tenant users see a read-only chip (no dropdown).
//   - Multi-tenant users (agency-staff / admin) see a dropdown with smooth
//     fade + scale entrance.

import { useUser } from "@clerk/nextjs";
import { Building2, Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function TenantSelector() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape.
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

  if (!isLoaded) {
    return <div className="h-9 w-40 animate-pulse rounded-lg border border-ctp-surface0/60 bg-ctp-base/40" />;
  }

  const tenants = (user?.publicMetadata?.tenants as string[] | undefined) ?? [];
  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-ctp-red/30 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
        No tenant assignments
      </div>
    );
  }

  const activeFromUrl = searchParams.get("tenant");
  const active = activeFromUrl && tenants.includes(activeFromUrl) ? activeFromUrl : tenants[0];

  function selectTenant(t: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", t);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  // Single-tenant user → read-only chip.
  if (tenants.length === 1) {
    return (
      <div className="inline-flex items-center gap-2.5 rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 px-3.5 py-2 text-sm font-medium text-ctp-text">
        <Building2 className="h-4 w-4 text-ctp-subtext0" />
        <span>{titleCase(active)}</span>
      </div>
    );
  }

  // Multi-tenant user → animated dropdown.
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2.5 rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 px-3.5 py-2 text-sm font-medium text-ctp-text transition-colors duration-150 hover:bg-ctp-surface0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 className="h-4 w-4 text-ctp-subtext0" />
        <span>{titleCase(active)}</span>
        <ChevronDown
          className={`h-4 w-4 text-ctp-subtext0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown stays in the DOM so it can transition on both enter and exit.
          `pointer-events-none` when closed prevents click-through. */}
      <div
        className={`absolute left-0 top-full z-20 mt-2 min-w-[12rem] origin-top-left rounded-lg border border-ctp-surface0/80 bg-ctp-mantle p-1 shadow-2xl shadow-black/40 backdrop-blur transition-all duration-150 ease-out ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
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
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-ctp-text transition-colors duration-100 hover:bg-ctp-surface0/70"
            >
              <span className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-ctp-subtext0" />
                {titleCase(t)}
              </span>
              {isActive && <Check className="h-4 w-4 text-ctp-green" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
