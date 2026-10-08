"use client";

import { useId, type ReactNode } from "react";

import { VisualFrame } from "./VisualFrame";

/** Chizmaning bitta qismi: a'zo, suyak, tomir, organoid... */
export interface DiagramPart {
  id: string;
  name: string;
  /** AI yozishi mumkin bo'lgan boshqa nomlar (kichik harf, qismi bo'lsa ham mos keladi). */
  aliases: string[];
  /** Raqamli belgining joyi. */
  marker: [number, number];
  shape: ReactNode;
}

export interface DiagramSpec {
  title: string;
  viewBox: string;
  /** Fon: tana yoki hujayra konturi (raqamlanmaydi). */
  base?: ReactNode;
  parts: DiagramPart[];
  /** Legendadan oldingi qisqa tushuntirish (masalan, qon aylanish doiralari). */
  note?: ReactNode;
  /** Chizmaning eng katta kengligi (px) — tik chizmalar telefonda juda cho'zilmasin. */
  maxWidth?: number;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/['`’ʻʼ]/g, "").replace(/[_-]/g, " ").trim();
}

/** "yadrocha" so'ralsa "yadro" yoritilmasin: aniq nom boshqa qismniki bo'lsa — o'sha olinadi. */
export function highlightedParts(parts: DiagramPart[], highlight: string[]): Set<string> {
  const ids = new Map(parts.map((part) => [normalize(part.id), part.id]));
  const names = new Map(parts.map((part) => [normalize(part.name), part.id]));
  const result = new Set<string>();
  for (const raw of highlight) {
    const wanted = normalize(raw);
    const exact = ids.get(wanted) ?? names.get(wanted);
    if (exact) {
      result.add(exact);
      continue;
    }
    for (const part of parts) {
      if (part.aliases.some((alias) => wanted.includes(normalize(alias)))) result.add(part.id);
    }
  }
  return result;
}

/**
 * Raqamlangan chizma: qismlar ketma-ket "chiziladi", har biriga raqam qo'yiladi,
 * pastda legenda. `highlight` berilsa — o'sha qism yonadi, qolganlari xiralashadi.
 */
export default function LabeledDiagram({ spec, highlight, testId }: { spec: DiagramSpec; highlight: string[]; testId?: string }) {
  const glowId = `glow-${useId().replace(/:/g, "")}`;
  const lit = highlightedParts(spec.parts, highlight);
  const dim = lit.size > 0;
  return (
    <VisualFrame
      title={spec.title}
      caption={
        <div className="space-y-2">
          {spec.note && <div className="text-gray-300">{spec.note}</div>}
          <ol className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2" data-testid={testId ? `${testId}-legend` : "diagram-legend"}>
            {spec.parts.map((part, i) => (
              <li key={part.id} className={lit.has(part.id) ? "font-bold text-neon-cyan" : dim ? "text-gray-500" : ""}>
                {i + 1}. {part.name}
              </li>
            ))}
          </ol>
        </div>
      }
    >
      <svg
        viewBox={spec.viewBox}
        className="mx-auto w-full"
        style={spec.maxWidth ? { maxWidth: spec.maxWidth } : undefined}
        role="img"
        aria-label={`${spec.title}: ${spec.parts.map((part) => part.name).join(", ")}`}
        data-testid={testId}
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {spec.base}
        {spec.parts.map((part, i) =>
          part.shape ? (
            // Xiralik tashqi guruhda: ichki "chizilish" animatsiyasi (opacity 1 bilan tugaydi) uni bosib ketmasin.
            <g key={part.id} opacity={dim && !lit.has(part.id) ? 0.25 : 1} filter={lit.has(part.id) ? `url(#${glowId})` : undefined}>
              <g className={`visual-pop ${lit.has(part.id) ? "cell-highlight" : ""}`} style={{ animationDelay: `${i * 110}ms` }}>
                {part.shape}
              </g>
            </g>
          ) : null
        )}
        {spec.parts.map((part, i) => (
          <g key={`m-${part.id}`} transform={`translate(${part.marker[0]} ${part.marker[1]})`}>
            <circle r={7} fill={lit.has(part.id) ? "#22d3ee" : "#111827"} stroke="#e5e7eb" strokeWidth={0.8} />
            <text textAnchor="middle" dy={3} fontSize={8} fontWeight={700} fill={lit.has(part.id) ? "#000" : "#fff"}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </VisualFrame>
  );
}
