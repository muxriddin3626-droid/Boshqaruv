"use client";

import { useEffect, useRef, useState } from "react";

import type { MoleculeSpec } from "@/lib/visuals/blocks";

import { VisualFrame } from "./VisualFrame";

/** "C2H6O" -> C₂H₆O */
function FormulaText({ formula }: { formula: string }) {
  return (
    <>
      {formula.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : <span key={i}>{part}</span>))}
    </>
  );
}

function Molecule({ molecule }: { molecule: MoleculeSpec }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [formula, setFormula] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    import("smiles-drawer").then(({ default: SmilesDrawer }) => {
      if (isCancelled || !svgRef.current) return;
      // Maktab uslubi: uglerod va vodorodlar ko'rsatiladi, guruhlar zichlanmaydi (COOH emas, to'liq tuzilish).
      const drawer = new SmilesDrawer.SvgDrawer({
        width: 260,
        height: 180,
        bondThickness: 1.2,
        fontSizeLarge: 7,
        fontSizeSmall: 5,
        padding: 12,
        compactDrawing: false,
        terminalCarbons: true,
        explicitHydrogens: true,
      });
      SmilesDrawer.parse(
        molecule.smiles,
        (tree) => {
          if (isCancelled || !svgRef.current) return;
          try {
            drawer.draw(tree, svgRef.current, "dark");
            setFormula(drawer.getMolecularFormula());
          } catch {
            setError("tuzilishni chizib bo'lmadi");
          }
        },
        () => setError("SMILES noto'g'ri")
      );
    });
    return () => {
      isCancelled = true;
    };
  }, [molecule.smiles]);

  return (
    <div className="flex flex-col items-center" data-testid="molecule">
      {error ? (
        <p className="py-6 text-xs text-red-300">
          {molecule.smiles}: {error}
        </p>
      ) : (
        <svg ref={svgRef} className="visual-pop h-[150px] w-full max-w-[260px]" />
      )}
      <p className="text-center text-xs text-gray-200">
        {molecule.name && <b className="text-white">{molecule.name}</b>}
        {formula && (
          <span className="ml-1 text-gray-400">
            (<FormulaText formula={formula} />)
          </span>
        )}
      </p>
    </div>
  );
}

/** Organik molekulalarning tuzilish formulasi (SMILES'dan chiziladi, molekulyar formula hisoblanadi). */
export default function MoleculeDiagram({ molecules }: { molecules: MoleculeSpec[] }) {
  return (
    <VisualFrame title="Tuzilish formulasi">
      <div className={`grid gap-3 ${molecules.length > 1 ? "grid-cols-2" : ""} ${molecules.length > 2 ? "sm:grid-cols-3" : ""}`}>
        {molecules.map((molecule) => (
          <Molecule key={molecule.smiles} molecule={molecule} />
        ))}
      </div>
    </VisualFrame>
  );
}
