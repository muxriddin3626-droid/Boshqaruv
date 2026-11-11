/**
 * Atom tuzilishi: elektron konfiguratsiya (Klechkovskiy tartibi, ma'lum
 * istisnolar bilan), qavatlar bo'yicha elektronlar va ionlar. Hisoblanadi —
 * AI faqat element belgisini beradi (masalan "Fe", "Fe3+", "Cl-").
 */

export const SYMBOLS = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn",
];

export const UZ_NAMES: Record<string, string> = {
  H: "Vodorod", He: "Geliy", Li: "Litiy", Be: "Berilliy", B: "Bor", C: "Uglerod", N: "Azot", O: "Kislorod", F: "Ftor",
  Ne: "Neon", Na: "Natriy", Mg: "Magniy", Al: "Alyuminiy", Si: "Kremniy", P: "Fosfor", S: "Oltingugurt", Cl: "Xlor",
  Ar: "Argon", K: "Kaliy", Ca: "Kalsiy", Sc: "Skandiy", Ti: "Titan", V: "Vanadiy", Cr: "Xrom", Mn: "Marganes",
  Fe: "Temir", Co: "Kobalt", Ni: "Nikel", Cu: "Mis", Zn: "Rux", Ga: "Galliy", Ge: "Germaniy", As: "Mishyak", Se: "Selen",
  Br: "Brom", Kr: "Kripton", Rb: "Rubidiy", Sr: "Stronsiy", Ag: "Kumush", Sn: "Qalay", I: "Yod", Xe: "Ksenon",
  Cs: "Seziy", Ba: "Bariy", Pt: "Platina", Au: "Oltin", Hg: "Simob", Pb: "Qo'rg'oshin",
};

const ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s", "4f", "5d", "6p"];
const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };

// Neytral atomdagi istisnolar: "elektron sakrashi" (d5 / d10 barqarorligi).
const EXCEPTIONS: Record<string, Record<string, number>> = {
  Cr: { "4s": 1, "3d": 5 },
  Cu: { "4s": 1, "3d": 10 },
  Nb: { "5s": 1, "4d": 4 },
  Mo: { "5s": 1, "4d": 5 },
  Ru: { "5s": 1, "4d": 7 },
  Rh: { "5s": 1, "4d": 8 },
  Pd: { "5s": 0, "4d": 10 },
  Ag: { "5s": 1, "4d": 10 },
  Pt: { "6s": 1, "5d": 9 },
  Au: { "6s": 1, "5d": 10 },
};

export interface Subshell {
  name: string;
  electrons: number;
}

export interface AtomResult {
  symbol: string;
  name: string;
  z: number;
  charge: number;
  electrons: number;
  configuration: Subshell[];
  shells: number[];
  period: number;
}

export function parseSpecies(raw: string): { symbol: string; charge: number } {
  const match = raw.trim().match(/^([A-Z][a-z]?)\s*(?:(\d*)\s*([+-]))?$/);
  if (!match || !SYMBOLS.includes(match[1])) throw new Error(`Element topilmadi: ${raw}`);
  const charge = match[3] ? (match[3] === "+" ? 1 : -1) * Number(match[2] || 1) : 0;
  return { symbol: match[1], charge };
}

function neutralConfiguration(symbol: string, z: number): Subshell[] {
  const filled: Subshell[] = [];
  let left = z;
  for (const name of ORDER) {
    if (left <= 0) break;
    const electrons = Math.min(left, CAPACITY[name[1]]);
    filled.push({ name, electrons });
    left -= electrons;
  }
  const exception = EXCEPTIONS[symbol];
  if (exception) {
    for (const [name, electrons] of Object.entries(exception)) {
      const existing = filled.find((subshell) => subshell.name === name);
      if (existing) existing.electrons = electrons;
      else filled.push({ name, electrons });
    }
  }
  return filled.filter((subshell) => subshell.electrons > 0);
}

const L_ORDER = "spdf";

export function atom(raw: string): AtomResult {
  const { symbol, charge } = parseSpecies(raw);
  const z = SYMBOLS.indexOf(symbol) + 1;
  const electrons = z - charge;
  if (electrons < 0 || Math.abs(charge) > 8) throw new Error("Ion zaryadi noto'g'ri");
  let configuration = neutralConfiguration(symbol, z);
  // Davr — istisnolarsiz to'ldirishdagi eng katta qavat (Pd'da 5s bo'sh bo'lsa ham 5-davr).
  const period = Math.max(...neutralConfiguration("", z).map((subshell) => Number(subshell.name[0])));

  if (charge > 0) {
    // Kation: elektronlar eng tashqi qavatdan (avval 4s, keyin 3d) olinadi.
    let remove = charge;
    const byOuter = [...configuration].sort(
      (a, b) => Number(b.name[0]) - Number(a.name[0]) || L_ORDER.indexOf(b.name[1]) - L_ORDER.indexOf(a.name[1])
    );
    for (const subshell of byOuter) {
      const taken = Math.min(remove, subshell.electrons);
      subshell.electrons -= taken;
      remove -= taken;
      if (!remove) break;
    }
    configuration = configuration.filter((subshell) => subshell.electrons > 0);
  } else if (charge < 0) {
    configuration = neutralConfiguration("", electrons);
  }

  const shells: number[] = [];
  for (const subshell of configuration) {
    const n = Number(subshell.name[0]);
    shells[n - 1] = (shells[n - 1] ?? 0) + subshell.electrons;
  }
  return {
    symbol,
    name: UZ_NAMES[symbol] ?? symbol,
    z,
    charge,
    electrons,
    configuration,
    shells: Array.from(shells, (count) => count ?? 0),
    period,
  };
}
