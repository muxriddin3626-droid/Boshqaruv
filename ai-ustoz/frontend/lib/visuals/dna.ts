/**
 * DNK / i-RNK: komplementar zanjir, transkripsiya, kodonlar, aminokislotalar va
 * DTM masalalaridagi hisoblar (nukleotidlar soni, vodorod bog'lari, uzunlik).
 * Hammasi HISOBLANADI — AI faqat zanjirni beradi.
 */

export interface DnaInput {
  strand: string;
  /** "dna" — berilgan DNK zanjiri; "mrna" — berilgan i-RNK. */
  kind?: "dna" | "mrna";
  /** DNK uchun: "template" (i-RNK shu zanjirdan sintezlanadi, standart) yoki "coding". */
  role?: "template" | "coding";
}

export interface DnaResult {
  given: string;
  complement: string;
  template: string;
  coding: string;
  mrna: string;
  codons: string[];
  aminoAcids: string[];
  counts: Record<"A" | "T" | "G" | "C", number>;
  hydrogenBonds: number;
  lengthNm: number;
  pairs: number;
}

export const MAX_NUCLEOTIDES = 90;
export const NUCLEOTIDE_LENGTH_NM = 0.34;

const DNA_PAIR: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
const TO_MRNA: Record<string, string> = { A: "U", T: "A", G: "C", C: "G" };
const MRNA_TO_TEMPLATE: Record<string, string> = { U: "A", A: "T", G: "C", C: "G" };

// Standart genetik kod (i-RNK kodonlari).
const CODE: Record<string, string> = {};
const BASES = "UCAG";
const TABLE =
  "Phe Phe Leu Leu Ser Ser Ser Ser Tyr Tyr STOP STOP Cys Cys STOP Trp " +
  "Leu Leu Leu Leu Pro Pro Pro Pro His His Gln Gln Arg Arg Arg Arg " +
  "Ile Ile Ile Met Thr Thr Thr Thr Asn Asn Lys Lys Ser Ser Arg Arg " +
  "Val Val Val Val Ala Ala Ala Ala Asp Asp Glu Glu Gly Gly Gly Gly";
TABLE.split(" ").forEach((amino, index) => {
  const first = BASES[Math.floor(index / 16)];
  const second = BASES[Math.floor(index / 4) % 4];
  const third = BASES[index % 4];
  CODE[first + second + third] = amino;
});

export function translateCodon(codon: string): string {
  return CODE[codon] ?? "?";
}

function clean(strand: string, allowed: RegExp): string {
  const letters = strand.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) throw new Error("Zanjir bo'sh");
  if (!allowed.test(letters)) throw new Error("Zanjirda faqat nukleotid harflari bo'lishi kerak");
  if (letters.length > MAX_NUCLEOTIDES) throw new Error(`Ko'pi bilan ${MAX_NUCLEOTIDES} nukleotid chiziladi`);
  return letters;
}

export function analyzeDna(input: DnaInput): DnaResult {
  const kind = input.kind ?? "dna";
  let template: string;
  let coding: string;
  let mrna: string;
  let given: string;
  if (kind === "mrna") {
    given = clean(input.strand, /^[ACGU]+$/);
    mrna = given;
    template = [...given].map((base) => MRNA_TO_TEMPLATE[base]).join("");
    coding = [...template].map((base) => DNA_PAIR[base]).join("");
  } else {
    given = clean(input.strand, /^[ACGT]+$/);
    const other = [...given].map((base) => DNA_PAIR[base]).join("");
    [template, coding] = input.role === "coding" ? [other, given] : [given, other];
    mrna = [...template].map((base) => TO_MRNA[base]).join("");
  }

  const codons: string[] = [];
  for (let i = 0; i + 3 <= mrna.length; i += 3) codons.push(mrna.slice(i, i + 3));
  const aminoAcids = codons.map(translateCodon);

  // Qo'sh zanjirli DNK (ikkala zanjir) bo'yicha hisob.
  const doubleStrand = template + coding;
  const counts = { A: 0, T: 0, G: 0, C: 0 };
  for (const base of doubleStrand) counts[base as keyof typeof counts] += 1;
  const pairs = template.length;
  const atPairs = [...template].filter((base) => base === "A" || base === "T").length;
  const hydrogenBonds = atPairs * 2 + (pairs - atPairs) * 3;

  return {
    given,
    complement: kind === "mrna" ? template : [...given].map((base) => DNA_PAIR[base]).join(""),
    template,
    coding,
    mrna,
    codons,
    aminoAcids,
    counts,
    hydrogenBonds,
    lengthNm: Math.round(pairs * NUCLEOTIDE_LENGTH_NM * 100) / 100,
    pairs,
  };
}
