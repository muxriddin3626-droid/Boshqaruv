/**
 * AI Ustoz javobidagi chizma bloklari (```smiles```, ```atom```, ```punnett```,
 * ```dna```, ```cell```, ```rasm```, ```foto```, ```mermaid```) — matnni komponentga
 * beriladigan ma'lumotga aylantirish. Formatni AI biroz buzsa ham (JSON o'rniga
 * oddiy matn) imkon qadar tushunadi.
 */
import type { DnaInput } from "./dna";
import type { PunnettInput } from "./punnett";

export const VISUAL_LANGUAGES = new Set(["mermaid", "smiles", "atom", "punnett", "dna", "cell", "rasm", "foto", "anatomy", "animal"]);

export interface MoleculeSpec {
  smiles: string;
  name: string;
}

export interface CellSpec {
  type: "hayvon" | "osimlik";
  highlight: string[];
}

export interface IllustrationSpec {
  prompt: string;
  caption: string;
}

export interface PhotoSpec {
  /** Wikimedia Commons'da qidirish uchun inglizcha so'rov. */
  query: string;
  caption: string;
}

function tryJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Har qatorda "SMILES | nomi"; ko'pi bilan 3 ta molekula yonma-yon. */
export function parseMolecules(text: string): MoleculeSpec[] {
  const molecules = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [smiles, ...name] = line.split("|");
      return { smiles: smiles.trim(), name: name.join("|").trim() };
    })
    .filter((molecule) => molecule.smiles && !/\s/.test(molecule.smiles));
  if (!molecules.length) throw new Error("SMILES topilmadi");
  return molecules.slice(0, 3);
}

/** "Fe" yoki "Na, Na+" — ko'pi bilan 3 ta. */
export function parseAtoms(text: string): string[] {
  const json = tryJson(text);
  const raw = json ? String(json.element ?? json.elements ?? "") : text;
  const atoms = raw.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
  if (!atoms.length) throw new Error("Element ko'rsatilmagan");
  return atoms.slice(0, 3);
}

/** JSON yoki "Aa x Aa" ko'rinishida. */
export function parsePunnett(text: string): PunnettInput {
  const json = tryJson(text);
  if (json) {
    const traits = json.traits && typeof json.traits === "object" ? (json.traits as Record<string, string>) : undefined;
    return { p1: String(json.p1 ?? ""), p2: String(json.p2 ?? ""), traits, incomplete: Boolean(json.incomplete) };
  }
  const parts = text.split(/\s*[x×*]\s*/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) throw new Error("Ota-ona genotiplari topilmadi");
  return { p1: parts[0], p2: parts[1] };
}

export function parseDna(text: string): DnaInput {
  const json = tryJson(text);
  if (json) {
    return {
      strand: String(json.strand ?? ""),
      kind: json.kind === "mrna" ? "mrna" : "dna",
      role: json.role === "coding" ? "coding" : "template",
    };
  }
  const strand = text.trim();
  return { strand, kind: /U/i.test(strand) && !/T/i.test(strand) ? "mrna" : "dna" };
}

export function parseCell(text: string): CellSpec {
  const json = tryJson(text);
  const rawType = String(json?.type ?? text).toLowerCase();
  const type = /o.?simlik|plant/.test(rawType) ? "osimlik" : "hayvon";
  const highlight = Array.isArray(json?.highlight) ? (json.highlight as unknown[]).map((item) => String(item).toLowerCase()) : [];
  return { type, highlight };
}

export function parseIllustration(text: string): IllustrationSpec {
  const json = tryJson(text);
  const prompt = String(json?.prompt ?? "").trim();
  if (!prompt) throw new Error("Rasm tavsifi yo'q");
  return { prompt: prompt.slice(0, 400), caption: String(json?.caption ?? "").trim().slice(0, 200) };
}

/** ```foto```: {"query": "frog anatomy", "caption": "..."} yoki faqat so'rov matni. */
export function parsePhoto(text: string): PhotoSpec {
  const json = tryJson(text);
  const query = String(json ? (json.query ?? "") : text).replace(/\s+/g, " ").trim();
  if (query.length < 2) throw new Error("Rasm uchun qidiruv so'zi yo'q");
  return { query: query.slice(0, 200), caption: String(json?.caption ?? "").trim().slice(0, 200) };
}

/** Ovozga aylantirishdan oldin: chizma bloklari, formulalar va markdown belgilari olib tashlanadi. */
export function toSpeechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/[*_#>`|]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface CatalogChoice {
  key: string;
  highlight: string[];
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/['`’ʻʼ]/g, "").replace(/[-\s]+/g, "_").trim();
}

/** Katalogdan tanlash: aniq kalit, keyin taxallus (masalan "qon tomirlari" -> qon_aylanish). */
export function resolveCatalogKey(raw: string, catalog: Record<string, { aliases: string[] }>): string | null {
  const wanted = normalizeKey(raw);
  if (wanted in catalog) return wanted;
  const plain = wanted.replace(/_/g, " ");
  for (const [key, entry] of Object.entries(catalog)) {
    if (entry.aliases.some((alias) => plain.includes(alias.toLowerCase().replace(/['`’ʻʼ]/g, "")))) return key;
  }
  return null;
}

/** ```anatomy``` / ```animal```: {"system"|"animal": "...", "highlight": [...]} yoki faqat nomi. */
export function parseCatalogChoice(text: string, field: "system" | "animal", catalog: Record<string, { aliases: string[] }>): CatalogChoice {
  const json = tryJson(text);
  const raw = String(json?.[field] ?? json?.type ?? text).trim();
  const key = resolveCatalogKey(raw, catalog);
  if (!key) throw new Error(`Bunday chizma yo'q: ${raw}. Mavjudlari: ${Object.keys(catalog).join(", ")}`);
  const highlight = Array.isArray(json?.highlight) ? (json.highlight as unknown[]).map((item) => String(item)) : [];
  return { key, highlight };
}
