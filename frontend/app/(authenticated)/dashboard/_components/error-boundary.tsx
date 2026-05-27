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

import { Component, type ErrorInfo, type ReactNode } from "react";

import { TuiPanel } from "@/app/(authenticated)/_components/tui/panel";

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
      <TuiPanel title={`${this.props.label ?? "Panel"} failed`} tone="crit">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-ctp-red">
            ✗
          </span>
          <h2 className="text-sm font-semibold text-ctp-red">
            {this.props.label ?? "This panel"} failed
          </h2>
        </div>
        <p className="mt-1 text-xs text-ctp-red/80">
          Something went wrong rendering this section.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-ctp-red/60">technical detail</summary>
          <pre className="mt-1 max-h-32 overflow-auto border border-dashed border-ctp-red/30 bg-ctp-mantle/60 p-2 text-[10px] text-ctp-subtext1">
            {this.state.error.message}
          </pre>
        </details>
        <button
          type="button"
          onClick={this.reset}
          className="group mt-3 inline-flex items-center px-1 text-xs text-ctp-red transition-colors hover:text-ctp-peach focus-visible:outline-none focus-visible:underline"
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
}
