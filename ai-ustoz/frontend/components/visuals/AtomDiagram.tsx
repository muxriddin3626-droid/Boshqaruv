"use client";

import { useMemo } from "react";

import { atom, type AtomResult, type Subshell } from "@/lib/visuals/atom";

import { VisualFrame } from "./VisualFrame";

const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };

function chargeText(charge: number): string {
  if (!charge) return "";
  return `${Math.abs(charge) === 1 ? "" : Math.abs(charge)}${charge > 0 ? "+" : "−"}`;
}

function BohrModel({ result }: { result: AtomResult }) {
  const shells = result.shells;
  const size = 60 + shells.length * 36;
  const center = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[220px]" role="img" aria-label={`${result.name} atomi: ${shells.join(", ")}`}>
      {shells.map((count, i) => {
        const radius = 30 + i * 18;
        return (
          <g key={i} className="visual-pop" style={{ animationDelay: `${i * 250}ms` }}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth={1} />
            <g className="atom-orbit" style={{ transformOrigin: `${center}px ${center}px`, animationDuration: `${16 + i * 8}s` }}>
              {Array.from({ length: count }, (_, k) => {
                const angle = (2 * Math.PI * k) / count - Math.PI / 2;
                return <circle key={k} cx={center + radius * Math.cos(angle)} cy={center + radius * Math.sin(angle)} r={3.2} fill="#f472b6" />;
              })}
            </g>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={20} fill="rgba(168,85,247,0.35)" stroke="#a855f7" />
      <text x={center} y={center - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
        {result.symbol}
      </text>
      <text x={center} y={center + 11} textAnchor="middle" fontSize={8} fill="#e9d5ff">
        +{result.z}
      </text>
    </svg>
  );
}

function OrbitalBoxes({ subshell }: { subshell: Subshell }) {
  const boxes = CAPACITY[subshell.name[1]] / 2;
  // Xund qoidasi: avval har katakka bittadan (↑), keyin juftlanadi (↓).
  const up = Math.min(subshell.electrons, boxes);
  const down = subshell.electrons - up;
  return (
    <div className="flex items-center gap-1">
      <span className="w-6 text-right font-mono text-[11px] text-gray-400">{subshell.name}</span>
      <div className="flex">
        {Array.from({ length: boxes }, (_, i) => (
          <span key={i} className="flex h-6 w-6 items-center justify-center border border-gray-500 font-mono text-xs leading-none text-neon-cyan">
            {i < up ? "↑" : ""}
            {i < down ? "↓" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function AtomCard({ species }: { species: string }) {
  const result = useMemo(() => atom(species), [species]);
  const maxN = Math.max(...result.configuration.map((s) => Number(s.name[0])));
  const last = result.configuration[result.configuration.length - 1];
  const valence = result.configuration.filter((s) => Number(s.name[0]) === maxN || s === last);
  return (
    <div className="space-y-2" data-testid="atom-card">
      <p className="text-center text-sm">
        <b className="text-white">
          {result.name} {result.symbol}
          {result.charge ? <sup>{chargeText(result.charge)}</sup> : null}
        </b>{" "}
        <span className="text-xs text-gray-400">
          Z = {result.z}, {result.electrons} e⁻, {result.period}-davr
        </span>
      </p>
      <BohrModel result={result} />
      <p className="text-center text-xs text-gray-400">
        Qavatlar: <b className="text-white">{result.shells.join(", ")}</b>
      </p>
      <p className="text-center font-mono text-xs text-gray-200" data-testid="atom-config">
        {result.configuration.map((s) => (
          <span key={s.name} className="mr-1">
            {s.name}
            <sup>{s.electrons}</sup>
          </span>
        ))}
      </p>
      <div className="flex flex-col items-center gap-1">
        {valence.map((s) => (
          <OrbitalBoxes key={s.name} subshell={s} />
        ))}
      </div>
    </div>
  );
}

/** Atom (yoki ion) tuzilishi: Bor modeli, elektron konfiguratsiya va valent orbitallar. */
export default function AtomDiagram({ species }: { species: string[] }) {
  return (
    <VisualFrame title="Atom tuzilishi" caption="Qavatlardagi elektronlar soni, elektron formula va valent orbitallar (Xund qoidasi).">
      <div className={`grid gap-4 ${species.length > 1 ? "sm:grid-cols-2" : ""} ${species.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {species.map((item) => (
          <AtomCard key={item} species={item} />
        ))}
      </div>
    </VisualFrame>
  );
}
