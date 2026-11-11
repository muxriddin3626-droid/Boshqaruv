/**
 * Punnett katagi: ota-ona genotiplaridan gametalar, avlod genotiplari va
 * fenotip nisbatlari HISOBLANADI (AI faqat genotiplarni beradi) — shuning
 * uchun chizma har doim to'g'ri bo'ladi. 1-2 juft gen (mustaqil irsiylanish).
 */

export interface PunnettInput {
  p1: string;
  p2: string;
  /** Allel -> belgi nomi: {"A": "sariq", "a": "yashil"}; to'liqsiz dominantlikda {"Aa": "pushti"} ham. */
  traits?: Record<string, string>;
  incomplete?: boolean;
}

export interface Ratio {
  label: string;
  count: number;
}

export interface PunnettResult {
  gametes1: string[];
  gametes2: string[];
  grid: string[][];
  genotypes: Ratio[];
  phenotypes: Ratio[];
  total: number;
}

const MAX_GENES = 2;

/** "aA" -> "Aa": dominant allel oldinda. */
function normalizePair(pair: string): string {
  return [...pair].sort((x, y) => (x === y ? 0 : x === x.toUpperCase() ? -1 : 1)).join("");
}

export function parseGenotype(raw: string): string[] {
  const cleaned = raw.replace(/[^A-Za-z]/g, "");
  if (!cleaned || cleaned.length % 2 !== 0) throw new Error(`Genotip noto'g'ri: ${raw}`);
  const pairs: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const pair = cleaned.slice(i, i + 2);
    if (pair[0].toLowerCase() !== pair[1].toLowerCase()) throw new Error(`Allellar bir genga tegishli emas: ${pair}`);
    pairs.push(normalizePair(pair));
  }
  if (pairs.length > MAX_GENES) throw new Error("Ko'pi bilan 2 juft gen chiziladi");
  const letters = pairs.map((pair) => pair[0].toLowerCase());
  if (new Set(letters).size !== letters.length) throw new Error("Bir gen ikki marta yozilgan");
  return pairs;
}

/** Har gen allellari kombinatsiyasi; takrorlar olib tashlanadi (har biri teng ehtimolli bo'lib qoladi). */
export function gametes(pairs: string[]): string[] {
  let result = [""];
  for (const pair of pairs) {
    const alleles = [...new Set(pair)];
    result = result.flatMap((prefix) => alleles.map((allele) => prefix + allele));
  }
  return result;
}

function combine(g1: string, g2: string): string {
  return [...g1].map((allele, i) => normalizePair(allele + g2[i])).join("");
}

export function phenotypeOf(genotype: string, input: PunnettInput): string {
  const traits = input.traits ?? {};
  const parts: string[] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    const pair = genotype.slice(i, i + 2);
    const upper = pair[0].toUpperCase();
    const lower = upper.toLowerCase();
    const isHetero = pair[0] !== pair[1];
    if (input.incomplete && isHetero) parts.push(traits[pair] ?? `${pair} (oraliq)`);
    else if (pair.includes(upper)) parts.push(traits[upper] ?? (input.incomplete ? `${upper}${upper}` : `${upper}_`));
    else parts.push(traits[lower] ?? `${lower}${lower}`);
  }
  return parts.join(", ");
}

function genotypeOrder(genotype: string): number {
  // AA < Aa < aa har gen bo'yicha — darsliklardagi tartib.
  let key = 0;
  for (let i = 0; i < genotype.length; i += 2) {
    const upperCount = [...genotype.slice(i, i + 2)].filter((c) => c === c.toUpperCase()).length;
    key = key * 3 + (2 - upperCount);
  }
  return key;
}

export function punnett(input: PunnettInput): PunnettResult {
  const pairs1 = parseGenotype(input.p1);
  const pairs2 = parseGenotype(input.p2);
  const genes1 = pairs1.map((pair) => pair[0].toLowerCase()).join("");
  const genes2 = pairs2.map((pair) => pair[0].toLowerCase()).join("");
  if (genes1 !== genes2) throw new Error("Ota-onada genlar bir xil bo'lishi kerak");

  const gametes1 = gametes(pairs1);
  const gametes2 = gametes(pairs2);
  const grid = gametes1.map((g1) => gametes2.map((g2) => combine(g1, g2)));

  const genotypeCounts = new Map<string, number>();
  const phenotypeCounts = new Map<string, number>();
  for (const genotype of grid.flat()) {
    genotypeCounts.set(genotype, (genotypeCounts.get(genotype) ?? 0) + 1);
    const phenotype = phenotypeOf(genotype, input);
    phenotypeCounts.set(phenotype, (phenotypeCounts.get(phenotype) ?? 0) + 1);
  }
  const genotypes = [...genotypeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => genotypeOrder(a.label) - genotypeOrder(b.label));
  const phenotypes = [...phenotypeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  return { gametes1, gametes2, grid, genotypes, phenotypes, total: gametes1.length * gametes2.length };
}

/** [9, 3, 3, 1] -> "9 : 3 : 3 : 1" (umumiy bo'luvchiga qisqartirilgan). */
export function ratioText(counts: number[]): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = counts.reduce((acc, value) => gcd(acc, value), 0) || 1;
  return counts.map((value) => value / divisor).join(" : ");
}
