"use client";

import type { ReactNode } from "react";

import type { CellSpec } from "@/lib/visuals/blocks";

import { VisualFrame } from "./VisualFrame";

interface Organelle {
  id: string;
  name: string;
  aliases: string[];
  marker: [number, number];
  shape: ReactNode;
}

const MITO = (x: number, y: number, rotate: number) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse rx={26} ry={12} fill="rgba(251,146,60,0.3)" stroke="#fb923c" strokeWidth={1.5} />
    <path d="M-20 0 l5 -7 l5 14 l5 -14 l5 14 l5 -14 l5 14 l5 -7" fill="none" stroke="#fb923c" strokeWidth={1} />
  </g>
);

const GOLGI = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`} fill="none" stroke="#facc15" strokeWidth={2.2} strokeLinecap="round">
    {[0, 7, 14, 21].map((dy, i) => (
      <path key={dy} d={`M${-22 + i * 2} ${dy} q${22 - i * 2} -12 ${44 - i * 4} 0`} />
    ))}
  </g>
);

const ER = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`} fill="none" stroke="#38bdf8" strokeWidth={1.6}>
    {[0, 10, 20].map((dy) => (
      <path key={dy} d={`M0 ${dy} q10 -8 20 0 t20 0 t20 0 t20 0`} />
    ))}
    {[6, 26, 46, 66].map((dx) => (
      <circle key={dx} cx={dx} cy={-3} r={1.8} fill="#e5e7eb" stroke="none" />
    ))}
  </g>
);

const CHLOROPLAST = (x: number, y: number, rotate: number) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse rx={24} ry={13} fill="rgba(74,222,128,0.35)" stroke="#4ade80" strokeWidth={1.5} />
    {[-12, 0, 12].map((dx) => (
      <rect key={dx} x={dx - 3} y={-6} width={6} height={12} rx={1} fill="#22c55e" />
    ))}
  </g>
);

const RIBOSOMES = (points: [number, number][]) => (
  <g fill="#e5e7eb">
    {points.map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={2} />
    ))}
  </g>
);

function animalCell(): { outline: ReactNode; organelles: Organelle[] } {
  return {
    outline: <ellipse cx={200} cy={130} rx={185} ry={118} fill="rgba(244,114,182,0.06)" />,
    organelles: [
      { id: "membrana", name: "Hujayra membranasi", aliases: ["membrana"], marker: [32, 70], shape: <ellipse cx={200} cy={130} rx={185} ry={118} fill="none" stroke="#f472b6" strokeWidth={3} /> },
      { id: "sitoplazma", name: "Sitoplazma", aliases: ["sitoplazma"], marker: [345, 120], shape: null },
      { id: "yadro", name: "Yadro", aliases: ["yadro", "nucleus"], marker: [165, 88], shape: <circle cx={200} cy={125} r={42} fill="rgba(168,85,247,0.25)" stroke="#a855f7" strokeWidth={2} /> },
      { id: "yadrocha", name: "Yadrocha", aliases: ["yadrocha"], marker: [232, 108], shape: <circle cx={210} cy={120} r={12} fill="rgba(168,85,247,0.7)" /> },
      { id: "mitoxondriya", name: "Mitoxondriya", aliases: ["mitoxondri"], marker: [62, 108], shape: <g>{MITO(88, 120, -20)}{MITO(300, 195, 15)}</g> },
      { id: "ept", name: "Endoplazmatik to'r (EPT)", aliases: ["ept", "endoplazmatik"], marker: [118, 220], shape: ER(110, 185) },
      { id: "golji", name: "Golji apparati", aliases: ["golji", "goldji"], marker: [330, 68], shape: GOLGI(300, 70) },
      { id: "ribosoma", name: "Ribosomalar", aliases: ["ribosom"], marker: [262, 236], shape: RIBOSOMES([[250, 215], [262, 222], [240, 230], [150, 60], [165, 52], [320, 150], [70, 160]]) },
      { id: "lizosoma", name: "Lizosoma", aliases: ["lizosom"], marker: [140, 40], shape: <g fill="rgba(74,222,128,0.4)" stroke="#4ade80"><circle cx={128} cy={55} r={9} /><circle cx={270} cy={140} r={8} /></g> },
      { id: "sentriola", name: "Hujayra markazi (sentriolalar)", aliases: ["sentriol", "hujayra markazi"], marker: [282, 102], shape: <g fill="#e5e7eb"><rect x={255} y={95} width={14} height={5} rx={1} /><rect x={262} y={100} width={5} height={14} rx={1} /></g> },
    ],
  };
}

function plantCell(): { outline: ReactNode; organelles: Organelle[] } {
  return {
    outline: <rect x={18} y={14} width={364} height={232} rx={10} fill="rgba(74,222,128,0.05)" />,
    organelles: [
      { id: "devor", name: "Hujayra devori (sellyuloza)", aliases: ["devor", "sellyuloza"], marker: [10, 40], shape: <rect x={18} y={14} width={364} height={232} rx={10} fill="none" stroke="#22c55e" strokeWidth={7} /> },
      { id: "membrana", name: "Hujayra membranasi", aliases: ["membrana"], marker: [38, 236], shape: <rect x={28} y={24} width={344} height={212} rx={7} fill="none" stroke="#f472b6" strokeWidth={1.5} /> },
      { id: "vakuola", name: "Markaziy vakuola (hujayra shirasi)", aliases: ["vakuol"], marker: [272, 90], shape: <rect x={165} y={60} width={185} height={140} rx={40} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth={1.5} /> },
      { id: "yadro", name: "Yadro", aliases: ["yadro", "nucleus"], marker: [60, 60], shape: <circle cx={90} cy={85} r={32} fill="rgba(168,85,247,0.25)" stroke="#a855f7" strokeWidth={2} /> },
      { id: "yadrocha", name: "Yadrocha", aliases: ["yadrocha"], marker: [118, 64], shape: <circle cx={98} cy={80} r={9} fill="rgba(168,85,247,0.7)" /> },
      { id: "xloroplast", name: "Xloroplast", aliases: ["xloroplast", "plastid"], marker: [210, 38], shape: <g>{CHLOROPLAST(190, 42, 0)}{CHLOROPLAST(300, 225, 10)}{CHLOROPLAST(70, 200, -25)}</g> },
      { id: "mitoxondriya", name: "Mitoxondriya", aliases: ["mitoxondri"], marker: [145, 128], shape: MITO(130, 150, 30) },
      { id: "ept", name: "Endoplazmatik to'r (EPT)", aliases: ["ept", "endoplazmatik"], marker: [44, 132], shape: ER(45, 140) },
      { id: "golji", name: "Golji apparati", aliases: ["golji", "goldji"], marker: [118, 222], shape: GOLGI(120, 200) },
      { id: "ribosoma", name: "Ribosomalar", aliases: ["ribosom"], marker: [340, 40], shape: RIBOSOMES([[330, 40], [352, 46], [145, 100], [60, 170], [100, 120]]) },
      { id: "sitoplazma", name: "Sitoplazma", aliases: ["sitoplazma"], marker: [140, 40], shape: null },
    ],
  };
}

function matches(organelle: Organelle, highlight: string[], ids: Set<string>): boolean {
  return highlight.some((item) => {
    const normalized = item.replace(/['`’]/g, "").trim();
    if (organelle.id === normalized) return true;
    // "yadrocha" so'ralsa "yadro" ham yoritilmasin: aniq nom boshqa organoidniki bo'lsa — o'tkaziladi.
    if (ids.has(normalized)) return false;
    return organelle.aliases.some((alias) => normalized.includes(alias.replace(/['`’]/g, "")));
  });
}

/** Hujayra chizmasi: organoidlar raqamlangan, kerakli organoid yoritiladi (qolgani xiralashadi). */
export default function CellDiagram({ spec }: { spec: CellSpec }) {
  const { outline, organelles } = spec.type === "osimlik" ? plantCell() : animalCell();
  const ids = new Set(organelles.map((o) => o.id));
  const highlighted = new Set(organelles.filter((o) => matches(o, spec.highlight, ids)).map((o) => o.id));
  const dim = highlighted.size > 0;
  return (
    <VisualFrame
      title={spec.type === "osimlik" ? "O'simlik hujayrasi" : "Hayvon hujayrasi"}
      caption={
        <ol className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2" data-testid="cell-legend">
          {organelles.map((organelle, i) => (
            <li key={organelle.id} className={highlighted.has(organelle.id) ? "font-bold text-neon-cyan" : dim ? "text-gray-500" : ""}>
              {i + 1}. {organelle.name}
            </li>
          ))}
        </ol>
      }
    >
      <svg viewBox="0 0 400 260" className="w-full" role="img" aria-label={spec.type === "osimlik" ? "O'simlik hujayrasi chizmasi" : "Hayvon hujayrasi chizmasi"}>
        <defs>
          <filter id="cell-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {outline}
        {organelles.map((organelle, i) =>
          organelle.shape ? (
            <g
              key={organelle.id}
              className={`visual-pop ${highlighted.has(organelle.id) ? "cell-highlight" : ""}`}
              style={{ animationDelay: `${i * 120}ms`, opacity: dim && !highlighted.has(organelle.id) ? 0.35 : 1 }}
              filter={highlighted.has(organelle.id) ? "url(#cell-glow)" : undefined}
            >
              {organelle.shape}
            </g>
          ) : null
        )}
        {organelles.map((organelle, i) => (
          <g key={`m-${organelle.id}`} transform={`translate(${organelle.marker[0]} ${organelle.marker[1]})`}>
            <circle r={8} fill={highlighted.has(organelle.id) ? "#22d3ee" : "#111827"} stroke="#e5e7eb" strokeWidth={1} />
            <text textAnchor="middle" dy={3.5} fontSize={9} fontWeight={700} fill={highlighted.has(organelle.id) ? "#000" : "#fff"}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </VisualFrame>
  );
}
