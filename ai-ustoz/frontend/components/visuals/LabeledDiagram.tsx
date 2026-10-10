"use client";

import { useId, useMemo, type ReactNode } from "react";

import { layoutCallouts } from "@/lib/visuals/callouts";

import { MaterialDefs, ShapeFilters } from "./anatomy/materials";
import { VisualFrame } from "./VisualFrame";

/** Chizmaning bitta qismi: a'zo, suyak, tomir, organoid... */
export interface DiagramPart {
  id: string;
  name: string;
  /** AI yozishi mumkin bo'lgan boshqa nomlar (kichik harf, qismi bo'lsa ham mos keladi). */
  aliases: string[];
  /** Qismning ustidagi nuqta — chetdagi raqam shu yerga ingichka chiziq bilan ulanadi. */
  anchor: [number, number];
  /** Raqam qaysi chetda tursin (berilmasa — langar chizma o'rtasidan qaysi tomonda bo'lsa). */
  side?: "left" | "right";
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
  const uid = useId().replace(/:/g, "");
  const glowId = `glow-${uid}`;
  const shadowId = `shadow-${uid}`;
  const lit = highlightedParts(spec.parts, highlight);
  const dim = lit.size > 0;
  const layout = useMemo(() => layoutCallouts(spec.parts, spec.viewBox), [spec]);
  const numberOf = new Map(spec.parts.map((part, i) => [part.id, i + 1]));
  const { radius } = layout;
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
        viewBox={layout.viewBox.join(" ")}
        className="mx-auto w-full"
        style={spec.maxWidth ? { maxWidth: spec.maxWidth } : undefined}
        role="img"
        aria-label={`${spec.title}: ${spec.parts.map((part) => part.name).join(", ")}`}
        data-testid={testId}
      >
        <MaterialDefs />
        <ShapeFilters shadowId={shadowId} glowId={glowId} region={layout.viewBox} />
        {spec.base}
        {spec.parts.map((part, i) =>
          part.shape ? (
            // Xiralik tashqi guruhda: ichki "chizilish" animatsiyasi (opacity 1 bilan tugaydi) uni bosib ketmasin.
            <g
              key={part.id}
              opacity={dim && !lit.has(part.id) ? 0.22 : 1}
              filter={lit.has(part.id) ? `url(#${glowId})` : `url(#${shadowId})`}
            >
              <g className={`visual-pop ${lit.has(part.id) ? "cell-highlight" : ""}`} style={{ animationDelay: `${i * 110}ms` }}>
                {part.shape}
              </g>
            </g>
          ) : null
        )}
        {layout.callouts.map((callout) => {
          const isLit = lit.has(callout.id);
          const [mx, my] = callout.marker;
          const [ax, ay] = callout.anchor;
          const startX = callout.side === "left" ? mx + radius : mx - radius;
          return (
            <g key={`c-${callout.id}`} opacity={dim && !isLit ? 0.45 : 1}>
              <path
                d={`M${startX} ${my} L${callout.elbowX} ${my} L${ax} ${ay}`}
                fill="none"
                stroke={isLit ? "#22d3ee" : "rgba(229,231,235,0.55)"}
                strokeWidth={radius * 0.12}
              />
              <circle cx={ax} cy={ay} r={radius * 0.22} fill={isLit ? "#22d3ee" : "#e5e7eb"} />
              <circle cx={mx} cy={my} r={radius} fill={isLit ? "#22d3ee" : "#111827"} stroke={isLit ? "#22d3ee" : "#e5e7eb"} strokeWidth={radius * 0.1} />
              <text x={mx} y={my} dy={radius * 0.38} textAnchor="middle" fontSize={radius * 1.1} fontWeight={700} fill={isLit ? "#000" : "#fff"}>
                {numberOf.get(callout.id)}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualFrame>
  );
}
