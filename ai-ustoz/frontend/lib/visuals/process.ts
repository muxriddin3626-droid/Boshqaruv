/**
 * Hujayradagi energiya jarayonlari: nafas olish (aerob), bijg'ish (anaerob),
 * fotosintez. Bosqichlar, ATF va energiya hisobi hamda moddalar miqdori
 * (glyukoza, O₂, CO₂, ...) ilovada hisoblanadi — AI faqat jarayon turi va berilganni yozadi.
 *
 * Qiymatlar o'zbek maktab darsligi va DTM'dagidek: 1 mol glyukoza to'liq
 * oksidlansa 2800 kJ ajraladi, 38 ATF (har biri 40 kJ) = 1520 kJ to'planadi;
 * glikoliz (bijg'ish)da 200 kJ, 2 ATF = 80 kJ.
 */

export type ProcessKind = "nafas" | "fotosintez" | "sut_bijgish" | "spirt_bijgish";

export interface ProcessStage {
  id: string;
  name: string;
  place: string;
  /** Shu bosqichda 1 mol glyukozaga hosil bo'ladigan ATF (fotosintezda — sarflanadi, 0). */
  atp: number;
  description: string;
}

interface Substance {
  key: string;
  formula: string;
  name: string;
  coefficient: number;
  molarMass: number;
  gas: boolean;
  side: "in" | "out";
}

interface ProcessDef {
  title: string;
  equation: string;
  stages: ProcessStage[];
  substances: Substance[];
  /** 1 mol glyukozaga: ajraladigan (yoki fotosintezda to'planadigan) energiya, kJ. */
  energyPerMol: number;
  atpPerMol: number;
}

const GLUCOSE = { key: "glyukoza", formula: "C6H12O6", name: "glyukoza", molarMass: 180, gas: false };

export const PROCESSES: Record<ProcessKind, ProcessDef> = {
  nafas: {
    title: "Hujayraviy nafas olish (aerob)",
    equation: "C6H12O6 + 6O2 -> 6CO2 + 6H2O",
    energyPerMol: 2800,
    atpPerMol: 38,
    stages: [
      { id: "glikoliz", name: "Glikoliz (kislorodsiz bosqich)", place: "Sitoplazma", atp: 2, description: "Glyukoza (C₆) fermentlar yordamida 2 molekula pirouzum kislotaga (PVK, C₃) parchalanadi. 200 kJ energiya ajraladi: 80 kJ i 2 ATF da to'planadi, 120 kJ issiqlik bo'lib tarqaladi." },
      { id: "krebs", name: "Krebs sikli", place: "Mitoxondriya matriksi", atp: 2, description: "PVK mitoxondriyaga kiradi va to'liq oksidlanadi: CO₂ ajraladi, vodorod atomlari (NAD·H₂) tashuvchilarga o'tadi." },
      { id: "etz", name: "Elektron tashish zanjiri", place: "Mitoxondriya ichki membranasi (kristalar)", atp: 34, description: "Vodorod elektronlari kristalar bo'ylab uzatiladi, oxirida kislorod bilan suv hosil qiladi. Ajralgan energiya hisobiga ATF-sintetaza ko'p ATF hosil qiladi (kislorodli bosqichda jami 36 ATF)." },
    ],
    substances: [
      { ...GLUCOSE, coefficient: 1, side: "in" },
      { key: "kislorod", formula: "O2", name: "kislorod", coefficient: 6, molarMass: 32, gas: true, side: "in" },
      { key: "karbonat", formula: "CO2", name: "karbonat angidrid", coefficient: 6, molarMass: 44, gas: true, side: "out" },
      { key: "suv", formula: "H2O", name: "suv", coefficient: 6, molarMass: 18, gas: false, side: "out" },
    ],
  },
  fotosintez: {
    title: "Fotosintez",
    equation: "6CO2 + 6H2O ->[yorug'lik, xlorofill] C6H12O6 + 6O2",
    energyPerMol: 2800,
    atpPerMol: 0,
    stages: [
      { id: "yoruglik", name: "Yorug'lik fazasi", place: "Tilakoid membranalari (granalar)", atp: 0, description: "Xlorofill yorug'likni yutadi. Suv fotolizga uchraydi: 2H₂O → 4H⁺ + 4e⁻ + O₂ — kislorod atmosferaga chiqadi. Yorug'lik energiyasi ATF va NADF·H₂ ga aylanadi." },
      { id: "qorongilik", name: "Qorong'ilik fazasi (Kalvin sikli)", place: "Xloroplast stromasi", atp: 0, description: "Yorug'lik shart emas. CO₂ biriktiriladi va yorug'lik fazasidagi ATF va NADF·H₂ energiyasi hisobiga glyukoza sintezlanadi. Quyosh energiyasi kimyoviy bog'larda to'planadi." },
    ],
    substances: [
      { key: "karbonat", formula: "CO2", name: "karbonat angidrid", coefficient: 6, molarMass: 44, gas: true, side: "in" },
      { key: "suv", formula: "H2O", name: "suv", coefficient: 6, molarMass: 18, gas: false, side: "in" },
      { ...GLUCOSE, coefficient: 1, side: "out" },
      { key: "kislorod", formula: "O2", name: "kislorod", coefficient: 6, molarMass: 32, gas: true, side: "out" },
    ],
  },
  sut_bijgish: {
    title: "Sut kislotali bijg'ish (anaerob)",
    equation: "C6H12O6 -> 2C3H6O3",
    energyPerMol: 200,
    atpPerMol: 2,
    stages: [
      { id: "glikoliz", name: "Glikoliz", place: "Sitoplazma", atp: 2, description: "Glyukoza 2 molekula PVK ga parchalanadi — 2 ATF hosil bo'ladi (200 kJ dan 80 kJ to'planadi)." },
      { id: "bijgish", name: "Sut kislota hosil bo'lishi", place: "Sitoplazma", atp: 0, description: "Kislorod yetishmasa PVK sut kislotaga aylanadi (muskullarda charchoq, qatiq va pishloq tayyorlash)." },
    ],
    substances: [
      { ...GLUCOSE, coefficient: 1, side: "in" },
      { key: "sut", formula: "C3H6O3", name: "sut kislota", coefficient: 2, molarMass: 90, gas: false, side: "out" },
    ],
  },
  spirt_bijgish: {
    title: "Spirtli bijg'ish (anaerob)",
    equation: "C6H12O6 -> 2C2H5OH + 2CO2",
    energyPerMol: 200,
    atpPerMol: 2,
    stages: [
      { id: "glikoliz", name: "Glikoliz", place: "Sitoplazma", atp: 2, description: "Glyukoza 2 molekula PVK ga parchalanadi — 2 ATF hosil bo'ladi." },
      { id: "bijgish", name: "Etil spirt va CO₂ hosil bo'lishi", place: "Sitoplazma (achitqi zamburug'lari)", atp: 0, description: "PVK etil spirt va karbonat angidridga aylanadi — xamir ko'pchishi, vino-achitqi jarayonlari." },
    ],
    substances: [
      { ...GLUCOSE, coefficient: 1, side: "in" },
      { key: "etanol", formula: "C2H5OH", name: "etil spirt", coefficient: 2, molarMass: 46, gas: false, side: "out" },
      { key: "karbonat", formula: "CO2", name: "karbonat angidrid", coefficient: 2, molarMass: 44, gas: true, side: "out" },
    ],
  },
};

export const ATP_ENERGY = 40;
const MOLAR_VOLUME = 22.4;

export function processKind(raw: string): ProcessKind {
  const text = raw.toLowerCase();
  if (/foto/.test(text)) return "fotosintez";
  if (/spirt|achitqi|etanol/.test(text)) return "spirt_bijgish";
  if (/bijg|sut|anaerob|laktat/.test(text)) return "sut_bijgish";
  return "nafas";
}

export function fmt(value: number, digits = 3): string {
  const rounded = Number(value.toFixed(digits));
  const [whole, fraction] = String(Math.abs(rounded)).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "−" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

function findSubstance(def: ProcessDef, raw: string): Substance | "atp" {
  const key = raw.toLowerCase().replace(/['`’ʻʼ\s]/g, "");
  if (/^(atf|atp)$/.test(key)) return "atp";
  const found = def.substances.find(
    (s) => s.formula.toLowerCase() === key || s.key === key || s.name.replace(/\s/g, "") === key || key.startsWith(s.key),
  );
  if (!found) throw new Error(`Bu jarayonda "${raw}" yo'q`);
  return found;
}

function amountToMol(raw: string, substance: Substance): { mol: number; text: string } {
  const match = raw.trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(mol|g|gr|kg|l|litr|m3)?$/);
  if (!match) throw new Error(`Miqdorni tushunib bo'lmadi: ${raw}`);
  const value = Number(match[1]);
  const unit = match[2] ?? "mol";
  const text = raw.trim();
  if (unit === "mol") return { mol: value, text: `n = ${text}` };
  if (unit === "g" || unit === "gr" || unit === "kg") {
    const grams = unit === "kg" ? value * 1000 : value;
    return { mol: grams / substance.molarMass, text: `n = m / M = ${text} : ${substance.molarMass} g/mol` };
  }
  if (!substance.gas) throw new Error(`${substance.name} gaz emas — hajm bilan berib bo'lmaydi`);
  const litres = unit === "m3" ? value * 1000 : value;
  return { mol: litres / MOLAR_VOLUME, text: `n = V / Vm = ${text} : 22,4 l/mol` };
}

export interface ProcessRow {
  formula: string;
  name: string;
  side: "in" | "out";
  mol: number;
  mass: number;
  volume: number | null;
}

export interface ProcessCalc {
  glucoseMol: number;
  rows: ProcessRow[];
  atp: number;
  energy: number;
  stored: number;
  heat: number;
  steps: string[];
}

export interface ProcessResult {
  kind: ProcessKind;
  title: string;
  equation: string;
  stages: ProcessStage[];
  atpPerMol: number;
  energyPerMol: number;
  calc: ProcessCalc | null;
}

export function analyzeProcess(kind: ProcessKind, given: Record<string, string>): ProcessResult {
  const def = PROCESSES[kind];
  let calc: ProcessCalc | null = null;
  const entries = Object.entries(given);
  if (entries.length) {
    const [rawKey, rawValue] = entries[0];
    const found = findSubstance(def, rawKey);
    const steps: string[] = [];
    let glucoseMol: number;
    if (found === "atp") {
      if (!def.atpPerMol) throw new Error("Fotosintezda ATF bo'yicha hisoblab bo'lmaydi");
      const atp = Number(rawValue.replace(/\D+$/, "").replace(",", "."));
      if (!(atp > 0)) throw new Error(`ATF soni noto'g'ri: ${rawValue}`);
      glucoseMol = atp / def.atpPerMol;
      steps.push(`1 mol glyukozadan ${def.atpPerMol} ATF → n(glyukoza) = ${fmt(atp)} : ${def.atpPerMol} = ${fmt(glucoseMol)} mol.`);
    } else {
      const { mol, text } = amountToMol(rawValue, found);
      steps.push(text.startsWith("n = m") || text.startsWith("n = V") ? `n(${found.formula}) = ${text.slice(4)} = ${fmt(mol)} mol.` : `n(${found.formula}) = ${fmt(mol)} mol (berilgan).`);
      glucoseMol = mol / found.coefficient;
      if (found.key !== "glyukoza")
        steps.push(`Tenglama bo'yicha 1 mol glyukozaga ${found.coefficient} mol ${found.formula} → n(glyukoza) = ${fmt(mol)} : ${found.coefficient} = ${fmt(glucoseMol)} mol.`);
    }
    if (!(glucoseMol > 0)) throw new Error("Miqdor musbat bo'lsin");
    const rows = def.substances.map((s) => {
      const mol = glucoseMol * s.coefficient;
      return { formula: s.formula, name: s.name, side: s.side, mol, mass: mol * s.molarMass, volume: s.gas ? mol * MOLAR_VOLUME : null };
    });
    const givenFormula = found === "atp" ? null : found.formula;
    // Berilgan modda qayta hisoblanmaydi; glyukoza esa ATF dan yoki boshqa moddadan topilgan bo'lsa ko'rsatiladi.
    for (const row of rows.filter((r) => r.formula !== givenFormula))
      steps.push(
        `${row.name} (${row.formula}): ${fmt(row.mol)} mol · ${def.substances.find((s) => s.formula === row.formula)!.molarMass} = ${fmt(row.mass)} g` +
          (row.volume !== null ? ` (${fmt(row.volume)} l)` : ""),
      );
    const atp = glucoseMol * def.atpPerMol;
    const energy = glucoseMol * def.energyPerMol;
    const stored = kind === "fotosintez" ? energy : atp * ATP_ENERGY;
    if (kind === "fotosintez") steps.push(`To'plangan energiya: ${fmt(glucoseMol)} · 2800 kJ = ${fmt(energy)} kJ (Quyosh energiyasi glyukoza bog'larida).`);
    else {
      steps.push(`ATF: ${fmt(glucoseMol)} · ${def.atpPerMol} = ${fmt(atp)} ta (mol).`);
      steps.push(`Ajralgan energiya: ${fmt(glucoseMol)} · ${def.energyPerMol} = ${fmt(energy)} kJ; ATF da to'plangan: ${fmt(atp)} · 40 = ${fmt(stored)} kJ; issiqlik: ${fmt(energy - stored)} kJ.`);
    }
    calc = { glucoseMol, rows, atp, energy, stored, heat: energy - stored, steps };
  }
  return { kind, title: def.title, equation: def.equation, stages: def.stages, atpPerMol: def.atpPerMol, energyPerMol: def.energyPerMol, calc };
}
