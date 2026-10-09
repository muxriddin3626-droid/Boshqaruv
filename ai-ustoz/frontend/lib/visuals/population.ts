/**
 * Populyatsiya genetikasi (Xardi–Vaynberg qonuni): p + q = 1, p² + 2pq + q² = 1.
 * AI faqat berilganni yozadi — allel yoki genotip chastotasi, foiz, son yoki
 * genotiplar soni; p, q, genotiplar ulushi va soni, muvozanat tekshiruvi ilovada hisoblanadi.
 */

export interface PopulationInput {
  /** Berilganlar: "p", "q", "AA", "Aa", "aa" kalitlari; qiymat — ulush (0,04), foiz ("4%") yoki son (16). */
  given: Record<string, string>;
  /** Populyatsiyadagi jami individlar (sonlar hisoblanishi uchun). */
  total: number | null;
  /** Belgilarning o'zbekcha nomi: {"A": "normal", "a": "albinizm"}. */
  traits: Record<string, string>;
}

export interface Genotype {
  key: "AA" | "Aa" | "aa";
  frequency: number;
  count: number | null;
  observed: number | null;
}

export interface PopulationResult {
  p: number;
  q: number;
  genotypes: Genotype[];
  total: number | null;
  steps: string[];
  /** Kuzatilgan sonlar berilgan bo'lsa: χ² va muvozanatdami (df = 1, 0,05 darajada chegara 3,84). */
  equilibrium: { chiSquare: number; holds: boolean } | null;
}

export function fmt(value: number, digits = 4): string {
  const rounded = Number(value.toFixed(digits));
  return String(rounded).replace(".", ",");
}

export function percent(value: number): string {
  return `${fmt(value * 100, 2)}%`;
}

const KEYS = ["p", "q", "AA", "Aa", "aa"] as const;

function normalizeKey(raw: string): (typeof KEYS)[number] | null {
  const key = raw.trim();
  if (key === "p" || key === "q") return key;
  if (/^AA$/.test(key)) return "AA";
  if (/^(Aa|aA)$/.test(key)) return "Aa";
  if (/^aa$/.test(key)) return "aa";
  const lower = key.toLowerCase();
  if (/dominant gomozigota|^dominant gomo/.test(lower)) return "AA";
  if (/geterozigota|tashuvchi/.test(lower)) return "Aa";
  if (/retsessiv|kasal/.test(lower)) return "aa";
  return null;
}

type Amount = { kind: "fraction"; value: number } | { kind: "count"; value: number };

/** "0,04" -> ulush, "4%" -> 0,04, "16" (1 dan katta butun) -> son. */
export function parseAmount(raw: string): Amount {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  const pct = text.match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) return { kind: "fraction", value: Number(pct[1]) / 100 };
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return { kind: "fraction", value: Number(fraction[1]) / Number(fraction[2]) };
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`Qiymatni tushunib bo'lmadi: ${raw}`);
  const value = Number(text);
  return value <= 1 ? { kind: "fraction", value } : { kind: "count", value };
}

export function analyzePopulation(input: PopulationInput): PopulationResult {
  const steps: string[] = [];
  const given = new Map<(typeof KEYS)[number], Amount>();
  for (const [rawKey, rawValue] of Object.entries(input.given)) {
    const key = normalizeKey(rawKey);
    if (!key) throw new Error(`Noma'lum kattalik: ${rawKey} (p, q, AA, Aa yoki aa bo'lsin)`);
    given.set(key, parseAmount(rawValue));
  }
  if (!given.size) throw new Error("Hech narsa berilmagan");
  let total = input.total;
  let p: number;
  let observed: Record<"AA" | "Aa" | "aa", number> | null = null;

  const counts = [...given.entries()].filter(([, a]) => a.kind === "count");
  if (counts.length && counts.length === given.size && ["AA", "Aa", "aa"].every((k) => given.has(k as never))) {
    // Uchala genotip soni berilgan — allellarni sanab chiqamiz.
    const AA = given.get("AA")!.value;
    const Aa = given.get("Aa")!.value;
    const aa = given.get("aa")!.value;
    const n = AA + Aa + aa;
    total = total ?? n;
    p = (2 * AA + Aa) / (2 * n);
    observed = { AA, Aa, aa };
    steps.push(`Jami individlar: ${AA} + ${Aa} + ${aa} = ${n}; allellar: 2 · ${n} = ${2 * n}.`);
    steps.push(`p (A) = (2 · ${AA} + ${Aa}) : ${2 * n} = ${fmt(p)}; q (a) = 1 − p = ${fmt(1 - p)}.`);
  } else {
    const fraction = (key: (typeof KEYS)[number]): number | null => {
      const amount = given.get(key);
      if (!amount) return null;
      if (amount.kind === "fraction") return amount.value;
      if (!total) throw new Error(`${key} soni berilgan — ulushni topish uchun jami son (total) kerak`);
      steps.push(`${key} ulushi = ${amount.value} : ${total} = ${fmt(amount.value / total)}.`);
      return amount.value / total;
    };
    const fp = fraction("p");
    const fq = fraction("q");
    const faa = fraction("aa");
    const fAA = fraction("AA");
    const fAa = fraction("Aa");
    if (fp !== null) {
      p = fp;
      steps.push(`p = ${fmt(p)} (berilgan); q = 1 − p = ${fmt(1 - p)}.`);
    } else if (fq !== null) {
      p = 1 - fq;
      steps.push(`q = ${fmt(fq)} (berilgan); p = 1 − q = ${fmt(p)}.`);
    } else if (faa !== null) {
      const q = Math.sqrt(faa);
      p = 1 - q;
      steps.push(`Retsessiv belgili (aa) ulushi q² = ${fmt(faa)} → q = √${fmt(faa)} = ${fmt(q)}; p = 1 − q = ${fmt(p)}.`);
    } else if (fAA !== null) {
      p = Math.sqrt(fAA);
      steps.push(`AA ulushi p² = ${fmt(fAA)} → p = √${fmt(fAA)} = ${fmt(p)}; q = 1 − p = ${fmt(1 - p)}.`);
    } else if (fAa !== null) {
      if (fAa > 0.5) throw new Error("Geterozigotalar ulushi 0,5 dan oshmaydi (2pq ≤ 0,5)");
      // 2pq = h → p = (1 + √(1 − 2h)) / 2 (ikki yechimdan kattasi A uchun olinadi).
      p = (1 + Math.sqrt(1 - 2 * fAa)) / 2;
      steps.push(`2pq = ${fmt(fAa)} → p(1 − p) = ${fmt(fAa / 2)} → p = ${fmt(p)} yoki ${fmt(1 - p)} (ikkita yechim; bu yerda p > q deb olindi).`);
    } else throw new Error("p, q yoki genotip ulushi kerak");
  }
  if (!(p >= 0 && p <= 1)) throw new Error("Chastota 0 dan 1 gacha bo'lishi kerak");
  const q = 1 - p;
  const frequencies = { AA: p * p, Aa: 2 * p * q, aa: q * q };
  steps.push(
    `Genotiplar: AA = p² = ${fmt(frequencies.AA)} (${percent(frequencies.AA)}), Aa = 2pq = ${fmt(frequencies.Aa)} (${percent(frequencies.Aa)}), aa = q² = ${fmt(frequencies.aa)} (${percent(frequencies.aa)}).`,
  );
  if (total) {
    steps.push(
      `${total} ta individda: AA ≈ ${fmt(frequencies.AA * total, 1)}, Aa ≈ ${fmt(frequencies.Aa * total, 1)}, aa ≈ ${fmt(frequencies.aa * total, 1)}.`,
    );
  }
  let equilibrium: PopulationResult["equilibrium"] = null;
  if (observed && total) {
    const chiSquare = (["AA", "Aa", "aa"] as const).reduce((sum, key) => {
      const expected = frequencies[key] * total!;
      return expected > 0 ? sum + (observed![key] - expected) ** 2 / expected : sum;
    }, 0);
    equilibrium = { chiSquare, holds: chiSquare < 3.84 };
    steps.push(
      `Muvozanat tekshiruvi: χ² = Σ(kuzatilgan − kutilgan)² / kutilgan = ${fmt(chiSquare, 2)} ${chiSquare < 3.84 ? "< 3,84 → populyatsiya muvozanatda" : "≥ 3,84 → muvozanatda emas (tanlanish, migratsiya va h.k. ta'sir qilmoqda)"}.`,
    );
  }
  return {
    p,
    q,
    total: total ?? null,
    steps,
    equilibrium,
    genotypes: (["AA", "Aa", "aa"] as const).map((key) => ({
      key,
      frequency: frequencies[key],
      count: total ? frequencies[key] * total : null,
      observed: observed ? observed[key] : null,
    })),
  };
}
