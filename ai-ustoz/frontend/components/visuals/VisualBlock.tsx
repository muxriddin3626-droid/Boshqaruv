"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { atom } from "@/lib/visuals/atom";
import { parseAtoms, parseCell, parseDna, parseIllustration, parseMolecules, parsePunnett } from "@/lib/visuals/blocks";
import { analyzeDna } from "@/lib/visuals/dna";
import { punnett } from "@/lib/visuals/punnett";

import MermaidDiagram from "../chat/MermaidDiagram";
import AtomDiagram from "./AtomDiagram";
import CellDiagram from "./CellDiagram";
import DnaDiagram from "./DnaDiagram";
import Illustration from "./Illustration";
import PunnettSquare from "./PunnettSquare";
import { VisualBoundary, VisualError, VisualPlaceholder } from "./VisualFrame";

// smiles-drawer og'ir — faqat molekula chizilganda yuklanadi.
const MoleculeDiagram = dynamic(() => import("./MoleculeDiagram"), { ssr: false, loading: () => <VisualPlaceholder /> });

function parse(language: string, source: string) {
  switch (language) {
    case "smiles":
      return { kind: "smiles" as const, data: parseMolecules(source) };
    case "atom": {
      const data = parseAtoms(source);
      data.forEach((species) => atom(species)); // noto'g'ri element — oldindan aniqlanadi
      return { kind: "atom" as const, data };
    }
    case "punnett": {
      const data = parsePunnett(source);
      punnett(data);
      return { kind: "punnett" as const, data };
    }
    case "dna": {
      const data = parseDna(source);
      analyzeDna(data);
      return { kind: "dna" as const, data };
    }
    case "cell":
      return { kind: "cell" as const, data: parseCell(source) };
    case "rasm":
      return { kind: "rasm" as const, data: parseIllustration(source) };
    default:
      return { kind: "mermaid" as const, data: source };
  }
}

function Inner({ language, source }: { language: string; source: string }) {
  // AI xato blok yozsa (masalan, mavjud bo'lmagan element) — throw emas, tushunarli xabar.
  const parsed = useMemo(() => {
    try {
      return parse(language, source);
    } catch (error) {
      return { kind: "error" as const, data: error instanceof Error ? error.message : "noto'g'ri ma'lumot" };
    }
  }, [language, source]);

  switch (parsed.kind) {
    case "error":
      return <VisualError message={parsed.data} source={source} />;
    case "smiles":
      return <MoleculeDiagram molecules={parsed.data} />;
    case "atom":
      return <AtomDiagram species={parsed.data} />;
    case "punnett":
      return <PunnettSquare input={parsed.data} />;
    case "dna":
      return <DnaDiagram input={parsed.data} />;
    case "cell":
      return <CellDiagram spec={parsed.data} />;
    case "rasm":
      return <Illustration spec={parsed.data} />;
    default:
      return <MermaidDiagram chart={parsed.data} />;
  }
}

/**
 * AI Ustoz javobidagi chizma bloki. Javob hali kelayotganda (blok chala) —
 * "chizilmoqda"; tayyor bo'lgach chiziladi, xato bo'lsa faqat shu blok xato ko'rsatadi.
 */
export default function VisualBlock({ language, source, isStreaming }: { language: string; source: string; isStreaming: boolean }) {
  if (isStreaming) return <VisualPlaceholder />;
  return (
    <VisualBoundary source={source}>
      <Inner language={language} source={source.trim()} />
    </VisualBoundary>
  );
}
