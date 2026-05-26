"use client";

// URL-backed range hook (?range=7d|30d|90d). Mirrors the URL-as-source-of-truth
// pattern from useActiveTenant — survives refresh, shareable, no global state.
// Default: 30d. Unknown values fall back to default silently rather than
// throwing; a malformed URL shouldn't break the page.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  DEFAULT_RANGE,
  RANGE_DAYS,
  isRangeKey,
  windowDates,
  type DateWindow,
  type RangeKey,
} from "./range";

export interface UseRangeResult {
  range: RangeKey;
  days: number;
  window: DateWindow;
  setRange: (next: RangeKey) => void;
}

export function useRange(): UseRangeResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("range");
  const range: RangeKey = isRangeKey(raw) ? raw : DEFAULT_RANGE;
  const days = RANGE_DAYS[range];

  const setRange = useCallback(
    (next: RangeKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return {
    range,
    days,
    window: windowDates(days),
    setRange,
  };
}
