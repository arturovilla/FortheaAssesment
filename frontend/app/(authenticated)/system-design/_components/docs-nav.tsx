"use client";

// Sticky sidebar listing every doc in DOCS order. The currently-viewed doc
// gets highlight + a chevron; everything else is a quiet link. Sits in a
// fixed-width column to the left of the rendered markdown.

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { DOCS } from "@/lib/docs";

export function DocsNav({ activeSlug }: { activeSlug: string }) {
  return (
    <nav
      aria-label="System design docs"
      className="space-y-1 lg:sticky lg:top-[88px]"
    >
      <h2 className="mb-2 px-2 font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
        Documents
      </h2>
      {DOCS.map((doc) => {
        const isActive = doc.slug === activeSlug;
        return (
          <Link
            key={doc.slug}
            href={`/system-design/${doc.slug}`}
            className={`group flex items-start gap-2 rounded-md border border-transparent px-2.5 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40 ${
              isActive
                ? "border-ctp-surface0/60 bg-ctp-surface0/40"
                : "hover:bg-ctp-surface0/30"
            }`}
          >
            <ChevronRight
              className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 transition-colors ${
                isActive ? "text-ctp-blue" : "text-ctp-subtext0 group-hover:text-ctp-text"
              }`}
            />
            <span className="flex-1 leading-tight">
              <span className={`block text-sm font-medium ${isActive ? "text-ctp-text" : "text-ctp-subtext1 group-hover:text-ctp-text"}`}>
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
