// Time-range primitives. The dashboard's range switcher (7d / 30d / 90d)
// drives every panel — KPI cards, line charts, table — so the logic that
// turns a range key into actual date strings lives here, not duplicated at
// each consumer.

export const RANGE_KEYS = ["7d", "30d", "90d"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const DEFAULT_RANGE: RangeKey = "30d";

export function isRangeKey(value: string | null | undefined): value is RangeKey {
  return value != null && (RANGE_KEYS as readonly string[]).includes(value);
}

export interface DateWindow {
  start: string;       // ISO date (YYYY-MM-DD), inclusive
  end: string;         // ISO date, inclusive
  priorStart: string;  // immediately preceding window of equal length
  priorEnd: string;
}

// Convert a Date to YYYY-MM-DD in UTC. We use UTC throughout so the window
// boundaries are stable regardless of where the user's browser is — the
// backend's date columns aren't timezone-aware.
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns the current window [today-N+1, today] and the immediately prior
// window of the same length. Used both by /performance (Δ vs prior) and by
// /macro (to find a comparison observation N days before the latest).
export function windowDates(days: number, now: Date = new Date()): DateWindow {
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const priorEnd = new Date(start);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);

  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - (days - 1));

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    priorStart: toIsoDate(priorStart),
    priorEnd: toIsoDate(priorEnd),
  };
}
