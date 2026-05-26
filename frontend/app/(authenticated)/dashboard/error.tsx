"use client";

// Next.js route-segment error boundary — last line of defense.
//
// Each panel has its own <ErrorBoundary> wrapper, so this only fires when
// something escapes them: a thrown error during page composition, the
// dashboard layout itself crashing, an unhandled state in <Providers>.
// If a panel-level boundary catches the error, this never renders.

import { AlertOctagon, RefreshCw } from "lucide-react";
import { useEffect } from "react";

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
    <div className="rounded-xl border border-ctp-red/30 bg-ctp-red/5 p-6">
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-5 w-5 text-ctp-red" />
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
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-ctp-mantle/60 p-3 text-[11px] text-ctp-subtext1">
          {error.message}
        </pre>
      </details>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-ctp-red/30 bg-ctp-red/10 px-3 py-2 text-sm font-medium text-ctp-red transition-colors hover:bg-ctp-red/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-red/40"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
