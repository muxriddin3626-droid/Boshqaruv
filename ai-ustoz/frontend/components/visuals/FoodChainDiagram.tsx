"use client";

import { useEffect, useState } from "react";

import { formatValue, type ChainResult } from "@/lib/visuals/ecology";

import { VisualFrame } from "./VisualFrame";

const TIER = 40;
const WIDTH = 320;
const COLORS = ["#16a34a", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#be123c", "#9d174d"];

function usePrefersMotion(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return ok;
}

/** Oziq zanjiri: ekologik piramida (pastda produtsent), har bo'g'in qiymati, 10% qoidasi va masala yechimi. */
export default function FoodChainDiagram({ result }: { result: ChainResult }) {
  const motion = usePrefersMotion();
  const levels = result.levels;
  const count = levels.length;
  const height = count * TIER + 16;
  const bottomWidth = 290;
  const topWidth = 112;
  const widthAt = (i: number) => bottomWidth - ((bottomWidth - topWidth) * i) / Math.max(1, count - 1);
  const yOf = (i: number) => height - 8 - (i + 1) * TIER;
  const percent = formatValue(result.percent);
  const lost = formatValue(100 - result.percent);

  return (
    <VisualFrame
      title="Oziq zanjiri va ekologik piramida"
      caption={
        <p className="text-[11px] text-gray-400">
          Har bir keyingi bo&apos;g&apos;inga energiyaning (massaning) taxminan {percent}% i o&apos;tadi, qolgan ~{lost}% i
          nafas olish va issiqlik sifatida sarflanadi (Lindeman qoidasi). Shuning uchun zanjir uzun bo&apos;lmaydi.
        </p>
      }
    >
      <div className="space-y-3" data-testid="food-chain">
        <div className="flex flex-wrap items-center gap-1 text-xs" data-testid="food-chain-row">
          {levels.map((level, i) => (
            <span key={level.index} className="flex items-center gap-1">
              {i > 0 && <span className="text-neon-cyan">→</span>}
              <span className={`rounded-full border px-2 py-0.5 ${level.index === result.givenIndex ? "border-neon-cyan text-neon-cyan" : "border-white/10 text-gray-200"}`}>
                {level.icon} {level.name}
              </span>
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="mx-auto w-full max-w-md" role="img" aria-label="Ekologik piramida" data-testid="food-pyramid">
          {levels.map((level, i) => {
            const y = yOf(i);
            const wBottom = widthAt(i);
            const wTop = i === count - 1 ? wBottom * 0.72 : widthAt(i + 1);
            const cx = WIDTH / 2;
            const given = level.index === result.givenIndex;
            return (
              <g key={level.index} className="visual-pop" style={{ animationDelay: `${i * 140}ms` }}>
                <path
                  d={`M${cx - wBottom / 2} ${y + TIER} L${cx + wBottom / 2} ${y + TIER} L${cx + wTop / 2} ${y + 2} L${cx - wTop / 2} ${y + 2} Z`}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.85}
                  stroke={given ? "#22d3ee" : "rgba(0,0,0,0.4)"}
                  strokeWidth={given ? 2.2 : 1}
                />
                <text x={cx} y={y + 17} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                  {level.icon} {level.name}
                  {level.value !== null ? ` — ${formatValue(level.value)}${result.unit ? ` ${result.unit}` : ""}` : ""}
                </text>
                <text x={cx} y={y + 31} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)">
                  {level.role}
                </text>
              </g>
            );
          })}
          {/* Energiya oqimi: pastdan yuqoriga ko'tarilgan sari kichrayadigan nuqtalar. */}
          {motion &&
            [0, 1, 2].map((k) => (
              <circle key={k} r={5} fill="#fde047" opacity={0}>
                <animateMotion dur="3.6s" begin={`${k * 1.2}s`} repeatCount="indefinite" path={`M${WIDTH / 2 - 70 + k * 70} ${height - 12} L${WIDTH / 2 - 70 + k * 70 * 0.5 + 35} ${yOf(count - 1) + 8}`} />
                <animate attributeName="r" values="6;1.2" dur="3.6s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.95;0.15" dur="3.6s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
              </circle>
            ))}
        </svg>

        {result.steps.length > 0 && (
          <div className="space-y-1" data-testid="food-chain-steps">
            <div className="text-[11px] uppercase tracking-widest text-gray-400">Masala yechimi</div>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-200">
              {result.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </VisualFrame>
  );
}
