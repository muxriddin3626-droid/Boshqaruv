"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

/**
 * ```mermaid``` kod blokini SVG diagrammaga aylantirib chizadi.
 * Krebs sikli, Mendel katagi kabi jarayonlarni vizualizatsiya qilish uchun.
 */
export default function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const diagramId = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;

      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#1e1b3a",
            primaryTextColor: "#e5e7eb",
            primaryBorderColor: "#a855f7",
            lineColor: "#22d3ee",
            fontFamily: "inherit",
          },
        });
        mermaidInitialized = true;
      }

      try {
        const { svg } = await mermaid.render(diagramId.current, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) setError("Diagrammani chizib bo'lmadi.");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return <pre className="text-sm text-red-400">{error}</pre>;
  }

  return <div ref={containerRef} className="mermaid-container my-3 rounded-lg bg-surface/60 p-4" />;
}
