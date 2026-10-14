"use client";

import { useMemo } from "react";

import { analyzeDna, type DnaInput } from "@/lib/visuals/dna";

import { VisualFrame } from "./VisualFrame";

const BASE_COLOR: Record<string, string> = {
  A: "text-green-400",
  T: "text-red-400",
  U: "text-orange-300",
  G: "text-yellow-300",
  C: "text-sky-400",
};

// Har kodon — alohida ustun (matritsa, bog'lar, kodlovchi, i-RNK, aminokislota ustma-ust).
// Ustunlar qatorga sig'masa pastga o'tadi — telefonda ham yonga surish kerak emas.
const ROWS = ["h-6", "h-4", "h-6", "h-4", "h-6", "h-7"];

function Triplet({ text }: { text: string }) {
  return (
    <>
      {[...text].map((base, i) => (
        <span key={i} className={BASE_COLOR[base]}>
          {base}
        </span>
      ))}
    </>
  );
}

function LabelColumn() {
  const labels = ["DNK matritsa", "", "DNK kodlovchi", "↓ transkripsiya", "i-RNK", "oqsil"];
  return (
    <div className="flex flex-col pr-1 text-right text-[9px] uppercase leading-none tracking-wide text-gray-500">
      {labels.map((label, i) => (
        <span key={i} className={`flex items-center justify-end ${ROWS[i]}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function CodonColumn({ template, coding, codon, amino, index }: { template: string; coding: string; codon: string; amino?: string; index: number }) {
  return (
    <div className="visual-pop flex w-[2.9rem] flex-col items-center font-mono" style={{ animationDelay: `${index * 90}ms` }}>
      <span className={`flex items-center text-sm font-bold ${ROWS[0]}`}>
        <Triplet text={template} />
      </span>
      <span className={`flex items-center text-xs leading-none text-gray-500 ${ROWS[1]}`}>
        {[...template].map((base) => (base === "A" || base === "T" ? "=" : "≡")).join("")}
      </span>
      <span className={`flex items-center text-sm font-bold ${ROWS[2]}`}>
        <Triplet text={coding} />
      </span>
      <span className={`flex items-center text-[10px] text-gray-500 ${ROWS[3]}`}>↓</span>
      <span className={`flex items-center text-sm font-bold ${ROWS[4]}`}>
        <Triplet text={codon} />
      </span>
      <span className={`flex items-center ${ROWS[5]}`}>
        {amino && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${amino === "STOP" ? "bg-red-500/20 text-red-300" : "bg-neon-violet/20 text-violet-200"}`}>
            {amino}
          </span>
        )}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-lg bg-white/5 px-2 py-1">
      {label}: <b className="text-white">{value}</b>
    </span>
  );
}

/** DNK qo'sh zanjiri, i-RNK, kodonlar va aminokislotalar + DTM hisoblari. */
export default function DnaDiagram({ input }: { input: DnaInput }) {
  const result = useMemo(() => analyzeDna(input), [input]);
  return (
    <VisualFrame
      title={input.kind === "mrna" ? "i-RNK va DNK" : "DNK → i-RNK → oqsil"}
      caption={
        <div className="flex flex-wrap gap-1.5" data-testid="dna-stats">
          <Stat label="Nukleotidlar (2 zanjir)" value={result.pairs * 2} />
          <Stat label="A = T" value={result.counts.A} />
          <Stat label="G = C" value={result.counts.G} />
          <Stat label="Vodorod bog'lari" value={result.hydrogenBonds} />
          <Stat label="Uzunlik" value={`${result.lengthNm.toString().replace(".", ",")} nm`} />
          <Stat label="Aminokislotalar" value={result.aminoAcids.filter((a) => a !== "STOP").length} />
        </div>
      }
    >
      <div className="flex flex-wrap gap-y-3" data-testid="dna-columns">
        <LabelColumn />
        {result.template.match(/.{1,3}/g)?.map((triplet, i) => (
          <CodonColumn
            key={i}
            index={i}
            template={triplet}
            coding={result.coding.slice(i * 3, i * 3 + 3)}
            codon={result.mrna.slice(i * 3, i * 3 + 3)}
            amino={result.aminoAcids[i]}
          />
        ))}
      </div>
      {/* Ekran o'quvchilar uchun ketma-ketlik matn ko'rinishida. */}
      <p className="sr-only" data-testid="dna-mrna">
        i-RNK: {result.mrna}
      </p>
      <p className="sr-only" data-testid="dna-amino">
        Aminokislotalar: {result.aminoAcids.join(" ")}
      </p>
    </VisualFrame>
  );
}
