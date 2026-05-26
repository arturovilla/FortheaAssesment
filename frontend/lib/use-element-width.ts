"use client";

// useElementWidth — observe the rendered width of a ref'd element.
//
// The d3 line chart needs a real pixel width to compute scales, but Tailwind's
// `w-full` only resolves after layout. A ResizeObserver gives us the current
// width and updates on any layout change (viewport resize, sidebar collapse,
// font load, etc.) without re-measuring on every render.

import { useEffect, useRef, useState } from "react";

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set once synchronously so the first paint already has dimensions.
    setWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // contentRect is the post-layout box; clientWidth would also work but
        // entry.contentRect is what RO callbacks are scoped around.
        const next = Math.floor(entry.contentRect.width);
        setWidth((prev) => (prev === next ? prev : next));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
