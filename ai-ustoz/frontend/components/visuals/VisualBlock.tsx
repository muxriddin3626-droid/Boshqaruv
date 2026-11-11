"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { atom } from "@/lib/visuals/atom";
import {
  parseAtoms,
  parseCatalogChoice,
  parseCell,
  parseChain,
  parseDivision,
  parseDna,
  parseIllustration,
  parseMolecules,
  parsePhoto,
  parsePopulation,
  parseProcess,
  parsePunnett,
  parseReaction,
} from "@/lib/visuals/blocks";
import { analyzeDivision, divisionScenes } from "@/lib/visuals/division";
import { analyzeDna } from "@/lib/visuals/dna";
import { analyzeChain } from "@/lib/visuals/ecology";
import { analyzePopulation } from "@/lib/visuals/population";
import { analyzeProcess, processKind } from "@/lib/visuals/process";
import { punnett } from "@/lib/visuals/punnett";
import { analyzeReaction } from "@/lib/visuals/reactionView";

import MermaidDiagram from "../chat/MermaidDiagram";
import { ANIMAL_CHOICES, AnimalDiagram, HUMAN_SYSTEMS, HumanDiagram } from "./AnatomyDiagram";
import AtomDiagram from "./AtomDiagram";
import CellDiagram from "./CellDiagram";
import DivisionDiagram from "./DivisionDiagram";
import DnaDiagram from "./DnaDiagram";
import FoodChainDiagram from "./FoodChainDiagram";
import Illustration from "./Illustration";
import Photo from "./Photo";
import PopulationDiagram from "./PopulationDiagram";
import ProcessDiagram from "./ProcessDiagram";
import PunnettSquare from "./PunnettSquare";
import ReactionDiagram from "./ReactionDiagram";
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
    case "foto":
      return { kind: "foto" as const, data: parsePhoto(source) };
    case "bolinish": {
      const input = parseDivision(source);
      return { kind: "bolinish" as const, data: { result: analyzeDivision(input), scenes: divisionScenes(input.type, input.sex) } };
    }
    case "zanjir":
      return { kind: "zanjir" as const, data: analyzeChain(parseChain(source)) };
    case "populyatsiya": {
      const input = parsePopulation(source);
      return { kind: "populyatsiya" as const, data: { result: analyzePopulation(input), traits: input.traits } };
    }
    case "jarayon": {
      const { kind, given } = parseProcess(source, processKind);
      return { kind: "jarayon" as const, data: analyzeProcess(kind, given) };
    }
    case "reaksiya": {
      const spec = parseReaction(source);
      return { kind: "reaksiya" as const, data: { spec, view: analyzeReaction(spec) } };
    }
    case "anatomy":
      return { kind: "anatomy" as const, data: parseCatalogChoice(source, "system", HUMAN_SYSTEMS) };
    case "animal":
      return { kind: "animal" as const, data: parseCatalogChoice(source, "animal", ANIMAL_CHOICES) };
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
    case "foto":
      return <Photo spec={parsed.data} />;
    case "bolinish":
      return <DivisionDiagram result={parsed.data.result} scenes={parsed.data.scenes} />;
    case "zanjir":
      return <FoodChainDiagram result={parsed.data} />;
    case "populyatsiya":
      return <PopulationDiagram result={parsed.data.result} traits={parsed.data.traits} />;
    case "jarayon":
      return <ProcessDiagram result={parsed.data} />;
    case "reaksiya":
      return <ReactionDiagram spec={parsed.data.spec} view={parsed.data.view} />;
    case "anatomy":
      return <HumanDiagram system={parsed.data.key} highlight={parsed.data.highlight} />;
    case "animal":
      return <AnimalDiagram animal={parsed.data.key} highlight={parsed.data.highlight} />;
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
