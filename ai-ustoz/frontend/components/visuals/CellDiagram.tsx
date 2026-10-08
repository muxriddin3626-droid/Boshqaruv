"use client";

import type { ReactNode } from "react";

import type { CellSpec } from "@/lib/visuals/blocks";

import { mat } from "./anatomy/materials";
import LabeledDiagram, { type DiagramPart } from "./LabeledDiagram";

type Organelle = DiagramPart;

/** Mitoxondriya: ikki membrana, ichki membrana burmalari (kristalar). */
const MITO = (x: number, y: number, rotate: number) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse rx={27} ry={13} fill={mat("mito")} stroke="#7c2d12" strokeWidth={1} />
    <ellipse rx={23} ry={9.5} fill="#fdba74" stroke="#9a3412" strokeWidth={0.8} />
    <path d="M-19 -9 L-15 4 L-11 -9 L-7 6 L-3 -9 L1 6 L5 -9 L9 6 L13 -9 L17 4" fill="none" stroke="#9a3412" strokeWidth={1.4} strokeLinejoin="round" />
  </g>
);

/** Golji: egilgan yassi sisternalar va ajralayotgan pufakchalar. */
const GOLGI = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`}>
    {[0, 7, 14, 21].map((dy, i) => (
      <path
        key={dy}
        d={`M${-24 + i * 3} ${dy} Q0 ${dy - 14} ${24 - i * 3} ${dy} Q0 ${dy - 8} ${-24 + i * 3} ${dy} Z`}
        fill={mat("golgi")}
        stroke="#a16207"
        strokeWidth={0.8}
      />
    ))}
    {[[-28, 4], [28, 6], [-24, 22], [26, 24]].map(([cx, cy]) => (
      <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={2.8} fill={mat("golgi")} stroke="#a16207" strokeWidth={0.6} />
    ))}
  </g>
);

/** Donador EPT: to'lqinsimon kanallar, ustida ribosomalar. */
const ER = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`}>
    {[0, 10, 20].map((dy) => (
      <g key={dy}>
        <path d={`M0 ${dy} q10 -8 20 0 t20 0 t20 0 t20 0`} fill="none" stroke="#075985" strokeWidth={4.6} strokeLinecap="round" />
        <path d={`M0 ${dy} q10 -8 20 0 t20 0 t20 0 t20 0`} fill="none" stroke="#7dd3fc" strokeWidth={3} strokeLinecap="round" />
      </g>
    ))}
    {[2, 9, 16, 26, 33, 46, 53, 66, 73].map((dx, i) => (
      <circle key={dx} cx={dx} cy={i % 2 ? -5 : -3} r={1.5} fill="#1e293b" />
    ))}
  </g>
);

/** Xloroplast: ikki membrana, granalar (tilakoid "tangalari" ustunlari). */
const CHLOROPLAST = (x: number, y: number, rotate: number) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse rx={25} ry={13.5} fill={mat("chloro")} stroke="#14532d" strokeWidth={1} />
    <path d="M-18 -2 L18 2" stroke="#166534" strokeWidth={0.8} />
    {[-13, -2, 9].map((dx) => (
      <g key={dx}>
        {[-6, -3, 0, 3].map((dy) => (
          <rect key={dy} x={dx - 3.5} y={dy} width={7} height={2.4} rx={1} fill="#15803d" stroke="#052e16" strokeWidth={0.3} />
        ))}
      </g>
    ))}
  </g>
);

const RIBOSOMES = (points: [number, number][]) => (
  <g fill="#334155" stroke="#e2e8f0" strokeWidth={0.4}>
    {points.map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={2.2} />
    ))}
  </g>
);

/** Yadro: ikki qavat qobiq, teshiklari va xromatin. */
const NUCLEUS = (cx: number, cy: number, r: number) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={mat("nucleus")} stroke="#581c87" strokeWidth={2} strokeDasharray={`${r * 0.5} ${r * 0.08}`} />
    <path
      d={`M${cx - r * 0.6} ${cy - r * 0.2} q${r * 0.2} ${-r * 0.3} ${r * 0.4} 0 t${r * 0.4} ${r * 0.1} M${cx - r * 0.5} ${cy + r * 0.4} q${r * 0.3} ${-r * 0.2} ${r * 0.6} ${r * 0.05} M${cx + r * 0.1} ${cy + r * 0.55} q${r * 0.2} ${-r * 0.3} ${r * 0.45} ${-r * 0.2}`}
      fill="none"
      stroke="#6b21a8"
      strokeWidth={1}
      opacity={0.7}
    />
  </g>
);

function animalCell(): { outline: ReactNode; organelles: Organelle[] } {
  return {
    outline: <ellipse cx={200} cy={130} rx={185} ry={118} fill={mat("cytoplasm")} opacity={0.3} />,
    organelles: [
      { id: "membrana", name: "Hujayra membranasi", aliases: ["membrana"], anchor: [25, 112], shape: <ellipse cx={200} cy={130} rx={185} ry={118} fill="none" stroke="#db2777" strokeWidth={3} /> },
      { id: "sitoplazma", name: "Sitoplazma", aliases: ["sitoplazma"], anchor: [350, 108], shape: null },
      { id: "yadro", name: "Yadro", aliases: ["yadro", "nucleus"], anchor: [178, 148], shape: NUCLEUS(200, 125, 42) },
      { id: "yadrocha", name: "Yadrocha", aliases: ["yadrocha"], anchor: [210, 120], shape: <circle cx={210} cy={120} r={12} fill={mat("nucleolus")} /> },
      { id: "mitoxondriya", name: "Mitoxondriya", aliases: ["mitoxondri"], anchor: [88, 120], shape: <g>{MITO(88, 120, -20)}{MITO(300, 195, 15)}</g> },
      { id: "ept", name: "Endoplazmatik to'r (EPT)", aliases: ["ept", "endoplazmatik"], anchor: [130, 195], shape: ER(110, 185) },
      { id: "golji", name: "Golji apparati", aliases: ["golji", "goldji"], anchor: [300, 72], shape: GOLGI(300, 70) },
      { id: "ribosoma", name: "Ribosomalar", aliases: ["ribosom"], anchor: [250, 215], shape: RIBOSOMES([[250, 215], [262, 222], [240, 230], [150, 60], [165, 52], [320, 150], [70, 160]]) },
      { id: "lizosoma", name: "Lizosoma", aliases: ["lizosom"], anchor: [128, 55], shape: <g fill={mat("lyso")} stroke="#365314"><circle cx={128} cy={55} r={9} /><circle cx={270} cy={140} r={8} /></g> },
      { id: "sentriola", name: "Hujayra markazi (sentriolalar)", aliases: ["sentriol", "hujayra markazi"], anchor: [262, 102], shape: (
        <g fill="#cbd5e1" stroke="#475569" strokeWidth={0.6}>
          <rect x={255} y={95} width={15} height={6} rx={2} />
          <rect x={262} y={100} width={6} height={15} rx={2} />
          <path d="M258 98 L267 98 M265 104 L265 113" stroke="#64748b" strokeDasharray="1 1" />
        </g>
      ) },
    ],
  };
}

function plantCell(): { outline: ReactNode; organelles: Organelle[] } {
  return {
    outline: <rect x={18} y={14} width={364} height={232} rx={10} fill={mat("plantcyto")} opacity={0.25} />,
    organelles: [
      { id: "devor", name: "Hujayra devori (sellyuloza)", aliases: ["devor", "sellyuloza"], anchor: [18, 60], shape: (
        <g>
          <rect x={18} y={14} width={364} height={232} rx={10} fill="none" stroke="#166534" strokeWidth={8} />
          <rect x={18} y={14} width={364} height={232} rx={10} fill="none" stroke="#4ade80" strokeWidth={4} strokeDasharray="10 2" />
        </g>
      ) },
      { id: "membrana", name: "Hujayra membranasi", aliases: ["membrana"], anchor: [28, 236], shape: <rect x={28} y={24} width={344} height={212} rx={7} fill="none" stroke="#db2777" strokeWidth={1.8} /> },
      { id: "vakuola", name: "Markaziy vakuola (hujayra shirasi)", aliases: ["vakuol"], anchor: [258, 130], shape: (
        <g>
          <rect x={165} y={60} width={185} height={140} rx={40} fill={mat("vacuole")} opacity={0.75} stroke="#0369a1" strokeWidth={1.5} />
          <path d="M190 80 Q230 70 270 78" fill="none" stroke="#fff" strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        </g>
      ) },
      { id: "yadro", name: "Yadro", aliases: ["yadro", "nucleus"], anchor: [76, 98], shape: NUCLEUS(90, 85, 32) },
      { id: "yadrocha", name: "Yadrocha", aliases: ["yadrocha"], anchor: [98, 80], shape: <circle cx={98} cy={80} r={9} fill={mat("nucleolus")} /> },
      { id: "xloroplast", name: "Xloroplast", aliases: ["xloroplast", "plastid"], anchor: [190, 42], shape: <g>{CHLOROPLAST(190, 42, 0)}{CHLOROPLAST(300, 225, 10)}{CHLOROPLAST(70, 200, -25)}</g> },
      { id: "mitoxondriya", name: "Mitoxondriya", aliases: ["mitoxondri"], anchor: [130, 150], shape: MITO(130, 150, 30) },
      { id: "ept", name: "Endoplazmatik to'r (EPT)", aliases: ["ept", "endoplazmatik"], anchor: [55, 150], shape: ER(45, 140) },
      { id: "golji", name: "Golji apparati", aliases: ["golji", "goldji"], anchor: [120, 200], shape: GOLGI(120, 200) },
      { id: "ribosoma", name: "Ribosomalar", aliases: ["ribosom"], anchor: [330, 40], shape: RIBOSOMES([[330, 40], [352, 46], [145, 100], [60, 170], [100, 120]]) },
      { id: "sitoplazma", name: "Sitoplazma", aliases: ["sitoplazma"], anchor: [140, 40], shape: null },
    ],
  };
}

/** Hujayra chizmasi: organoidlar raqamlangan, kerakli organoid yoritiladi (qolgani xiralashadi). */
export default function CellDiagram({ spec }: { spec: CellSpec }) {
  const { outline, organelles } = spec.type === "osimlik" ? plantCell() : animalCell();
  return (
    <LabeledDiagram
      spec={{ title: spec.type === "osimlik" ? "O'simlik hujayrasi" : "Hayvon hujayrasi", viewBox: "0 0 400 260", base: outline, parts: organelles }}
      highlight={spec.highlight}
      testId="cell"
    />
  );
}
