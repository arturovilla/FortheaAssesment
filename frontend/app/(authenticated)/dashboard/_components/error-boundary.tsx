"use client";

// Per-panel React error boundary.
//
// Inline API errors (4xx/5xx from the backend) are already handled per-panel
// — each component shows a red "Failed to load …" box when its query errors.
// This boundary is for the *unexpected*: a render-time JS throw, a missing
// field that crashes a formatter, a useMemo that explodes on null data. The
// goal is that one bad panel doesn't blank the whole dashboard.
//
// React doesn't ship a function-component error boundary, so this is the
// usual minimal class-based implementation. No third-party dep needed for a
// surface this small.

import { AlertOctagon, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  // Shown in the fallback ("KPIs failed", "CPA chart failed"). Keep short.
  label?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Real deployments would forward to Sentry / App Insights here.
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-xl border border-ctp-red/30 bg-ctp-red/5 p-5">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-ctp-red" />
          <h2 className="text-sm font-semibold text-ctp-red">
            {this.props.label ?? "This panel"} failed
          </h2>
        </div>
        <p className="mt-1 text-xs text-ctp-red/80">
          Something went wrong rendering this section.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-ctp-red/60">technical detail</summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-ctp-mantle/60 p-2 text-[10px] text-ctp-subtext1">
            {this.state.error.message}
          </pre>
        </details>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-ctp-red/30 bg-ctp-red/10 px-2.5 py-1.5 text-xs font-medium text-ctp-red transition-colors hover:bg-ctp-red/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-red/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    );
  }
}
