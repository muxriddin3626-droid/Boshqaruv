"use client";

import { fmt, percent, type PopulationResult } from "@/lib/visuals/population";

import { VisualFrame } from "./VisualFrame";

const COLORS = { AA: "#22c55e", Aa: "#f59e0b", aa: "#ef4444" } as const;

/**
 * Xardi–Vaynberg: tomonlari p va q ga bo'lingan kvadrat — har bir kichik
 * to'rtburchak yuzi genotip ulushiga teng (p², pq, pq, q²). Jadval, belgilar va yechim.
 */
export default function PopulationDiagram({ result, traits }: { result: PopulationResult; traits: Record<string, string> }) {
  const { p, q } = result;
  const size = 200;
  const x0 = 34;
  const y0 = 26;
  const sp = size * p;
  const dominant = traits.A || traits.AA;
  const recessive = traits.a || traits.aa;
  const phenotype = (key: "AA" | "Aa" | "aa") =>
    key === "aa" ? recessive ?? "retsessiv belgi" : key === "Aa" ? `${dominant ?? "dominant belgi"} (tashuvchi)` : dominant ?? "dominant belgi";
  const cell = (x: number, y: number, w: number, h: number, key: "AA" | "Aa" | "aa", value: number, delay: number) => (
    <g key={`${key}${x}${y}`} className="visual-pop" style={{ animationDelay: `${delay}ms` }}>
      <rect x={x} y={y} width={Math.max(w, 0)} height={Math.max(h, 0)} fill={COLORS[key]} fillOpacity={0.8} stroke="#0b0f1a" strokeWidth={1.5} />
      {w > 34 && h > 26 && (
        <>
          <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
            {key}
          </text>
          <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fill="#fff">
            {fmt(value, 3)}
          </text>
        </>
      )}
    </g>
  );
  return (
    <VisualFrame
      title="Populyatsiya genetikasi (Xardi–Vaynberg)"
      caption={<p className="text-[11px] text-gray-400">p + q = 1 va p² + 2pq + q² = 1. Katta, erkin chatishadigan, tanlanish va mutatsiya bo&apos;lmagan populyatsiyada chastotalar avloddan avlodga o&apos;zgarmaydi.</p>}
    >
      <div className="space-y-3" data-testid="population">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300" data-testid="population-p">
            p (A) = <b>{fmt(p)}</b>
          </span>
          <span className="rounded-md bg-red-500/15 px-2 py-1 text-red-300" data-testid="population-q">
            q (a) = <b>{fmt(q)}</b>
          </span>
          {result.equilibrium && (
            <span className={`rounded-md px-2 py-1 text-xs ${result.equilibrium.holds ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`} data-testid="population-equilibrium">
              {result.equilibrium.holds ? "Muvozanatda ✓" : "Muvozanatda emas"} (χ² = {fmt(result.equilibrium.chiSquare, 2)})
            </span>
          )}
        </div>

        <svg viewBox="0 0 250 240" className="mx-auto w-full max-w-[300px]" role="img" aria-label="Genotiplar ulushi kvadrati" data-testid="population-square">
          {/* Tepada va chapda: gametalar (allellar) ulushi. */}
          <text x={x0 + sp / 2} y={18} textAnchor="middle" fontSize={11} fill="#86efac">A ({fmt(p, 3)})</text>
          <text x={x0 + sp + (size - sp) / 2} y={18} textAnchor="middle" fontSize={11} fill="#fca5a5">a ({fmt(q, 3)})</text>
          <text x={14} y={y0 + sp / 2} textAnchor="middle" fontSize={11} fill="#86efac" transform={`rotate(-90 14 ${y0 + sp / 2})`}>A</text>
          <text x={14} y={y0 + sp + (size - sp) / 2} textAnchor="middle" fontSize={11} fill="#fca5a5" transform={`rotate(-90 14 ${y0 + sp + (size - sp) / 2})`}>a</text>
          {cell(x0, y0, sp, sp, "AA", p * p, 0)}
          {cell(x0 + sp, y0, size - sp, sp, "Aa", p * q, 120)}
          {cell(x0, y0 + sp, sp, size - sp, "Aa", p * q, 240)}
          {cell(x0 + sp, y0 + sp, size - sp, size - sp, "aa", q * q, 360)}
        </svg>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="population-table">
            <thead className="text-gray-400">
              <tr>
                <th className="py-1 text-left font-normal">Genotip</th>
                <th className="py-1 pl-2 text-left font-normal">Fenotip</th>
                <th className="py-1 pl-2 text-right font-normal">Ulush</th>
                {result.total && <th className="py-1 pl-2 text-right font-normal">Soni</th>}
              </tr>
            </thead>
            <tbody>
              {result.genotypes.map((genotype) => (
                <tr key={genotype.key} className="border-t border-white/5 text-gray-200">
                  <td className="py-1 font-semibold" style={{ color: COLORS[genotype.key] }}>
                    {genotype.key} <span className="font-normal text-gray-500">{genotype.key === "AA" ? "p²" : genotype.key === "Aa" ? "2pq" : "q²"}</span>
                  </td>
                  <td className="py-1 pl-2 text-gray-300">{phenotype(genotype.key)}</td>
                  <td className="whitespace-nowrap py-1 pl-2 text-right">{percent(genotype.frequency)}</td>
                  {result.total && (
                    <td className="whitespace-nowrap py-1 pl-2 text-right">
                      {fmt(genotype.count!, 1)}
                      {genotype.observed !== null && <div className="text-[10px] text-gray-500">kuzatilgan: {genotype.observed}</div>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1" data-testid="population-steps">
          <div className="text-[11px] uppercase tracking-widest text-gray-400">Yechim</div>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-200">
            {result.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </VisualFrame>
  );
}
