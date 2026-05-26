"use client";

// Reusable d3 line chart.
//
// Pattern: React owns the DOM, d3 provides scales / line generators / axis
// generators. Axes are the one place we let d3 mutate a <g> via a small
// effect — re-implementing axis tick layout in JSX isn't worth the
// boilerplate. Everything else (line paths, gridlines, hover crosshair,
// markers) is plain JSX driven by d3-computed values.
//
// Slice 2 ships single-axis. The data shape already supports multiple series
// because slice 3 reuses this for ROAS and slice 4 adds the macro overlay;
// supporting an array on day one means those slices don't reopen this file.

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import { useElementWidth } from "@/lib/use-element-width";

// =============================================================================
// Public types
// =============================================================================

export interface LineChartDatum {
  date: Date;
  value: number | null; // null = gap in the line (d3's .defined())
}

export interface LineSeries {
  id: string;            // stable key for React + tooltip lookup
  label: string;         // human-readable name shown in the tooltip
  color: string;         // CSS color string; pass a Catppuccin token via inline style
  data: LineChartDatum[];
}

export interface AnomalyMarker {
  date: Date;
  value: number;         // y-position (in the primary series' units)
  label: string;         // tooltip text e.g. "cpa_spike (z=+3.2)"
}

export interface LineChartProps {
  series: LineSeries[];
  anomalies?: AnomalyMarker[];
  // Formatters keep the chart unit-agnostic — CPA passes "$%.2f", ROAS passes "%.2fx".
  formatY?: (n: number) => string;
  formatX?: (d: Date) => string;
  // Used in the tooltip's value row, separate from the y-axis tick formatter.
  formatTooltipValue?: (n: number) => string;
  height?: number;
  // Suggested number of y-axis ticks. d3 picks "nice" round values near this
  // count, so the actual tick count may differ slightly. Default 5; expanded
  // chart views pass a higher number for denser labelling.
  yTickCount?: number;
  isLoading?: boolean;
  emptyMessage?: string;
}

// =============================================================================
// Layout + defaults
// =============================================================================

const DEFAULT_HEIGHT = 280;

const MARGIN = {
  top: 16,
  right: 20,
  bottom: 28,  // room for "May 21"
  left: 56,    // room for "$1,234"
} as const;

const defaultFormatX = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const defaultFormatY = (n: number) => n.toLocaleString();

// =============================================================================
// Component
// =============================================================================

export function LineChart({
  series,
  anomalies = [],
  formatY = defaultFormatY,
  formatX = defaultFormatX,
  formatTooltipValue,
  height = DEFAULT_HEIGHT,
  yTickCount = 5,
  isLoading,
  emptyMessage = "No data for this period.",
}: LineChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();

  // Hover state: the X-axis date the user is hovering, snapped to the nearest
  // datum in the primary series. Null = no hover.
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Has any series got a real data point? Drives the empty-state render.
  const hasData = useMemo(
    () => series.some((s) => s.data.some((d) => d.value !== null)),
    [series],
  );

  // Scales — recomputed when data, anomalies, or width changes.
  const { xScale, yScale } = useMemo(() => {
    const allDates = series.flatMap((s) => s.data.map((d) => d.date));
    const allValues = series
      .flatMap((s) => s.data.map((d) => d.value))
      .concat(anomalies.map((a) => a.value))
      .filter((v): v is number => v !== null && Number.isFinite(v));

    const xExtent = d3.extent(allDates) as [Date, Date] | [undefined, undefined];
    const yMin = allValues.length ? Math.min(...allValues, 0) : 0;
    const yMaxRaw = allValues.length ? Math.max(...allValues) : 1;
    // Add ~8% headroom so the line never grazes the chart's top edge.
    const yMax = yMaxRaw === 0 ? 1 : yMaxRaw * 1.08;

    const x = d3
      .scaleTime()
      .domain(
        xExtent[0] && xExtent[1]
          ? [xExtent[0], xExtent[1]]
          : [new Date(), new Date()],
      )
      .range([0, innerWidth || 1]);

    const y = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .nice()
      .range([innerHeight || 1, 0]);

    return { xScale: x, yScale: y };
  }, [series, anomalies, innerWidth, innerHeight]);

  // d3 line generator. `.defined()` makes the path skip null values cleanly
  // instead of stitching across a gap.
  const lineGen = useMemo(
    () =>
      d3
        .line<LineChartDatum>()
        .defined((d) => d.value !== null && Number.isFinite(d.value))
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value as number))
        .curve(d3.curveMonotoneX),
    [xScale, yScale],
  );

  // Y-axis gridline values + label values, shared so the labels sit exactly
  // on the gridlines (using `nice()` means d3 already chose round numbers).
  const yTicks = useMemo(
    () => (innerHeight > 0 ? yScale.ticks(yTickCount) : []),
    [yScale, innerHeight, yTickCount],
  );

  // The bisector finds the data index closest to a given date on hover.
  const primarySeries = series[0];
  const bisect = useMemo(
    () => d3.bisector<LineChartDatum, Date>((d) => d.date).center,
    [],
  );

  // Snap the hover to whichever primary datum is nearest the mouse X.
  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!primarySeries || primarySeries.data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const date = xScale.invert(localX);
    const idx = bisect(primarySeries.data, date);
    const nearest = primarySeries.data[idx];
    if (nearest) setHoverDate(nearest.date);
  }

  function handleMouseLeave() {
    setHoverDate(null);
  }

  // For each series, the datum that lines up with hoverDate (or null).
  const hoverPoints = useMemo(() => {
    if (!hoverDate) return null;
    return series.map((s) => {
      const idx = bisect(s.data, hoverDate);
      const point = s.data[idx];
      return point && point.value !== null ? { series: s, point } : null;
    });
  }, [hoverDate, series, bisect]);

  // Anomaly nearest the hovered date (if any) → switch the tooltip to its label.
  const hoverAnomaly = useMemo(() => {
    if (!hoverDate || anomalies.length === 0) return null;
    return (
      anomalies.find(
        (a) => Math.abs(a.date.getTime() - hoverDate.getTime()) < 86_400_000 / 2,
      ) ?? null
    );
  }, [hoverDate, anomalies]);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {/* Show the skeleton during initial measurement (width === 0) too, so
          there's no blank flash before the first paint. */}
      {width === 0 || isLoading ? (
        <LoadingOverlay height={height} />
      ) : !hasData ? (
        <EmptyOverlay message={emptyMessage} />
      ) : (
        <svg
          width={width}
          height={height}
          aria-label="line chart"
          role="img"
          className="overflow-visible"
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Horizontal gridlines, behind everything */}
            {yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={innerWidth}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="var(--color-ctp-surface0)"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
              />
            ))}

            {/* Y-axis labels (rendered as plain text so we keep React control) */}
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={-10}
                y={yScale(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ctp-subtext0 text-[10px] tabular-nums"
              >
                {formatY(tick)}
              </text>
            ))}

            {/* X-axis — leave the heavy lifting (tick spacing, label rotation) to d3 */}
            <D3Axis
              kind="bottom"
              scale={xScale}
              transform={`translate(0,${innerHeight})`}
              ticks={Math.max(2, Math.floor(innerWidth / 90))}
              tickFormat={formatX}
            />

            {/* The series lines */}
            {series.map((s) => (
              <path
                key={s.id}
                d={lineGen(s.data) ?? ""}
                fill="none"
                stroke={s.color}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* Anomaly markers, on top of the line */}
            {anomalies.map((a, i) => (
              <circle
                key={`${a.date.getTime()}-${i}`}
                cx={xScale(a.date)}
                cy={yScale(a.value)}
                r={5}
                fill="var(--color-ctp-red)"
                stroke="var(--color-ctp-crust)"
                strokeWidth={1.5}
              />
            ))}

            {/* Hover crosshair + dots */}
            {hoverDate && hoverPoints ? (
              <g pointerEvents="none">
                <line
                  x1={xScale(hoverDate)}
                  x2={xScale(hoverDate)}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--color-ctp-overlay0)"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                />
                {hoverPoints.map((hp) =>
                  hp ? (
                    <circle
                      key={hp.series.id}
                      cx={xScale(hp.point.date)}
                      cy={yScale(hp.point.value as number)}
                      r={4}
                      fill={hp.series.color}
                      stroke="var(--color-ctp-crust)"
                      strokeWidth={1.5}
                    />
                  ) : null,
                )}
              </g>
            ) : null}

            {/* Transparent hover surface — must be last so it sits above lines
                and captures pointer events. */}
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          </g>
        </svg>
      )}

      {/* Tooltip — positioned outside the SVG so it can use normal HTML. */}
      {hoverDate && hoverPoints ? (
        <Tooltip
          hoverDate={hoverDate}
          hoverPoints={hoverPoints}
          hoverAnomaly={hoverAnomaly}
          xScale={xScale}
          formatX={formatX}
          formatValue={formatTooltipValue ?? formatY}
          containerWidth={width}
        />
      ) : null}
    </div>
  );
}

// =============================================================================
// Pieces
// =============================================================================

interface D3AxisProps {
  kind: "bottom" | "left";
  scale: d3.AxisScale<Date> | d3.AxisScale<number>;
  transform?: string;
  ticks?: number;
  tickFormat?: (v: never) => string;
}

// Small wrapper that hands a `<g>` to d3 for axis rendering, then cleans up
// the default styles d3 inserts (it adds inline strokes and fonts we don't
// want).
function D3Axis({ kind, scale, transform, ticks, tickFormat }: D3AxisProps) {
  const ref = useRef<SVGGElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const sel = d3.select(ref.current);
    const axisGen =
      kind === "bottom"
        ? d3.axisBottom(scale as d3.AxisScale<Date | number>)
        : d3.axisLeft(scale as d3.AxisScale<Date | number>);
    if (ticks != null) axisGen.ticks(ticks);
    if (tickFormat) axisGen.tickFormat(tickFormat as never);
    axisGen.tickSizeOuter(0).tickPadding(8);
    sel.call(axisGen as never);
    // Strip d3's default styles; let CSS classes drive the look.
    sel.selectAll("path").attr("stroke", "var(--color-ctp-surface0)");
    sel.selectAll("line").attr("stroke", "var(--color-ctp-surface0)");
    sel
      .selectAll("text")
      .attr("fill", "var(--color-ctp-subtext0)")
      .attr("font-size", "10px");
  }, [scale, kind, ticks, tickFormat]);
  return <g ref={ref} transform={transform} />;
}

interface TooltipProps {
  hoverDate: Date;
  hoverPoints: ({ series: LineSeries; point: LineChartDatum } | null)[];
  hoverAnomaly: AnomalyMarker | null;
  xScale: d3.ScaleTime<number, number>;
  formatX: (d: Date) => string;
  formatValue: (n: number) => string;
  containerWidth: number;
}

function Tooltip({
  hoverDate,
  hoverPoints,
  hoverAnomaly,
  xScale,
  formatX,
  formatValue,
  containerWidth,
}: TooltipProps) {
  // Compute tooltip X in container coordinates. Flip to the left of the
  // crosshair if it would overflow the right edge.
  const TOOLTIP_W = 200;
  const OFFSET = 12;
  const crosshairX = xScale(hoverDate) + MARGIN.left;
  const flip = crosshairX + OFFSET + TOOLTIP_W > containerWidth;
  const left = flip ? crosshairX - OFFSET - TOOLTIP_W : crosshairX + OFFSET;

  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded-lg border border-ctp-surface0/80 bg-ctp-mantle/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur"
      style={{
        left,
        top: MARGIN.top,
        width: TOOLTIP_W,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
        {formatX(hoverDate)}
      </div>
      <div className="mt-1.5 space-y-1">
        {hoverPoints.map((hp) =>
          hp ? (
            <div key={hp.series.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ctp-subtext1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: hp.series.color }}
                />
                {hp.series.label}
              </span>
              <span className="tabular-nums text-ctp-text">
                {formatValue(hp.point.value as number)}
              </span>
            </div>
          ) : null,
        )}
      </div>
      {hoverAnomaly ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-ctp-red/30 bg-ctp-red/10 px-2 py-1 text-[11px] text-ctp-red">
          <span className="inline-block h-2 w-2 rounded-full bg-ctp-red" />
          {hoverAnomaly.label}
        </div>
      ) : null}
    </div>
  );
}

// Chart-shaped skeleton: dashed gridlines positioned at the same insets the
// real chart uses (MARGIN), so when the data arrives the layout doesn't
// jump. A pulsing label sits centred over the area.
function LoadingOverlay({ height }: { height: number }) {
  return (
    <div className="relative w-full" style={{ height }}>
      <div
        aria-hidden
        className="absolute"
        style={{
          top: MARGIN.top,
          right: MARGIN.right,
          bottom: MARGIN.bottom,
          left: MARGIN.left,
        }}
      >
        {[0.25, 0.5, 0.75].map((frac) => (
          <div
            key={frac}
            className="absolute left-0 right-0 border-t border-dashed border-ctp-surface0/30"
            style={{ top: `${frac * 100}%` }}
          />
        ))}
        {/* Solid baseline at the bottom = x-axis */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-ctp-surface0/50" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-pulse rounded-md bg-ctp-surface0/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ctp-subtext0">
          loading data
        </div>
      </div>
    </div>
  );
}

function EmptyOverlay({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-ctp-surface0/60 text-xs text-ctp-subtext0">
      {message}
    </div>
  );
}
