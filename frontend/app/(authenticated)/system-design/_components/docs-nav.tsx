"use client";

// Sticky sidebar listing every doc in DOCS order. TUI list pattern: > cursor
// on the active row in mauve, hover row brightens to text. Section header is
// a teal `── DOCUMENTS ──` cap.

import Link from "next/link";

import { DOCS } from "@/lib/docs";

export function DocsNav({ activeSlug }: { activeSlug: string }) {
  return (
    <nav
      aria-label="System design docs"
      className="space-y-1 lg:sticky lg:top-[88px]"
    >
      <h2 className="mb-3 px-2 text-[10px] uppercase tracking-[0.18em] text-ctp-teal">
        ── DOCUMENTS ──
      </h2>
      {DOCS.map((doc) => {
        const isActive = doc.slug === activeSlug;
        return (
          <Link
            key={doc.slug}
            href={`/system-design/${doc.slug}`}
            className={`group flex items-start gap-2 px-2.5 py-2 transition-colors duration-100 focus-visible:outline-none focus-visible:underline ${
              isActive ? "bg-ctp-mauve/15" : "hover:bg-ctp-surface0/30"
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 w-3 flex-shrink-0 text-ctp-mauve ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
            >
              {">"}
            </span>
            <span className="flex-1 leading-tight">
              <span
                className={`block text-sm font-medium ${
                  isActive
                    ? "text-ctp-mauve"
                    : "text-ctp-subtext1 group-hover:text-ctp-text"
                }`}
              >
                {doc.title}
              </span>
              <span className="block text-xs text-ctp-subtext0">{doc.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
