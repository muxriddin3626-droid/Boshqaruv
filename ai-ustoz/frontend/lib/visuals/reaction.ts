/**
 * Kimyoviy reaksiya tahlili — hammasi ilovada hisoblanadi (AI faqat tenglamani beradi):
 * formulalar, molyar massa (DTMdagi yaxlitlangan atom massalari bilan), atomlar
 * balansi, avtomatik tenglashtirish, reaksiya turi va stexiometriya (masala yechimi).
 *
 * Yozuv mhchem uslubida: "2H2 + O2 -> 2H2O", "Zn + 2HCl -> ZnCl2 + H2^", "CuSO4*5H2O",
 * ionlar "Fe^3+ + 3OH- -> Fe(OH)3v". Yon tomonlar " + " (bo'shliq bilan) ajratiladi.
 */

/** DTM/maktab masalalaridagi yaxlitlangan nisbiy atom massalari (Z = 1..86). */
export const ATOMIC_MASS: Record<string, number> = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20,
  Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40,
  Sc: 45, Ti: 48, V: 51, Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59, Cu: 64, Zn: 65,
  Ga: 70, Ge: 73, As: 75, Se: 79, Br: 80, Kr: 84, Rb: 85.5, Sr: 88, Y: 89, Zr: 91,
  Nb: 93, Mo: 96, Tc: 98, Ru: 101, Rh: 103, Pd: 106, Ag: 108, Cd: 112, In: 115, Sn: 119,
  Sb: 122, Te: 128, I: 127, Xe: 131, Cs: 133, Ba: 137, La: 139, Ce: 140, Pr: 141, Nd: 144,
  Pm: 145, Sm: 150, Eu: 152, Gd: 157, Tb: 159, Dy: 162.5, Ho: 165, Er: 167, Tm: 169, Yb: 173,
  Lu: 175, Hf: 178.5, Ta: 181, W: 184, Re: 186, Os: 190, Ir: 192, Pt: 195, Au: 197, Hg: 201,
  Tl: 204, Pb: 207, Bi: 209, Po: 209, At: 210, Rn: 222,
};

/**
 * Normal sharoitda (0 °C, 1 atm) gaz bo'lgan, masalalarda tez-tez uchraydigan moddalar.
 * HCl, HBr, HI, HF bu yerda yo'q: tenglamalarda ular odatda eritma (kislota) — gaz bo'lsa "(g)" yoziladi.
 */
const KNOWN_GASES = new Set([
  "H2", "O2", "N2", "F2", "Cl2", "O3", "He", "Ne", "Ar", "Kr", "Xe", "CO", "CO2", "SO2", "NH3", "NO", "NO2", "N2O",
  "H2S", "CH4", "C2H6", "C2H4", "C2H2", "C3H8", "C3H6", "C4H10", "PH3", "SiH4",
]);

export const MOLAR_VOLUME = 22.4;

export type AtomCounts = Record<string, number>;

export interface Species {
  /** Yozilgandek (koeffitsiyent va holatsiz): "Fe(OH)3", "CuSO4*5H2O", "SO4^2-". */
  formula: string;
  coefficient: number;
  atoms: AtomCounts;
  charge: number;
  isGas: boolean;
  isPrecipitate: boolean;
  /** Yozuvdagi belgi: gaz (↑) yoki cho'kma (↓) — tenglamani qayta yozishda saqlanadi. */
  mark: "" | " ^" | " v";
  molarMass: number;
}

export interface Reaction {
  reactants: Species[];
  products: Species[];
  reversible: boolean;
  conditions: string;
}

// --- Formula ---------------------------------------------------------------------------

function addInto(target: AtomCounts, source: AtomCounts, times: number) {
  for (const [element, count] of Object.entries(source)) target[element] = (target[element] ?? 0) + count * times;
}

/** Qavssiz/qavsli bir bo'lak: "Fe2(SO4)3", "K4[Fe(CN)6]". */
function parseGroup(text: string, start: number, closer: string | null): [AtomCounts, number] {
  const counts: AtomCounts = {};
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === "[") {
      const [inner, end] = parseGroup(text, i + 1, ch === "(" ? ")" : "]");
      i = end + 1;
      const digits = text.slice(i).match(/^\d+/)?.[0] ?? "";
      i += digits.length;
      addInto(counts, inner, digits ? Number(digits) : 1);
    } else if (ch === ")" || ch === "]") {
      if (ch !== closer) throw new Error(`Qavs noto'g'ri: ${text}`);
      return [counts, i];
    } else {
      const match = text.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
      if (!match) throw new Error(`Formulani tushunib bo'lmadi: ${text}`);
      if (!(match[1] in ATOMIC_MASS)) throw new Error(`Bunday element yo'q: ${match[1]} (${text})`);
      counts[match[1]] = (counts[match[1]] ?? 0) + (match[2] ? Number(match[2]) : 1);
      i += match[0].length;
    }
  }
  if (closer) throw new Error(`Qavs yopilmagan: ${text}`);
  return [counts, i];
}

export function molarMass(atoms: AtomCounts): number {
  const total = Object.entries(atoms).reduce((sum, [element, count]) => sum + ATOMIC_MASS[element] * count, 0);
  return Math.round(total * 100) / 100;
}

export interface ParsedFormula {
  formula: string;
  atoms: AtomCounts;
  charge: number;
}

/** "CuSO4*5H2O", "SO4^2-", "NH4+", "Fe^3+", "e-" (elektron). */
export function parseFormula(raw: string): ParsedFormula {
  let text = raw.trim().replace(/\s+/g, "").replace(/[{}]/g, "");
  let charge = 0;
  const chargeMatch = text.match(/\^(\d*)([+-])$/) ?? text.match(/([+-])$/);
  if (chargeMatch) {
    const sign = chargeMatch[chargeMatch.length - 1] === "+" ? 1 : -1;
    const size = chargeMatch.length === 3 && chargeMatch[1] ? Number(chargeMatch[1]) : 1;
    charge = sign * size;
    text = text.slice(0, text.length - chargeMatch[0].length);
  }
  if (text === "e") return { formula: raw.trim(), atoms: {}, charge };
  if (!text) throw new Error(`Bo'sh formula: ${raw}`);
  const atoms: AtomCounts = {};
  for (const piece of text.split(/[*·•.]/)) {
    const lead = piece.match(/^\d+/)?.[0] ?? "";
    const [counts, end] = parseGroup(piece, lead.length, null);
    if (end !== piece.length || !Object.keys(counts).length) throw new Error(`Formulani tushunib bo'lmadi: ${raw}`);
    addInto(atoms, counts, lead ? Number(lead) : 1);
  }
  return { formula: raw.trim().replace(/\s+/g, ""), atoms, charge };
}

// --- Tenglama ------------------------------------------------------------------------

const ARROW = /\s*(<=>|<->|⇄|⇌|->|→|⟶|=)\s*(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\s*/;

function parseSide(text: string): Species[] {
  const parts = text.split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Tenglamaning bir tomoni bo'sh");
  return parts.map((part) => {
    let body = part;
    let isGas = false;
    let isPrecipitate = false;
    let mark: Species["mark"] = "";
    const state = body.match(/\((g|aq|s|l|q|k|e|gaz)\)$/i);
    if (state) {
      isGas = /^(g|gaz)$/i.test(state[1]);
      isPrecipitate = /^(s|q|k)$/i.test(state[1]);
      body = body.slice(0, -state[0].length);
    }
    // mhchem: "^" yolg'iz — gaz (↑), " v" — cho'kma (↓).
    if (/(\s\^|↑)$/.test(body)) {
      isGas = true;
      mark = " ^";
      body = body.replace(/(\s\^|↑)$/, "");
    } else if (/(\sv|↓)$/.test(body)) {
      isPrecipitate = true;
      mark = " v";
      body = body.replace(/(\sv|↓)$/, "");
    }
    const coefficientMatch = body.match(/^(\d+(?:\/\d+)?)\s*(?=[A-Z(\[e])/);
    let coefficient = 1;
    if (coefficientMatch) {
      const [num, den] = coefficientMatch[1].split("/").map(Number);
      coefficient = den ? num / den : num;
      body = body.slice(coefficientMatch[0].length);
    }
    const parsed = parseFormula(body);
    return {
      formula: parsed.formula,
      coefficient,
      atoms: parsed.atoms,
      charge: parsed.charge,
      isGas: isGas || (parsed.charge === 0 && KNOWN_GASES.has(parsed.formula)),
      isPrecipitate,
      mark,
      molarMass: molarMass(parsed.atoms),
    };
  });
}

export function parseEquation(text: string): Reaction {
  const clean = text.trim().replace(/^\\ce\{([\s\S]*)\}$/, "$1");
  const match = clean.match(ARROW);
  if (!match || match.index === undefined) throw new Error("Tenglamada strelka (->) yo'q");
  const left = clean.slice(0, match.index);
  const right = clean.slice(match.index + match[0].length);
  return {
    reactants: parseSide(left),
    products: parseSide(right),
    reversible: /<=>|<->|⇄|⇌/.test(match[1]),
    conditions: [match[2], match[3]].filter(Boolean).join(", ").trim(),
  };
}

// --- Balans --------------------------------------------------------------------------

export function sideCounts(side: Species[], coefficients?: number[]): AtomCounts {
  const counts: AtomCounts = {};
  side.forEach((species, i) => addInto(counts, species.atoms, coefficients ? coefficients[i] : species.coefficient));
  return counts;
}

function sideCharge(side: Species[], coefficients?: number[]): number {
  return side.reduce((sum, species, i) => sum + species.charge * (coefficients ? coefficients[i] : species.coefficient), 0);
}

export interface BalanceRow {
  element: string;
  left: number;
  right: number;
}

export function balanceTable(reaction: Reaction): BalanceRow[] {
  const left = sideCounts(reaction.reactants);
  const right = sideCounts(reaction.products);
  const order: string[] = [];
  for (const species of [...reaction.reactants, ...reaction.products])
    for (const element of Object.keys(species.atoms)) if (!order.includes(element)) order.push(element);
  return order.map((element) => ({ element, left: round(left[element] ?? 0), right: round(right[element] ?? 0) }));
}

export function isBalanced(reaction: Reaction): boolean {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  return (
    balanceTable(reaction).every((row) => close(row.left, row.right)) &&
    close(sideCharge(reaction.reactants), sideCharge(reaction.products))
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

// Kasr: [surat, maxraj], maxraj > 0, qisqartirilgan.
type Frac = [number, number];
const frac = (n: number, d = 1): Frac => {
  const g = gcd(n, d) || 1;
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
};
const sub = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a: Frac, b: Frac): Frac => frac(a[0] * b[0], a[1] * b[1]);
const div = (a: Frac, b: Frac): Frac => frac(a[0] * b[1], a[1] * b[0]);

/**
 * Eng kichik butun koeffitsiyentlar (reagentlar, keyin mahsulotlar tartibida).
 * Yechim yagona bo'lmasa (masalan, bir nechta mustaqil reaksiya qo'shilgan) — null.
 */
export function autoBalance(reaction: Reaction): number[] | null {
  const species = [...reaction.reactants, ...reaction.products];
  const sign = (i: number) => (i < reaction.reactants.length ? 1 : -1);
  const elements = [...new Set(species.flatMap((s) => Object.keys(s.atoms)))];
  const rows: Frac[][] = elements.map((element) => species.map((s, i) => frac(sign(i) * (s.atoms[element] ?? 0))));
  if (species.some((s) => s.charge !== 0)) rows.push(species.map((s, i) => frac(sign(i) * s.charge)));
  const n = species.length;
  // Gauss: pog'onali ko'rinish.
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    const p = rows.findIndex((row, i) => i >= r && row[c][0] !== 0);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const pivot = rows[r][c];
    rows[r] = rows[r].map((v) => div(v, pivot));
    rows.forEach((row, i) => {
      if (i !== r && row[c][0] !== 0) {
        const factor = row[c];
        rows[i] = row.map((v, j) => sub(v, mul(factor, rows[r][j])));
      }
    });
    pivots.push(c);
    r++;
  }
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  if (free.length !== 1) return null;
  const f = free[0];
  const solution: Frac[] = Array(n).fill(frac(0));
  solution[f] = frac(1);
  pivots.forEach((c, i) => (solution[c] = mul(frac(-1), rows[i][f])));
  const lcm = solution.reduce((acc, [, d]) => (acc * d) / gcd(acc, d), 1);
  let ints = solution.map(([num, d]) => (num * lcm) / d);
  if (ints.every((v) => v <= 0)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0)) return null;
  const g = ints.reduce((acc, v) => gcd(acc, v));
  return ints.map((v) => v / g);
}

/** Koeffitsiyentlar qo'yilgan tenglama matni (mhchem uchun). */
export function equationText(reaction: Reaction, coefficients?: number[]): string {
  const all = [...reaction.reactants, ...reaction.products];
  const coef = (i: number) => (coefficients ? coefficients[i] : all[i].coefficient);
  const term = (s: Species, i: number) => {
    const c = coef(i);
    return `${c === 1 ? "" : formatNumber(c)}${s.formula}${s.mark}`;
  };
  const left = reaction.reactants.map((s, i) => term(s, i)).join(" + ");
  const right = reaction.products.map((s, i) => term(s, i + reaction.reactants.length)).join(" + ");
  const arrow = reaction.reversible ? "<=>" : "->";
  return `${left} ${arrow}${reaction.conditions ? `[${reaction.conditions}]` : ""} ${right}`;
}

export function withCoefficients(reaction: Reaction, coefficients: number[]): Reaction {
  const n = reaction.reactants.length;
  return {
    ...reaction,
    reactants: reaction.reactants.map((s, i) => ({ ...s, coefficient: coefficients[i] })),
    products: reaction.products.map((s, i) => ({ ...s, coefficient: coefficients[i + n] })),
  };
}

// --- Turi ----------------------------------------------------------------------------

export interface ReactionKind {
  /** Birikish / parchalanish / o'rin olish / almashinish (aniqlanmasa — null). */
  type: string | null;
  /** Oddiy modda bir tomonda, uning elementi ikkinchi tomonda birikmada — oksidlanish darajasi albatta o'zgargan. */
  redox: boolean;
  ionic: boolean;
}

const isSimple = (s: Species) => s.charge === 0 && Object.keys(s.atoms).length === 1;

export function classify(reaction: Reaction): ReactionKind {
  const { reactants: left, products: right } = reaction;
  const ionic = [...left, ...right].some((s) => s.charge !== 0);
  const simpleElements = (side: Species[]) => new Set(side.filter(isSimple).flatMap((s) => Object.keys(s.atoms)));
  const compoundElements = (side: Species[]) => new Set(side.filter((s) => !isSimple(s)).flatMap((s) => Object.keys(s.atoms)));
  const crosses = (a: Set<string>, b: Set<string>) => [...a].some((element) => b.has(element));
  const redox = crosses(simpleElements(left), compoundElements(right)) || crosses(simpleElements(right), compoundElements(left));

  let type: string | null = null;
  if (!ionic) {
    if (left.length >= 2 && right.length === 1) type = "Birikish";
    else if (left.length === 1 && right.length >= 2) type = "Parchalanish";
    else if (left.length === 2 && right.length === 2) {
      const simpleLeft = left.filter(isSimple).length;
      const simpleRight = right.filter(isSimple).length;
      if (simpleLeft === 1 && simpleRight === 1) type = "O'rin olish";
      else if (simpleLeft === 0 && simpleRight === 0 && !redox) type = "Almashinish";
    }
  }
  return { type, redox, ionic };
}

// --- Stexiometriya -------------------------------------------------------------------

export interface Amount {
  mol: number;
  kind: "mass" | "mol" | "volume";
}

/** "13 g", "0,2 mol", "4,48 l", "500 mg", "2 kg", "200 ml". Hajm — normal sharoitda (22,4 l/mol). */
export function parseAmount(raw: string, species: Species): Amount {
  const match = raw.trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(mg|kg|g|gr|gramm|mmol|kmol|mol|ml|m3|dm3|l|litr|liter)?\.?$/);
  if (!match) throw new Error(`Miqdorni tushunib bo'lmadi: ${raw}`);
  const value = Number(match[1]);
  const unit = match[2] ?? "mol";
  if (["g", "gr", "gramm", "mg", "kg"].includes(unit)) {
    if (!species.molarMass) throw new Error(`${species.formula} uchun massa ishlatib bo'lmaydi`);
    const grams = unit === "mg" ? value / 1000 : unit === "kg" ? value * 1000 : value;
    return { mol: grams / species.molarMass, kind: "mass" };
  }
  if (["mmol", "kmol", "mol"].includes(unit)) return { mol: unit === "mmol" ? value / 1000 : unit === "kmol" ? value * 1000 : value, kind: "mol" };
  if (!species.isGas) throw new Error(`${species.formula} gaz emas — hajm (l) bilan berib bo'lmaydi`);
  const litres = unit === "ml" ? value / 1000 : unit === "m3" ? value * 1000 : value;
  return { mol: litres / MOLAR_VOLUME, kind: "volume" };
}

export interface StoichRow {
  formula: string;
  side: "reactant" | "product";
  coefficient: number;
  molarMass: number;
  given: string | null;
  /** Reaksiyada qatnashgan (sarflangan yoki hosil bo'lgan) miqdor. */
  mol: number;
  mass: number;
  volume: number | null;
  /** Ortiqcha berilgan reagentdan reaksiyadan keyin qolgani (mol). */
  excessMol: number;
}

export interface Stoichiometry {
  rows: StoichRow[];
  /** Kam berilgan (reaksiyani cheklagan) modda — bir nechta reagent berilganda. */
  limiting: string | null;
  steps: string[];
}

export function formatNumber(value: number, digits = 3): string {
  const rounded = Number(value.toFixed(digits));
  return String(rounded).replace(".", ",");
}

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function findSpecies(reaction: Reaction, key: string): [Species, "reactant" | "product"] {
  const wanted = key.replace(/\s+/g, "");
  const reactant = reaction.reactants.find((s) => s.formula === wanted);
  if (reactant) return [reactant, "reactant"];
  const product = reaction.products.find((s) => s.formula === wanted);
  if (product) return [product, "product"];
  throw new Error(`Tenglamada ${key} yo'q`);
}

/**
 * Berilganlardan hamma moddalar miqdori: reagentlar berilsa — eng kami (n/koeffitsiyent
 * eng kichik) reaksiyani cheklaydi, qolganidan ortiqcha qoladi; faqat mahsulot berilsa — shundan.
 */
export function stoichiometry(reaction: Reaction, given: Record<string, string>): Stoichiometry {
  const entries = Object.entries(given);
  if (!entries.length) throw new Error("Berilgan miqdor yo'q");
  const steps: string[] = [];
  const provided = entries.map(([key, text]) => {
    const [species, side] = findSpecies(reaction, key);
    const amount = parseAmount(text, species);
    const value = text.trim();
    if (amount.kind === "mass") steps.push(`n(${species.formula}) = m / M = ${value} : ${formatNumber(species.molarMass)} g/mol = ${formatNumber(amount.mol)} mol`);
    else if (amount.kind === "volume") steps.push(`n(${species.formula}) = V / Vm = ${value} : 22,4 l/mol = ${formatNumber(amount.mol)} mol`);
    else steps.push(`n(${species.formula}) = ${formatNumber(amount.mol)} mol`);
    return { species, side, mol: amount.mol, text: value };
  });
  const reactantGivens = provided.filter((p) => p.side === "reactant");
  const pool = reactantGivens.length ? reactantGivens : provided;
  const basis = pool.reduce((best, p) => (p.mol / p.species.coefficient < best.mol / best.species.coefficient - 1e-12 ? p : best));
  const extent = basis.mol / basis.species.coefficient;
  const limiting = reactantGivens.length > 1 ? basis.species.formula : null;
  if (limiting)
    steps.push(
      `Qaysi biri kam? n : koeffitsiyent — ${reactantGivens
        .map((p) => `${p.species.formula}: ${formatNumber(p.mol)} : ${p.species.coefficient} = ${formatNumber(p.mol / p.species.coefficient)}`)
        .join("; ")}. Eng kichigi ${limiting} — hisob shu bo'yicha.`,
    );

  const all = [
    ...reaction.reactants.map((s) => [s, "reactant"] as const),
    ...reaction.products.map((s) => [s, "product"] as const),
  ];
  const rows = all.map(([species, side]) => {
    const mol = extent * species.coefficient;
    const own = provided.find((p) => p.species === species);
    if (species !== basis.species && !(own && own.side === "product"))
      steps.push(
        `n(${species.formula}) = n(${basis.species.formula}) · ${species.coefficient} : ${basis.species.coefficient} = ${formatNumber(mol)} mol` +
          (species.molarMass ? `; m = ${formatNumber(mol)} · ${formatNumber(species.molarMass)} = ${formatNumber(mol * species.molarMass)} g` : "") +
          (species.isGas ? `; V = ${formatNumber(mol)} · 22,4 = ${formatNumber(mol * MOLAR_VOLUME)} l` : ""),
      );
    const excessMol = own && side === "reactant" ? Math.max(0, own.mol - mol) : 0;
    if (excessMol > 1e-9) steps.push(`${species.formula} ortiqcha: ${formatNumber(own!.mol)} − ${formatNumber(mol)} = ${formatNumber(excessMol)} mol reaksiyaga kirmay qoladi`);
    return {
      formula: species.formula,
      side,
      coefficient: species.coefficient,
      molarMass: species.molarMass,
      given: own ? own.text : null,
      mol,
      mass: mol * species.molarMass,
      volume: species.isGas ? mol * MOLAR_VOLUME : null,
      excessMol,
    };
  });
  return { rows, limiting, steps };
}

// --- Molyar massa hisobining yozilishi ---------------------------------------------

/** "2·1 + 32 + 4·16 = 98" */
export function molarMassWorking(atoms: AtomCounts): string {
  const entries = Object.entries(atoms);
  if (entries.length === 1 && entries[0][1] === 1) return formatNumber(molarMass(atoms));
  const parts = Object.entries(atoms).map(([element, count]) => (count === 1 ? `${ATOMIC_MASS[element]}` : `${count}·${ATOMIC_MASS[element]}`));
  return `${parts.join(" + ").replace(/\./g, ",")} = ${formatNumber(molarMass(atoms))}`;
}
