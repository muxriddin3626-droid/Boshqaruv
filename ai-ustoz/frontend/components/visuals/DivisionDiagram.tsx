"use client";

import { useEffect, useRef, useState } from "react";

import { CHROMATIDS, finalCellLabels, matchStage, type DivisionResult, type Scene } from "@/lib/visuals/division";

import { VisualFrame } from "./VisualFrame";

const STEP_MS = 2600;
const MOVE = "transform 1.1s cubic-bezier(.5,.05,.3,1), opacity .8s ease";

/** Hujayra/yadro: birlik doira masshtablanadi — CSS transform bilan silliq o'zgaradi (rx/ry atributlari animatsiya qilinmaydi). */
function Blob({ shape, fill, stroke, dashed }: { shape: { cx: number; cy: number; rx: number; ry: number } | null; fill: string; stroke: string; dashed?: boolean }) {
  const visible = shape !== null;
  const s = shape ?? { cx: 160, cy: 100, rx: 1, ry: 1 };
  return (
    <g style={{ transform: `translate(${s.cx}px, ${s.cy}px) scale(${s.rx}, ${s.ry})`, opacity: visible ? 1 : 0, transition: MOVE }} className="division-move">
      <circle r={1} fill={fill} stroke={stroke} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeDasharray={dashed ? "4 3" : undefined} />
    </g>
  );
}

function SceneView({ scene, labels }: { scene: Scene; labels: string[] | null }) {
  const cells = [0, 1, 2, 3].map((i) => scene.cells[i] ?? null);
  // Yo'qolayotgan hujayra birinchi hujayra ichiga "yig'iladi" — keyin undan ajralib chiqqandek ko'rinadi.
  const fallback = scene.cells[0];
  return (
    <svg viewBox="0 0 320 200" className="mx-auto w-full max-w-md" role="img" aria-label="Hujayra bo'linishi bosqichi" data-testid="division-scene">
      {cells.map((cell, i) => (
        <g key={`cell${i}`} style={{ opacity: cell ? 1 : 0, transition: "opacity .6s" }}>
          <Blob shape={cell ?? (fallback ? { ...fallback } : null)} fill="rgba(244,114,182,0.06)" stroke="#f472b6" />
        </g>
      ))}
      {[0, 1].map((i) => {
        const nucleus = scene.nuclei[i] ?? null;
        return (
          <Blob
            key={`nuc${i}`}
            shape={nucleus ? { cx: nucleus.cx, cy: nucleus.cy, rx: nucleus.r, ry: nucleus.r } : null}
            fill="rgba(168,85,247,0.12)"
            stroke="#a855f7"
            dashed={nucleus?.dashed}
          />
        );
      })}
      <g style={{ opacity: scene.chromatin ? 0.9 : 0, transition: "opacity .8s" }} fill="none" stroke="#c084fc" strokeWidth={1.2} strokeLinecap="round">
        <path d="M128 92 q8 -12 16 -2 t14 4 t12 -8 M134 108 q10 8 18 -2 t16 6 M150 80 q6 10 14 4 t14 6 M140 118 q12 -6 20 2 t18 -4" />
      </g>
      {/* Urchuq iplari va sentrosomalar: har bosqichda qayta "o'sib" chiqadi. */}
      {scene.spindles.map((spindle, si) => (
        <g key={`sp${si}-${spindle.pole.join(",")}-${spindle.targets.length}`} className="visual-pop" stroke="rgba(226,232,240,0.45)" strokeWidth={0.8}>
          {spindle.targets.map(([x, y]) => (
            <line key={`${x},${y}`} x1={spindle.pole[0]} y1={spindle.pole[1]} x2={x} y2={y} />
          ))}
          <circle cx={spindle.pole[0]} cy={spindle.pole[1]} r={3} fill="#fde68a" stroke="none" />
        </g>
      ))}
      {CHROMATIDS.map((chromatid) => {
        const p = scene.chromatids[chromatid.id];
        return (
          <g
            key={chromatid.id}
            className="division-move"
            style={{ transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.scale ?? 1})`, opacity: p.opacity ?? 1, transition: MOVE }}
            data-chromatid={chromatid.id}
          >
            <rect x={-4} y={-chromatid.length / 2} width={8} height={chromatid.length} rx={4} fill={chromatid.color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
            <circle r={2.8} fill="#fde68a" />
          </g>
        );
      })}
      {labels &&
        scene.cells.map((cell, i) =>
          cell ? (
            <text key={`lab${i}`} x={cell.cx} y={Math.min(196, cell.cy + cell.ry + 11)} textAnchor="middle" fontSize={10} fill="#e5e7eb" className="visual-pop">
              {labels[i]}
            </text>
          ) : null,
        )}
    </svg>
  );
}

/** Mitoz / meyoz: bosqichlar animatsiyasi (2n = 4 modelida), har bosqichdagi n va c (berilgan 2n uchun), natija. */
export default function DivisionDiagram({ result, scenes }: { result: DivisionResult; scenes: Record<string, Scene> }) {
  const { stages, input } = result;
  const highlighted = matchStage(stages, input.stage);
  const [index, setIndex] = useState(() => Math.max(0, stages.findIndex((s) => s.id === highlighted)));
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Ekranga chiqqanda bir marta o'zi boshidan oxirigacha o'ynaydi (aniq bosqich so'ralgan bo'lsa — o'sha bosqichda turadi).
  useEffect(() => {
    const node = ref.current;
    if (!node || highlighted || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !started.current) {
        started.current = true;
        setPlaying(true);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [highlighted]);

  useEffect(() => {
    if (!playing) return;
    if (index >= stages.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, stages.length]);

  const stage = stages[index];
  const isLast = index === stages.length - 1;
  const title = input.type === "mitoz" ? "Mitoz" : input.sex === "erkak" ? "Meyoz (spermatogenez)" : input.sex === "urgochi" ? "Meyoz (ovogenez)" : "Meyoz";
  const organism = input.organism ? ` — ${input.organism}` : "";

  return (
    <VisualFrame
      title={`${title}${organism}, 2n = ${input.diploid}`}
      caption={
        <p className="text-[11px] text-gray-400">
          Chizmada soddalik uchun 2n = 4: ikki juft gomologik xromosoma (<span className="text-red-400">qizil</span> — onadan,{" "}
          <span className="text-blue-400">ko&apos;k</span> — otadan). Jadvaldagi sonlar 2n = {input.diploid} uchun hisoblangan.
        </p>
      }
    >
      <div ref={ref} className="space-y-3" data-testid="division">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" data-testid="division-stages">
          {stages.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
                i === index ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 text-gray-400 hover:text-gray-200"
              }`}
            >
              {s.id === highlighted ? "★ " : ""}
              {s.name.replace(" (S davridan keyin)", "")}
            </button>
          ))}
        </div>

        <SceneView scene={scenes[stage.id]} labels={isLast ? finalCellLabels(input.type, input.sex) : null} />

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white" data-testid="division-stage-name">
            {stage.name} <span className="ml-1 rounded bg-neon-cyan/15 px-1.5 py-0.5 font-mono text-xs text-neon-cyan">{stage.formula}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (isLast) setIndex(0);
                setPlaying(true);
              }
            }}
            className="shrink-0 whitespace-nowrap rounded-full border border-neon-cyan/40 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/10"
            data-testid="division-play"
          >
            {playing ? "❚❚ To'xtatish" : isLast ? "↺ Qaytadan" : "▶ Davom"}
          </button>
        </div>
        <div className="-mt-1.5 text-xs text-gray-300" data-testid="division-counts">
          {stage.chromosomes} ta xromosoma ({stage.chromatids} xromatidli), {stage.dna} ta DNK molekulasi{stage.note ? ` — ${stage.note}` : ""}
        </div>
        <p className="text-xs leading-relaxed text-gray-300">{stage.description}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px]" data-testid="division-table">
            <thead className="text-gray-400">
              <tr>
                <th className="py-1 text-left font-normal">Bosqich</th>
                <th className="py-1 pl-1.5 text-right font-normal">n, c</th>
                <th className="whitespace-nowrap py-1 pl-1.5 text-right font-normal">Xromosoma</th>
                <th className="py-1 pl-1.5 text-right font-normal">DNK</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => {
                    setPlaying(false);
                    setIndex(i);
                  }}
                  className={`cursor-pointer border-t border-white/5 ${i === index ? "bg-neon-cyan/10 text-neon-cyan" : "text-gray-200"}`}
                >
                  <td className="whitespace-nowrap py-1">
                    {s.id === highlighted ? "★ " : ""}
                    {s.name.replace(" (S davridan keyin)", "")}
                    {s.note === "butun hujayrada" && <sup className="text-gray-500">*</sup>}
                  </td>
                  <td className="py-1 pl-1.5 text-right">{s.formula}</td>
                  <td className="py-1 pl-1.5 text-right">{s.chromosomes}</td>
                  <td className="py-1 pl-1.5 text-right">{s.dna}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-gray-500">
            * anafazada — bo&apos;linayotgan butun hujayrada; telofazadan keyingi bosqichlarda — har bir hosil bo&apos;lgan hujayrada.
          </p>
        </div>

        <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-200" data-testid="division-outcome">
          <div className="text-[11px] uppercase tracking-widest text-gray-400">Natija</div>
          {result.outcome.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {result.gameteVariants && (
            <p>
              Mustaqil taqsimlanish hisobiga gametalar xillari (krossingoversiz): <b className="text-neon-cyan">{result.gameteVariants}</b>
            </p>
          )}
        </div>
      </div>
    </VisualFrame>
  );
}
