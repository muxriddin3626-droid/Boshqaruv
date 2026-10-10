"use client";

import { useMemo } from "react";

import { phenotypeOf, punnett, ratioText, type PunnettInput } from "@/lib/visuals/punnett";

import { VisualFrame } from "./VisualFrame";

const PHENOTYPE_COLORS = ["bg-cyan-400/20 border-cyan-400/40", "bg-pink-400/20 border-pink-400/40", "bg-yellow-400/20 border-yellow-400/40", "bg-violet-400/20 border-violet-400/40"];
const PHENOTYPE_DOTS = ["bg-cyan-400", "bg-pink-400", "bg-yellow-400", "bg-violet-400"];

function Alleles({ text }: { text: string }) {
  return (
    <>
      {[...text].map((allele, i) => (
        <span key={i} className={allele === allele.toUpperCase() ? "text-neon-cyan" : "text-neon-pink"}>
          {allele}
        </span>
      ))}
    </>
  );
}

/** Genetik katak: gametalar, avlodlar (fenotip bo'yicha rangli) va nisbatlar — hammasi hisoblangan. */
export default function PunnettSquare({ input }: { input: PunnettInput }) {
  const result = useMemo(() => punnett(input), [input]);
  const phenotypeIndex = new Map(result.phenotypes.map((p, i) => [p.label, i]));
  // 4x4 katak telefonda sig'ishi uchun ixchamroq.
  const cellSize = result.gametes2.length > 2 ? "px-1 py-1 text-[11px]" : "px-2 py-1.5 text-sm";
  return (
    <VisualFrame
      title="Genetik katak (Punnett)"
      caption={
        <div className="space-y-1">
          <p>
            <b className="text-white">Genotiplar:</b> {result.genotypes.map((g) => g.label).join(" : ")} ={" "}
            <b className="text-white">{ratioText(result.genotypes.map((g) => g.count))}</b>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <b className="text-white">Fenotiplar ({ratioText(result.phenotypes.map((p) => p.count))}):</b>
            {result.phenotypes.map((p, i) => (
              <span key={p.label} className="inline-flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${PHENOTYPE_DOTS[i % PHENOTYPE_DOTS.length]}`} />
                {p.label} — {p.count}/{result.total}
              </span>
            ))}
          </p>
        </div>
      }
    >
      <p className="mb-2 text-center font-mono text-sm text-gray-200">
        P: <Alleles text={input.p1.replace(/[^A-Za-z]/g, "")} /> × <Alleles text={input.p2.replace(/[^A-Za-z]/g, "")} />
      </p>
      <div className="overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-0.5 font-mono" data-testid="punnett-grid">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-1 text-[10px] font-normal text-gray-500">♀ \ ♂</th>
              {result.gametes2.map((gamete) => (
                <th key={gamete} className={`rounded bg-white/5 font-bold ${cellSize}`}>
                  <Alleles text={gamete} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.gametes1.map((gamete, row) => (
              <tr key={gamete}>
                <th className={`rounded bg-white/5 font-bold ${cellSize}`}>
                  <Alleles text={gamete} />
                </th>
                {result.grid[row].map((genotype, col) => {
                  const color = PHENOTYPE_COLORS[(phenotypeIndex.get(phenotypeOf(genotype, input)) ?? 0) % PHENOTYPE_COLORS.length];
                  return (
                    <td
                      key={col}
                      className={`visual-pop rounded border text-center ${cellSize} ${color}`}
                      style={{ animationDelay: `${(row * result.gametes2.length + col) * 60}ms` }}
                    >
                      <Alleles text={genotype} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </VisualFrame>
  );
}
