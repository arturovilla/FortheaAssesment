// Dashboard home — slices 1-7: range switcher, KPI strip, CPA + ROAS,
// macro + anomalies, performance table, all wrapped in per-panel error
// boundaries so one crash doesn't blank the whole dashboard.

import { AnomaliesPanel } from "./_components/anomalies-panel";
import { CpaChart } from "./_components/cpa-chart";
import { ErrorBoundary } from "./_components/error-boundary";
import { KpiStrip } from "./_components/kpi-strip";
import { MacroChart } from "./_components/macro-chart";
import { PerformanceTable } from "./_components/performance-table";
import { RangeSwitcher } from "./_components/range-switcher";
import { RoasChart } from "./_components/roas-chart";
import { UploadData } from "./_components/upload-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-ctp-overlay0/30 pb-4">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-ctp-teal">
            ── PERFORMANCE ──
          </h1>
          <p className="mt-1 text-xs text-ctp-subtext0">
            Marketing KPIs alongside macro context for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <UploadData />
          <RangeSwitcher />
        </div>
      </header>

      <ErrorBoundary label="KPIs">
        <KpiStrip />
      </ErrorBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorBoundary label="CPA chart">
          <CpaChart />
        </ErrorBoundary>
        <ErrorBoundary label="ROAS chart">
          <RoasChart />
        </ErrorBoundary>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorBoundary label="Macro chart">
          <MacroChart />
        </ErrorBoundary>
        <ErrorBoundary label="Anomalies">
          <AnomaliesPanel />
        </ErrorBoundary>
      </div>

      <ErrorBoundary label="Performance table">
        <PerformanceTable />
      </ErrorBoundary>
    </div>
  );
}
