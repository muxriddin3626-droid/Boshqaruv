/**
 * Oziq zanjiri va ekologik piramida: har bir bo'g'inga keyingisiga energiya
 * (massa) ning faqat ~10% i o'tadi (Lindeman qoidasi), qolgani nafas olish va
 * issiqlik sifatida sarflanadi. Bitta bo'g'in uchun qiymat berilsa, qolganlari
 * ilovada hisoblanadi (AI faqat zanjir va berilganni yozadi).
 */

export interface ChainInput {
  /** Produtsentdan yuqoriga: ["o'simlik", "chigirtka", "qurbaqa", "ilon", "burgut"]. */
  chain: string[];
  /** Qaysi bo'g'in (nomi yoki 1 dan boshlab tartib raqami) uchun qiymat berilgan. */
  givenLevel: string | number | null;
  givenValue: number | null;
  unit: string;
  /** Keyingi bo'g'inga o'tadigan ulush, %. Odatda 10. */
  percent: number;
}

export interface ChainLevel {
  index: number;
  name: string;
  role: string;
  icon: string;
  value: number | null;
}

export interface ChainResult {
  levels: ChainLevel[];
  givenIndex: number | null;
  steps: string[];
  percent: number;
  unit: string;
}

const ICONS: [RegExp, string][] = [
  [/fitoplankton|suv o.t|suvo.t|yosun|alg/, "🦠"],
  [/zooplankton|dafniya|siklop/, "🦐"],
  [/o.simlik|o.t\b|o.tlar|daraxt|bug.doy|beda|barg|ekin|produtsent|g.alla/, "🌿"],
  [/chigirtka/, "🦗"],
  [/kapalak|qurt|tırtıl|qurtlar|lichinka/, "🐛"],
  [/qo.ng.iz/, "🪲"],
  [/chumoli/, "🐜"],
  [/o.rgimchak/, "🕷️"],
  [/qurbaqa|baqa/, "🐸"],
  [/kaltakesak|kesak/, "🦎"],
  [/ilon/, "🐍"],
  [/burgut|lochin|qirg.iy|kalxat/, "🦅"],
  [/boyo.g.li|boyqush|ukki/, "🦉"],
  [/chumchuq|qush|chittak|mayna/, "🐦"],
  [/sichqon|kalamush|yumronqoziq/, "🐭"],
  [/quyon/, "🐇"],
  [/tulki/, "🦊"],
  [/bo.ri/, "🐺"],
  [/sher|yo.lbars|qoplon/, "🦁"],
  [/ayiq/, "🐻"],
  [/sigir|mol\b|qoramol/, "🐄"],
  [/qo.y\b|qo.ylar/, "🐑"],
  [/kiyik|bug.u/, "🦌"],
  [/baliq|cho.rtan|zog.ora|laqqa/, "🐟"],
  [/odam|inson/, "🧑"],
  [/mushuk/, "🐱"],
  [/tovuq/, "🐔"],
];

export function iconFor(name: string): string {
  const clean = name.toLowerCase();
  return ICONS.find(([pattern]) => pattern.test(clean))?.[1] ?? "";
}

export function roleOf(index: number): string {
  if (index === 0) return "Produtsent";
  const order = ["I", "II", "III", "IV", "V", "VI", "VII"][index - 1] ?? String(index);
  return `${order} tartib konsument`;
}

export function formatValue(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  const rounded = Number(value.toFixed(digits));
  const [whole, fraction] = String(rounded).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

function findLevel(chain: string[], level: string | number): number {
  if (typeof level === "number") {
    if (!Number.isInteger(level) || level < 1 || level > chain.length) throw new Error(`Zanjirda ${level}-bo'g'in yo'q`);
    return level - 1;
  }
  const clean = (text: string) => text.toLowerCase().replace(/['`’ʻʼ]/g, "").trim();
  const wanted = clean(level);
  if (/^\d+$/.test(wanted)) return findLevel(chain, Number(wanted));
  const index = chain.findIndex((name) => clean(name) === wanted);
  if (index >= 0) return index;
  const partial = chain.findIndex((name) => clean(name).includes(wanted) || wanted.includes(clean(name)));
  if (partial >= 0) return partial;
  throw new Error(`Zanjirda "${level}" yo'q`);
}

export function analyzeChain(input: ChainInput): ChainResult {
  if (input.chain.length < 2 || input.chain.length > 7) throw new Error("Zanjirda 2 tadan 7 tagacha bo'g'in bo'lsin");
  if (!(input.percent > 0 && input.percent <= 100)) throw new Error("O'tish ulushi 0 dan 100 gacha (%) bo'lsin");
  const ratio = input.percent / 100;
  const steps: string[] = [];
  let givenIndex: number | null = null;
  let values: (number | null)[] = input.chain.map(() => null);
  if (input.givenLevel !== null && input.givenValue !== null) {
    if (!(input.givenValue > 0)) throw new Error("Berilgan qiymat musbat bo'lsin");
    givenIndex = findLevel(input.chain, input.givenLevel);
    const g = givenIndex;
    const base = input.givenValue;
    // 12 xonagacha yaxlitlash: 10000 · 0,1² = 100 (100,00000000000001 emas).
    values = input.chain.map((_, i) => Number((base * ratio ** (i - g)).toPrecision(12)));
    const unit = input.unit ? ` ${input.unit}` : "";
    const name = (i: number) => input.chain[i];
    steps.push(`Berilgan: ${name(g)} — ${formatValue(base)}${unit}. Har bir keyingi bo'g'inga ${input.percent}% o'tadi.`);
    for (let i = g - 1; i >= 0; i--)
      steps.push(`${name(i)}: ${formatValue(values[i + 1]!)}${unit} : ${formatValue(ratio)} = ${formatValue(values[i]!)}${unit} (pastki bo'g'in ${formatValue(1 / ratio)} marta ko'p)`);
    for (let i = g + 1; i < input.chain.length; i++)
      steps.push(`${name(i)}: ${formatValue(values[i - 1]!)}${unit} · ${formatValue(ratio)} = ${formatValue(values[i]!)}${unit}`);
    if (g > 0)
      steps.push(
        `Umumiy: ${name(0)} = ${name(g)} · ${formatValue(1 / ratio)}^${g} = ${formatValue(base)} · ${formatValue((1 / ratio) ** g)} = ${formatValue(values[0]!)}${unit}`,
      );
  }
  return {
    levels: input.chain.map((name, index) => ({ index, name, role: roleOf(index), icon: iconFor(name), value: values[index] })),
    givenIndex,
    steps,
    percent: input.percent,
    unit: input.unit,
  };
}
