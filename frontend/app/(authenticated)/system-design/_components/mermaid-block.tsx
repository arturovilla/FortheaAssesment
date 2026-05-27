"use client";

// Client-side mermaid renderer.
//
// Mermaid mutates the DOM to produce SVG, which fights React's reconciliation
// model. The standard escape hatch: render into a ref'd div via useEffect.
// Mermaid is dynamic-imported so a doc with no diagrams (and the dashboard
// pages, which never mount this) pay nothing for the ~1MB library.
//
// Each block gets a stable unique id — mermaid uses it internally for the
// SVG's element id and would clash with React's re-renders otherwise.

import { useEffect, useId, useRef, useState } from "react";

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "_");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Dynamic import — keeps mermaid out of the initial bundle.
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose", // needed for some advanced shapes
          themeVariables: {
            // Pull our Catppuccin palette into mermaid so diagrams blend in.
            background: "#11111b",
            primaryColor: "#1e1e2e",
            primaryTextColor: "#cdd6f4",
            primaryBorderColor: "#45475a",
            lineColor: "#7f849c",
            secondaryColor: "#313244",
            tertiaryColor: "#181825",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          },
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="my-4 border border-dashed border-ctp-red/40 p-3 text-xs text-ctp-red">
        Failed to render mermaid diagram: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      // overflow-x: scroll catches wide flowcharts; centred so narrow diagrams
      // sit in the middle of the prose column.
      className="my-6 flex justify-center overflow-x-auto border border-dashed border-ctp-overlay0/40 bg-ctp-base/20 p-4"
    />
  );
}
