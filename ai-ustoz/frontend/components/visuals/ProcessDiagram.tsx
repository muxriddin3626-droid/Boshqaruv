"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { fmt, type ProcessResult } from "@/lib/visuals/process";

import ChemEquation from "./ChemEquation";
import { VisualFrame } from "./VisualFrame";

const STEP_MS = 4200;

function useMotion(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return ok;
}

/** Joriy bosqich elementi — to'liq; o'tgan bosqichniki — xira; kelgusiniki — ko'rinmaydi. */
function Phase({ stage, at, children }: { stage: number; at: number; children: ReactNode }) {
  const opacity = stage === at ? 1 : stage > at ? 0.28 : 0;
  return <g style={{ opacity, transition: "opacity .7s ease" }}>{children}</g>;
}

function Hexagon({ x, y, r, label, fill, sub }: { x: number; y: number; r: number; label: string; fill: string; sub?: string }) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={points} fill={fill} stroke="rgba(0,0,0,0.45)" strokeWidth={1} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={r * 0.7} fontWeight={700} fill="#fff">
        {label}
      </text>
      {sub && (
        <text x={x} y={y + r + 10} textAnchor="middle" fontSize={8.5} fill="#e5e7eb">
          {sub}
        </text>
      )}
    </g>
  );
}

function Badge({ x, y, text, color = "#22d3ee" }: { x: number; y: number; text: string; color?: string }) {
  const w = text.length * 5.6 + 12;
  return (
    <g className="visual-pop">
      <rect x={x - w / 2} y={y - 9} width={w} height={17} rx={8.5} fill="rgba(11,15,26,0.85)" stroke={color} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={color}>
        {text}
      </text>
    </g>
  );
}

function Arrow({ d, color = "rgba(226,232,240,0.7)" }: { d: string; color?: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={1.4} markerEnd="url(#process-arrow)" />;
}

/** Harakatlanuvchi zarracha (gaz pufakchasi, elektron, ATF) — SMIL; harakat o'chirilgan bo'lsa ko'rsatilmaydi. */
function Mover({ path, motion, dur = 3, delay = 0, r = 3.2, fill, label }: { path: string; motion: boolean; dur?: number; delay?: number; r?: number; fill: string; label?: string }) {
  if (!motion) return null;
  return (
    <g opacity={0}>
      <circle r={r} fill={fill} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      {label && (
        <text y={-r - 2} textAnchor="middle" fontSize={7} fill={fill}>
          {label}
        </text>
      )}
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </g>
  );
}

function Cycle({ x, y, r, label, color }: { x: number; y: number; r: number; label: string; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="rgba(0,0,0,0.15)" stroke={color} strokeWidth={1.2} strokeDasharray="3 3" />
      <g className="process-spin" style={{ transformOrigin: `${x}px ${y}px` }}>
        <path d={`M${x + r} ${y} A${r} ${r} 0 0 1 ${x - r * 0.5} ${y + r * 0.866}`} fill="none" stroke={color} strokeWidth={2.4} markerEnd="url(#process-arrow-c)" />
        <circle cx={x} cy={y} r={r} fill="none" stroke="transparent" />
      </g>
      <text x={x} y={y + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff">
        {label}
      </text>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="process-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0 0 L10 5 L0 10 Z" fill="rgba(226,232,240,0.8)" />
      </marker>
      <marker id="process-arrow-c" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0 L10 5 L0 10 Z" fill="#fde047" />
      </marker>
    </defs>
  );
}

function Mitochondrion() {
  const folds = [168, 190, 212, 234, 256, 278].map((x, i) => {
    const top = i % 2 === 0;
    const y0 = top ? 72 : 148;
    const depth = top ? 30 : -30;
    return <path key={x} d={`M${x - 6} ${y0} L${x - 6} ${y0 + depth} Q${x} ${y0 + depth * 1.25} ${x + 6} ${y0 + depth} L${x + 6} ${y0}`} fill="none" stroke="#fb923c" strokeWidth={1.4} />;
  });
  return (
    <g>
      <ellipse cx={222} cy={110} rx={90} ry={58} fill="rgba(251,146,60,0.14)" stroke="#fb923c" strokeWidth={2} />
      <ellipse cx={222} cy={110} rx={80} ry={48} fill="rgba(254,215,170,0.08)" stroke="#fb923c" strokeWidth={1.2} />
      {folds}
      <text x={222} y={46} textAnchor="middle" fontSize={9} fill="#fdba74">
        Mitoxondriya
      </text>
    </g>
  );
}

function RespirationScene({ stage, motion }: { stage: number; motion: boolean }) {
  return (
    <>
      <rect x={4} y={4} width={312} height={192} rx={22} fill="rgba(244,114,182,0.05)" stroke="#f472b6" strokeWidth={1.4} />
      <text x={16} y={22} fontSize={9} fill="#f9a8d4">Sitoplazma</text>
      <Mitochondrion />
      <Phase stage={stage} at={0}>
        <Hexagon x={62} y={66} r={17} label="C₆" fill="#a855f7" sub="glyukoza" />
        <Arrow d="M62 94 L46 116" />
        <Arrow d="M62 94 L80 116" />
        <Hexagon x={42} y={130} r={11} label="C₃" fill="#6366f1" />
        <Hexagon x={84} y={130} r={11} label="C₃" fill="#6366f1" sub="2 PVK" />
        {stage === 0 && <Badge x={62} y={172} text="+2 ATF" />}
      </Phase>
      <Phase stage={stage} at={1}>
        <Arrow d="M98 128 Q130 118 158 108" />
        <Cycle x={200} y={100} r={22} label="Krebs" color="#fde047" />
        <Mover path="M200 78 C204 50 214 30 226 6" motion={motion} dur={2.8} fill="#e5e7eb" label="CO₂" />
        <Mover path="M188 84 C180 52 170 32 160 6" motion={motion} dur={2.8} delay={1.4} fill="#e5e7eb" label="CO₂" />
        <Mover path="M218 112 Q240 130 262 128" motion={motion} dur={2.2} fill="#86efac" label="NAD·H₂" />
        {stage === 1 && <Badge x={200} y={140} text="+2 ATF" />}
      </Phase>
      <Phase stage={stage} at={2}>
        <Arrow d="M300 18 L272 64" color="#93c5fd" />
        <text x={302} y={16} fontSize={9} fill="#93c5fd" textAnchor="end">O₂</text>
        <Mover path="M162 74 L162 104 L184 104 L184 116 L206 116 L206 104 L228 104 L228 116 L250 116 L250 104 L272 104" motion={motion} dur={3.2} fill="#fde047" r={2.6} label="e⁻" />
        <Mover path="M162 74 L162 104 L184 104 L184 116 L206 116 L206 104 L228 104 L228 116 L250 116 L250 104 L272 104" motion={motion} dur={3.2} delay={1.6} fill="#fde047" r={2.6} />
        <g fill="#38bdf8">
          <path d="M282 140 q6 8 0 14 q-6 -6 0 -14 Z" />
        </g>
        <text x={292} y={164} fontSize={9} fill="#7dd3fc" textAnchor="middle">H₂O</text>
        {[176, 222, 268].map((x) => (
          <g key={x}>
            <line x1={x} y1={152} x2={x} y2={162} stroke="#fde047" strokeWidth={2} />
            <circle cx={x} cy={165} r={4} fill="#fde047" />
          </g>
        ))}
        {stage === 2 && <Badge x={222} y={182} text="+34 ATF" color="#fde047" />}
      </Phase>
    </>
  );
}

function PhotosynthesisScene({ stage, motion }: { stage: number; motion: boolean }) {
  const grana = [70, 104, 138].map((x) => (
    <g key={x}>
      {[0, 1, 2, 3, 4].map((k) => (
        <rect key={k} x={x - 13} y={88 + k * 8} width={26} height={6.5} rx={3.2} fill="#16a34a" stroke="#14532d" strokeWidth={0.6} />
      ))}
    </g>
  ));
  return (
    <>
      <ellipse cx={165} cy={105} rx={150} ry={86} fill="rgba(34,197,94,0.10)" stroke="#22c55e" strokeWidth={2} />
      <ellipse cx={165} cy={105} rx={142} ry={78} fill="none" stroke="#22c55e" strokeWidth={0.8} />
      <path d="M83 108 L91 108 M117 108 L125 108" stroke="#15803d" strokeWidth={2} />
      {grana}
      <text x={104} y={140} textAnchor="middle" fontSize={8.5} fill="#86efac">Granalar (tilakoidlar)</text>
      <text x={238} y={40} textAnchor="middle" fontSize={8.5} fill="#86efac">Stroma</text>
      <Phase stage={stage} at={0}>
        <circle cx={24} cy={24} r={13} fill="#facc15" />
        {[[70, 86], [104, 86], [138, 86]].map(([x, y]) => (
          <line key={x} x1={34} y1={32} x2={x} y2={y} stroke="#fde047" strokeWidth={1.6} className="process-ray" />
        ))}
        <Arrow d="M30 186 L62 150" color="#7dd3fc" />
        <text x={24} y={182} fontSize={9} fill="#7dd3fc">H₂O</text>
        <Mover path="M96 86 C90 60 80 40 70 8" motion={motion} dur={2.6} fill="#bfdbfe" label="O₂" />
        <Mover path="M112 86 C112 60 118 40 124 8" motion={motion} dur={2.6} delay={1.3} fill="#bfdbfe" label="O₂" />
        <Mover path="M150 104 L226 104" motion={motion} dur={2} fill="#22d3ee" label="ATF" />
        <Mover path="M150 116 L226 112" motion={motion} dur={2} delay={1} fill="#f0abfc" label="NADF·H₂" />
        {stage === 0 && <Badge x={196} y={170} text="ATF + NADF·H₂ hosil bo'ladi" />}
      </Phase>
      <Phase stage={stage} at={1}>
        <Cycle x={238} y={104} r={26} label="Kalvin" color="#fde047" />
        <Arrow d="M314 70 L268 92" color="#e5e7eb" />
        <text x={312} y={64} fontSize={9} fill="#e5e7eb" textAnchor="end">CO₂</text>
        <Arrow d="M246 132 L258 150" />
        <Hexagon x={266} y={162} r={14} label="C₆" fill="#a855f7" sub="glyukoza" />
      </Phase>
    </>
  );
}

function FermentationScene({ stage, motion, alcohol }: { stage: number; motion: boolean; alcohol: boolean }) {
  return (
    <>
      <rect x={4} y={4} width={312} height={192} rx={22} fill="rgba(244,114,182,0.05)" stroke="#f472b6" strokeWidth={1.4} />
      <text x={16} y={22} fontSize={9} fill="#f9a8d4">Sitoplazma (kislorodsiz)</text>
      <Phase stage={stage} at={0}>
        <Hexagon x={90} y={62} r={17} label="C₆" fill="#a855f7" sub="glyukoza" />
        <Arrow d="M90 90 L72 112" />
        <Arrow d="M90 90 L108 112" />
        <Hexagon x={68} y={126} r={11} label="C₃" fill="#6366f1" />
        <Hexagon x={112} y={126} r={11} label="C₃" fill="#6366f1" sub="2 PVK" />
        <Badge x={90} y={172} text="+2 ATF" />
      </Phase>
      <Phase stage={stage} at={1}>
        <Arrow d="M128 118 L196 86" />
        <Arrow d="M128 132 L196 146" />
        {alcohol ? (
          <>
            <Hexagon x={222} y={80} r={13} label="C₂" fill="#0ea5e9" sub="etil spirt" />
            <Hexagon x={222} y={146} r={13} label="C₂" fill="#0ea5e9" sub="etil spirt" />
            <Mover path="M250 80 C262 56 270 36 280 8" motion={motion} dur={2.6} fill="#e5e7eb" label="CO₂" />
            <Mover path="M250 146 C270 110 286 60 296 8" motion={motion} dur={3} delay={1.2} fill="#e5e7eb" label="CO₂" />
          </>
        ) : (
          <>
            <Hexagon x={222} y={80} r={13} label="C₃" fill="#ec4899" sub="sut kislota" />
            <Hexagon x={222} y={146} r={13} label="C₃" fill="#ec4899" sub="sut kislota" />
          </>
        )}
      </Phase>
    </>
  );
}


/** Fotosintez / nafas olish / bijg'ish: bosqichlar animatsiyasi, ATF hisobi, energiya va moddalar miqdori. */
export default function ProcessDiagram({ result }: { result: ProcessResult }) {
  const motion = useMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const { stages } = result;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !started.current) {
        started.current = true;
        setPlaying(true);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
  const atpSoFar = stages.slice(0, index + 1).reduce((sum, s) => sum + s.atp, 0);
  const isLast = index === stages.length - 1;
  const storedShare = result.atpPerMol ? (result.atpPerMol * 40) / result.energyPerMol : 1;
  const calc = result.calc;

  return (
    <VisualFrame title={result.title}>
      <div ref={ref} className="space-y-3" data-testid="process">
        <ChemEquation text={result.equation} testId="process-equation" />
        <div className="flex items-center gap-2">
          <div className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-1" data-testid="process-stages">
            {stages.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${i === index ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 text-gray-400"}`}
              >
                {i + 1}. {s.name.replace(/ \(.*\)$/, "")}
              </button>
            ))}
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
            className="shrink-0 whitespace-nowrap rounded-full border border-neon-cyan/40 px-3 py-1 text-xs text-neon-cyan"
            data-testid="process-play"
          >
            {playing ? "❚❚" : isLast ? "↺" : "▶"}
          </button>
        </div>

        <div className="relative">
          <svg viewBox="0 0 320 200" className="mx-auto w-full max-w-md" role="img" aria-label={`${result.title}: ${stage.name}`} data-testid="process-scene">
            <Defs />
            {result.kind === "nafas" && <RespirationScene stage={index} motion={motion} />}
            {result.kind === "fotosintez" && <PhotosynthesisScene stage={index} motion={motion} />}
            {(result.kind === "sut_bijgish" || result.kind === "spirt_bijgish") && (
              <FermentationScene stage={index} motion={motion} alcohol={result.kind === "spirt_bijgish"} />
            )}
          </svg>
          {result.atpPerMol > 0 && (
            <div className="absolute bottom-1 left-1 rounded-lg border border-neon-cyan/40 bg-black/60 px-2 py-0.5 text-xs text-neon-cyan" data-testid="process-atp">
              ATF: <b>{atpSoFar}</b> / {result.atpPerMol}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold text-white" data-testid="process-stage-name">
            {stage.name}
            {stage.atp > 0 && <span className="ml-2 text-xs text-neon-cyan">+{stage.atp} ATF</span>}
          </div>
          <div className="text-[11px] text-gray-400">📍 {stage.place}</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-300">{stage.description}</p>
        </div>

        {result.atpPerMol > 0 && (
          <div className="space-y-1" data-testid="process-energy">
            <div className="text-[11px] uppercase tracking-widest text-gray-400">1 mol glyukozaga energiya</div>
            <div className="flex h-4 overflow-hidden rounded-full text-[10px] font-semibold">
              <div className="flex items-center justify-center bg-cyan-500/70 text-black" style={{ width: `${storedShare * 100}%` }}>
                ATF: {result.atpPerMol * 40} kJ
              </div>
              <div className="flex flex-1 items-center justify-center bg-orange-500/60 text-black">issiqlik: {result.energyPerMol - result.atpPerMol * 40} kJ</div>
            </div>
            <p className="text-[11px] text-gray-400">
              Jami {result.energyPerMol} kJ ajraladi, {result.atpPerMol} ATF × 40 kJ = {result.atpPerMol * 40} kJ ({fmt(storedShare * 100, 0)}%) to&apos;planadi.
            </p>
          </div>
        )}

        {calc && (
          <div className="space-y-2" data-testid="process-calc">
            <div className="text-[11px] uppercase tracking-widest text-gray-400">Masala yechimi</div>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-200">
              {calc.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-400">
                  <tr>
                    <th className="py-1 text-left font-normal">Modda</th>
                    <th className="py-1 pl-2 text-right font-normal">n, mol</th>
                    <th className="py-1 pl-2 text-right font-normal">m, g</th>
                    <th className="py-1 pl-2 text-right font-normal">V, l</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map((row) => (
                    <tr key={row.formula} className="border-t border-white/5 text-gray-200">
                      <td className="py-1">
                        {row.name} <span className="text-gray-500">{row.side === "in" ? "(sarflanadi)" : "(hosil bo'ladi)"}</span>
                      </td>
                      <td className="py-1 pl-2 text-right">{fmt(row.mol)}</td>
                      <td className="py-1 pl-2 text-right">{fmt(row.mass)}</td>
                      <td className="py-1 pl-2 text-right">{row.volume !== null ? fmt(row.volume) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-500">Gaz hajmi normal sharoitda (22,4 l/mol); qiymatlar maktab darsligidagidek (2800 kJ, 1 ATF = 40 kJ).</p>
          </div>
        )}
      </div>
    </VisualFrame>
  );
}
