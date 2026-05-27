"use client";

// Next.js route-segment error boundary — last line of defense.
//
// Each panel has its own <ErrorBoundary> wrapper, so this only fires when
// something escapes them: a thrown error during page composition, the
// dashboard layout itself crashing, an unhandled state in <Providers>.
// If a panel-level boundary catches the error, this never renders.

import { useEffect } from "react";

import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Real deployments would forward to Sentry / App Insights here.
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <TuiPanel title="Dashboard error" tone="crit">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-ctp-red">
          ✗
        </span>
        <h1 className="text-base font-semibold text-ctp-red">
          The dashboard failed to load
        </h1>
      </div>
      <p className="mt-2 text-sm text-ctp-red/80">
        An unexpected error escaped every panel boundary and reached the
        route. Try again, or refresh the page.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ctp-red/60">technical detail</summary>
        <pre className="mt-1 max-h-40 overflow-auto border border-dashed border-ctp-red/30 bg-ctp-mantle/60 p-3 text-[11px] text-ctp-subtext1">
          {error.message}
        </pre>
      </details>
      <button
        type="button"
        onClick={reset}
        className="group mt-4 inline-flex items-center px-1 text-sm text-ctp-red transition-colors hover:text-ctp-peach focus-visible:outline-none focus-visible:underline"
      >
        <span className="text-ctp-red/40 group-hover:text-ctp-peach/60">[</span>
        <span className="px-1.5" aria-hidden>
          ↻
        </span>
        <span>Try again</span>
        <span className="ml-1 text-ctp-red/40 group-hover:text-ctp-peach/60">]</span>
      </button>
    </TuiPanel>
  );
}
