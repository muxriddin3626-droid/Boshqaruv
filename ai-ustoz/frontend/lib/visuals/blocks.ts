/**
 * AI Ustoz javobidagi chizma bloklari (```smiles```, ```atom```, ```punnett```,
 * ```dna```, ```cell```, ```rasm```, ```foto```, ```reaksiya```, ```bolinish```, ```zanjir```, ```populyatsiya```, ```jarayon```, ```mermaid```) — matnni komponentga
 * beriladigan ma'lumotga aylantirish. Formatni AI biroz buzsa ham (JSON o'rniga
 * oddiy matn) imkon qadar tushunadi.
 */
import type { DivisionInput } from "./division";
import type { DnaInput } from "./dna";
import type { ChainInput } from "./ecology";
import type { PopulationInput } from "./population";
import type { ProcessKind } from "./process";
import type { PunnettInput } from "./punnett";
import type { ReactionSpec } from "./reactionView";

export const VISUAL_LANGUAGES = new Set(["mermaid", "smiles", "atom", "punnett", "dna", "cell", "rasm", "foto", "anatomy", "animal", "reaksiya", "bolinish", "zanjir", "populyatsiya", "jarayon"]);

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

function stringRecord(value: unknown, limit: number): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" || typeof v === "number")
      .slice(0, limit)
      .map(([k, v]) => [k.trim(), String(v).trim()]),
  );
}

/** ```reaksiya```: {"equation": "Zn + 2HCl -> ZnCl2 + H2", "names": {...}, "given": {"Zn": "13 g"}} yoki faqat tenglama. */
export function parseReaction(text: string): ReactionSpec {
  const json = tryJson(text);
  const equation = String(json ? (json.equation ?? "") : text).trim();
  if (!equation) throw new Error("Reaksiya tenglamasi yo'q");
  if (equation.length > 300) throw new Error("Tenglama juda uzun");
  return { equation, names: stringRecord(json?.names, 12), given: stringRecord(json?.given, 4) };
}

/** ```bolinish```: {"type": "meyoz", "2n": 46, "sex": "urg'ochi", "times": 5, "stage": "anafaza I"} yoki "mitoz 46". */
export function parseDivision(text: string): DivisionInput {
  const json = tryJson(text);
  const raw = String(json?.type ?? text).toLowerCase();
  const type = /meyoz|meioz|meiosis|gametogenez|spermatogenez|ovogenez/.test(raw) ? "meyoz" : "mitoz";
  let diploid = Number(json?.["2n"] ?? json?.diploid ?? NaN);
  if (!Number.isFinite(diploid) && json?.n !== undefined) diploid = 2 * Number(json.n);
  if (!Number.isFinite(diploid)) diploid = Number(text.match(/2n\s*=\s*(\d+)/i)?.[1] ?? text.match(/\b(\d+)\b/)?.[1] ?? 46);
  const sexRaw = String(json?.sex ?? raw).toLowerCase();
  const sex = /urg|ayol|ovo|tuxum|female/.test(sexRaw) ? "urgochi" : /erk|sperma|male/.test(sexRaw) ? "erkak" : null;
  const times = Math.round(Number(json?.times ?? 1)) || 1;
  return { type, diploid, times, sex, stage: json?.stage ? String(json.stage) : null, organism: String(json?.organism ?? "").slice(0, 60) };
}

/** "5 kg", "10000 kJ", "2,5 t" -> [5, "kg"]. */
function valueWithUnit(raw: string): [number, string] {
  const match = raw.trim().replace(/\s(?=\d{3}\b)/g, "").match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) throw new Error(`Qiymatni tushunib bo'lmadi: ${raw}`);
  return [Number(match[1].replace(",", ".")), match[2].trim().slice(0, 12)];
}

/** ```zanjir```: {"chain": ["o'simlik", "chigirtka", ...], "given": {"burgut": "5 kg"}, "percent": 10} yoki "o't -> quyon -> tulki". */
export function parseChain(text: string): ChainInput {
  const json = tryJson(text);
  const chain = (Array.isArray(json?.chain) ? (json.chain as unknown[]).map(String) : text.split(/\s*(?:->|→|—>|=>)\s*/))
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => name.slice(0, 40));
  let givenLevel: string | number | null = null;
  let givenValue: number | null = null;
  let unit = "";
  const given = json?.given;
  if (given && typeof given === "object" && !Array.isArray(given)) {
    const [entry] = Object.entries(given as Record<string, unknown>);
    if (entry) {
      givenLevel = entry[0];
      [givenValue, unit] = valueWithUnit(String(entry[1]));
    }
  }
  const percent = Number(json?.percent ?? 10);
  return { chain, givenLevel, givenValue, unit, percent };
}

/** ```populyatsiya```: {"given": {"aa": "4%"}, "total": 1000, "traits": {"A": "normal", "a": "albinizm"}}. */
export function parsePopulation(text: string): PopulationInput {
  const json = tryJson(text);
  if (!json) throw new Error("Populyatsiya bloki JSON ko'rinishida bo'lsin");
  const total = json.total === undefined || json.total === null ? null : Math.round(Number(json.total));
  if (total !== null && !(total > 0)) throw new Error("Jami son (total) musbat bo'lsin");
  return { given: stringRecord(json.given, 3), total, traits: stringRecord(json.traits, 4) };
}

/** ```jarayon```: {"process": "nafas" | "fotosintez" | "sut bijg'ish" | "spirtli bijg'ish", "given": {"glyukoza": "2 mol"}}. */
export function parseProcess(text: string, kindOf: (raw: string) => ProcessKind): { kind: ProcessKind; given: Record<string, string> } {
  const json = tryJson(text);
  return { kind: kindOf(String(json?.process ?? json?.type ?? text)), given: stringRecord(json?.given, 1) };
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
