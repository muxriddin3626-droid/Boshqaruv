/**
 * Hujayra bo'linishi (mitoz, meyoz): har bir bosqichdagi xromosomalar (n) va DNK
 * molekulalari (c) soni, bo'linish natijasi va gametalar xilma-xilligi — berilgan
 * 2n bo'yicha ilovada hisoblanadi (AI faqat turi va 2n ni beradi).
 *
 * Darslikdagi yozuv: 2n4c — diploid to'plam, har bir xromosoma 2 xromatidli.
 */

export type DivisionType = "mitoz" | "meyoz";
export type Sex = "erkak" | "urgochi" | null;

export interface StageInfo {
  id: string;
  name: string;
  /** Hujayradagi xromosomalar = chromosomeFactor · n; DNK molekulalari = dnaFactor · n. */
  chromosomeFactor: number;
  dnaFactor: number;
  chromatids: 1 | 2;
  /** Jadvaldagi qiymatlar bitta hujayra uchunmi yoki bo'linayotgan hujayra (ikki qutb) uchunmi. */
  note: string;
  description: string;
}

const MITOSIS: StageInfo[] = [
  { id: "interfaza", name: "Interfaza (S davridan keyin)", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "DNK ikki hissa ortadi (replikatsiya): har bir xromosoma 2 xromatidli bo'ladi. Xromosomalar hali ko'rinmaydi — xromatin holida." },
  { id: "profaza", name: "Profaza", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "Xromosomalar spirallashib yo'g'onlashadi va ko'rinadi, yadro qobig'i va yadrocha yo'qoladi, bo'linish urchug'i hosil bo'ladi." },
  { id: "metafaza", name: "Metafaza", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "Xromosomalar ekvator tekisligida bir qatorga teriladi (metafaza plastinkasi); urchuq iplari sentromeralarga birikadi. Xromosomalarni sanash uchun eng qulay bosqich." },
  { id: "anafaza", name: "Anafaza", chromosomeFactor: 4, dnaFactor: 4, chromatids: 1, note: "butun hujayrada", description: "Sentromeralar bo'linadi, opa-singil xromatidlar mustaqil xromosomaga aylanib qarama-qarshi qutblarga tortiladi." },
  { id: "telofaza", name: "Telofaza", chromosomeFactor: 2, dnaFactor: 2, chromatids: 1, note: "har bir yangi hujayrada", description: "Qutblarda yadro qobig'i tiklanadi, xromosomalar despirallashadi, sitoplazma bo'linadi (sitokinez) — 2 ta bir xil hujayra." },
];

const MEIOSIS: StageInfo[] = [
  { id: "interfaza", name: "Interfaza (S davridan keyin)", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "DNK ikki hissa ortadi — har bir xromosoma 2 xromatidli." },
  { id: "profaza1", name: "Profaza I", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "Gomologik xromosomalar juftlashadi — konyugatsiya (bivalentlar); qo'shni xromatidlar qismlar almashadi — krossingover." },
  { id: "metafaza1", name: "Metafaza I", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "", description: "Bivalentlar ekvatorda joylashadi; har bir juftning qaysi tomonga qarashi tasodifiy — mustaqil taqsimlanish." },
  { id: "anafaza1", name: "Anafaza I", chromosomeFactor: 2, dnaFactor: 4, chromatids: 2, note: "butun hujayrada", description: "Gomologik xromosomalar (xromatidlar emas!) qutblarga ajraladi; har bir xromosoma hali 2 xromatidli." },
  { id: "telofaza1", name: "Telofaza I", chromosomeFactor: 1, dnaFactor: 2, chromatids: 2, note: "har bir hujayrada", description: "2 ta hujayra hosil bo'ladi, xromosomalar to'plami gaploid (n), lekin xromosomalar 2 xromatidli — reduksion bo'linish." },
  { id: "profaza2", name: "Profaza II", chromosomeFactor: 1, dnaFactor: 2, chromatids: 2, note: "har bir hujayrada", description: "Interkinez qisqa, DNK replikatsiyasi bo'lmaydi. Ikkala hujayrada yangi urchuq hosil bo'ladi." },
  { id: "metafaza2", name: "Metafaza II", chromosomeFactor: 1, dnaFactor: 2, chromatids: 2, note: "har bir hujayrada", description: "Har bir hujayrada xromosomalar ekvatorga teriladi." },
  { id: "anafaza2", name: "Anafaza II", chromosomeFactor: 2, dnaFactor: 2, chromatids: 1, note: "har bir hujayrada", description: "Sentromeralar bo'linadi, opa-singil xromatidlar qutblarga ajraladi (mitozdagi kabi)." },
  { id: "telofaza2", name: "Telofaza II", chromosomeFactor: 1, dnaFactor: 1, chromatids: 1, note: "har bir hujayrada", description: "4 ta gaploid hujayra (nc) hosil bo'ladi — ular bir-biridan va ona hujayradan genetik jihatdan farq qiladi." },
];

export interface DivisionInput {
  type: DivisionType;
  /** Somatik hujayradagi xromosomalar soni (2n), masalan odamda 46. */
  diploid: number;
  /** Mitoz: ketma-ket necha marta bo'linadi. Meyoz: nechta ona hujayra. */
  times: number;
  sex: Sex;
  /** Ajratib ko'rsatiladigan bosqich (masalan, "anafaza"). */
  stage: string | null;
  organism: string;
}

export interface StageRow extends StageInfo {
  chromosomes: number;
  dna: number;
  formula: string;
}

export interface DivisionResult {
  input: DivisionInput;
  n: number;
  stages: StageRow[];
  /** Natija haqida qadam-baqadam yozuvlar. */
  outcome: string[];
  /** Mustaqil taqsimlanish bo'yicha gametalar xillari (krossingoversiz): 2^n. */
  gameteVariants: string | null;
}

const ploidy = (factor: number) => (factor === 1 ? "n" : `${factor}n`);
const amount = (factor: number) => (factor === 1 ? "c" : `${factor}c`);

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString("en-US").replace(/,/g, " ");
}

/** 2^n katta n uchun ham: 2^23 = 8 388 608; juda katta bo'lsa — faqat daraja ko'rinishida. */
export function powerOfTwo(n: number): string {
  if (n <= 52) return formatInt(2 ** n);
  return `≈ ${(2 ** n).toExponential(2).replace("e+", " · 10^")}`;
}

export function matchStage(stages: StageInfo[], wanted: string | null): string | null {
  if (!wanted) return null;
  const clean = wanted.toLowerCase().replace(/['`’ʻʼ\s]/g, "");
  const roman = clean.replace(/ii$/, "2").replace(/i$/, "1");
  return stages.find((s) => s.id === clean || s.id === roman || s.name.toLowerCase().replace(/['`’ʻʼ\s]/g, "") === clean)?.id ?? null;
}

export function stagesOf(type: DivisionType): StageInfo[] {
  return type === "mitoz" ? MITOSIS : MEIOSIS;
}

export function analyzeDivision(input: DivisionInput): DivisionResult {
  if (!Number.isInteger(input.diploid) || input.diploid < 2 || input.diploid > 2000 || input.diploid % 2 !== 0)
    throw new Error("2n juft butun son bo'lishi kerak (masalan, 46)");
  if (!Number.isInteger(input.times) || input.times < 1 || input.times > 30) throw new Error("Bo'linishlar/hujayralar soni 1 dan 30 gacha bo'lsin");
  const n = input.diploid / 2;
  const stages = stagesOf(input.type).map((stage) => ({
    ...stage,
    chromosomes: stage.chromosomeFactor * n,
    dna: stage.dnaFactor * n,
    formula: `${ploidy(stage.chromosomeFactor)}${amount(stage.dnaFactor)}`,
  }));
  const outcome: string[] = [];
  let gameteVariants: string | null = null;
  if (input.type === "mitoz") {
    const cells = 2 ** input.times;
    outcome.push(`1 ta hujayra mitoz bilan ${input.times} marta bo'linsa: 2^${input.times} = ${formatInt(cells)} ta hujayra.`);
    outcome.push(`Har bir hosil bo'lgan hujayrada ${input.diploid} ta xromosoma (2n2c) — ona hujayra bilan bir xil.`);
    outcome.push(`Hammasida jami ${formatInt(cells * input.diploid)} ta xromosoma.`);
  } else {
    const m = input.times;
    if (input.sex === "erkak") outcome.push(`${m} ta spermatotsit meyozdan so'ng ${formatInt(4 * m)} ta spermatozoid beradi (har biri ${n} ta xromosoma, nc).`);
    else if (input.sex === "urgochi")
      outcome.push(`${m} ta ovotsit meyozdan so'ng ${formatInt(m)} ta tuxum hujayra va ${formatInt(3 * m)} ta yo'naltiruvchi tanacha beradi (har birida ${n} ta xromosoma).`);
    else outcome.push(`${m} ta ona hujayradan ${formatInt(4 * m)} ta gaploid hujayra hosil bo'ladi (har birida ${n} ta xromosoma, nc).`);
    outcome.push(`Xromosomalar soni 2 marta kamayadi: ${input.diploid} → ${n}. Urug'lanishda yana 2n = ${input.diploid} tiklanadi.`);
    gameteVariants = `2^${n} = ${powerOfTwo(n)}`;
  }
  return { input, n, stages, outcome, gameteVariants };
}

// --- Sahna (chizma) -----------------------------------------------------------------

/**
 * Chizmada soddalik uchun 2n = 4: ikki juft gomologik xromosoma (uzun A, qisqa B),
 * onadan (qizil) va otadan (ko'k). Har bir xromatid alohida element — bosqichlar
 * orasida o'z o'rniga silliq ko'chadi.
 */
export interface Placement {
  x: number;
  y: number;
  rot: number;
  scale?: number;
  opacity?: number;
}

export interface CellShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Scene {
  cells: (CellShape | null)[];
  nuclei: ({ cx: number; cy: number; r: number; dashed: boolean } | null)[];
  /** Urchuq: qutblar va har bir qutbdan iplar boradigan nuqtalar. */
  spindles: { pole: [number, number]; targets: [number, number][] }[];
  chromatin: boolean;
  chromatids: Record<string, Placement>;
}

export interface ChromatidDef {
  id: string;
  length: number;
  color: string;
}

const MATERNAL = "#f87171";
const PATERNAL = "#60a5fa";
export const CHROMATIDS: ChromatidDef[] = ["Am", "Ap", "Bm", "Bp"].flatMap((chromosome) =>
  [1, 2].map((k) => ({
    id: `${chromosome}${k}`,
    length: chromosome.startsWith("A") ? 40 : 26,
    color: chromosome.endsWith("m") ? MATERNAL : PATERNAL,
  })),
);

const X_TILT = 13;

/** Ikki xromatidli xromosoma (X shakl) — ikkala xromatid bir markazda, qarama-qarshi qiyshaygan. */
function xShape(chromosome: string, x: number, y: number, rot = 0, extra: Partial<Placement> = {}): Record<string, Placement> {
  return {
    [`${chromosome}1`]: { x, y, rot: rot + X_TILT, ...extra },
    [`${chromosome}2`]: { x, y, rot: rot - X_TILT, ...extra },
  };
}

const BIG_CELL: CellShape = { cx: 160, cy: 100, rx: 120, ry: 80 };

function interphase(): Scene {
  return {
    cells: [BIG_CELL, BIG_CELL],
    nuclei: [{ cx: 160, cy: 100, r: 50, dashed: false }],
    spindles: [],
    chromatin: true,
    chromatids: {
      ...xShape("Am", 145, 92, 30, { opacity: 0, scale: 0.6 }),
      ...xShape("Ap", 172, 108, -20, { opacity: 0, scale: 0.6 }),
      ...xShape("Bm", 170, 86, 60, { opacity: 0, scale: 0.6 }),
      ...xShape("Bp", 148, 112, -50, { opacity: 0, scale: 0.6 }),
    },
  };
}

function prophase(): Scene {
  return {
    cells: [BIG_CELL, BIG_CELL],
    nuclei: [{ cx: 160, cy: 100, r: 52, dashed: true }],
    spindles: [],
    chromatin: false,
    chromatids: { ...xShape("Am", 136, 86, 25), ...xShape("Ap", 186, 114, -15), ...xShape("Bm", 182, 78, 55), ...xShape("Bp", 140, 122, -45) },
  };
}

const POLES: [number, number][] = [
  [48, 100],
  [272, 100],
];

function mitosisScenes(): Record<string, Scene> {
  const order = ["Am", "Bm", "Ap", "Bp"];
  const ys = [52, 84, 116, 148];
  const metaphase: Record<string, Placement> = Object.assign({}, ...order.map((c, i) => xShape(c, 160, ys[i], 90)));
  const anaphase: Record<string, Placement> = {};
  const telophase: Record<string, Placement> = {};
  order.forEach((c, i) => {
    const y = 64 + i * 24;
    anaphase[`${c}1`] = { x: 92, y, rot: 90 };
    anaphase[`${c}2`] = { x: 228, y, rot: 90 };
    const ty = 80 + i * 13;
    telophase[`${c}1`] = { x: 95, y: ty, rot: 90, scale: 0.7, opacity: 0.75 };
    telophase[`${c}2`] = { x: 225, y: ty, rot: 90, scale: 0.7, opacity: 0.75 };
  });
  const toCentromeres = (x: number): [number, number][] => ys.map((y) => [x, y]);
  return {
    interfaza: interphase(),
    profaza: prophase(),
    metafaza: { cells: [BIG_CELL, BIG_CELL], nuclei: [], spindles: [{ pole: POLES[0], targets: toCentromeres(160) }, { pole: POLES[1], targets: toCentromeres(160) }], chromatin: false, chromatids: metaphase },
    anafaza: {
      cells: [{ cx: 160, cy: 100, rx: 140, ry: 72 }, { cx: 160, cy: 100, rx: 140, ry: 72 }],
      nuclei: [],
      spindles: [
        { pole: [30, 100], targets: order.map((_, i) => [92, 64 + i * 24]) },
        { pole: [290, 100], targets: order.map((_, i) => [228, 64 + i * 24]) },
      ],
      chromatin: false,
      chromatids: anaphase,
    },
    telofaza: {
      cells: [{ cx: 95, cy: 100, rx: 72, ry: 66 }, { cx: 225, cy: 100, rx: 72, ry: 66 }],
      nuclei: [{ cx: 95, cy: 100, r: 36, dashed: false }, { cx: 225, cy: 100, r: 36, dashed: false }],
      spindles: [],
      chromatin: false,
      chromatids: telophase,
    },
  };
}

function meiosisScenes(sex: Sex): Record<string, Scene> {
  // 4 ta hujayra "o'rni" doim bor: avval hammasi bitta hujayra ustma-ust, keyin juft-juft ajraladi —
  // shunda telofaza II dagi har bir hujayra o'z ona hujayrasidan chiqib keladi.
  const left: CellShape = { cx: 95, cy: 100, rx: 72, ry: 66 };
  const right: CellShape = { cx: 225, cy: 100, rx: 72, ry: 66 };
  const twoCells: CellShape[] = [left, left, right, right];
  const whole = (cell: CellShape): CellShape[] => [cell, cell, cell, cell];
  // Ovogenezda: chapdagi hujayra katta (tuxum), qolganlari kichik (yo'naltiruvchi tanachalar).
  const egg = sex === "urgochi";
  const fourCells: CellShape[] = egg
    ? [{ cx: 58, cy: 100, rx: 50, ry: 62 }, { cx: 140, cy: 100, rx: 26, ry: 32 }, { cx: 205, cy: 100, rx: 26, ry: 32 }, { cx: 270, cy: 100, rx: 26, ry: 32 }]
    : [50, 120, 200, 270].map((cx) => ({ cx, cy: 100, rx: 33, ry: 44 }));
  return {
    interfaza: { ...interphase(), cells: whole(BIG_CELL) },
    profaza1: {
      ...prophase(),
      cells: whole(BIG_CELL),
      // Gomologlar yonma-yon (bivalent).
      chromatids: { ...xShape("Am", 138, 90, 20), ...xShape("Ap", 150, 92, 20), ...xShape("Bm", 178, 116, -30), ...xShape("Bp", 189, 110, -30) },
    },
    metafaza1: {
      cells: whole(BIG_CELL),
      nuclei: [],
      spindles: [
        { pole: POLES[0], targets: [[150, 70], [150, 130]] },
        { pole: POLES[1], targets: [[172, 70], [172, 130]] },
      ],
      chromatin: false,
      // Juftning qaysi tomonga qarashi tasodifiy: A da onadan chapda, B da otadan chapda.
      chromatids: { ...xShape("Am", 150, 70, 90), ...xShape("Ap", 172, 70, 90), ...xShape("Bp", 150, 130, 90), ...xShape("Bm", 172, 130, 90) },
    },
    anafaza1: {
      cells: whole({ cx: 160, cy: 100, rx: 140, ry: 72 }),
      nuclei: [],
      spindles: [
        { pole: [30, 100], targets: [[92, 76], [92, 124]] },
        { pole: [290, 100], targets: [[228, 76], [228, 124]] },
      ],
      chromatin: false,
      chromatids: { ...xShape("Am", 92, 76, 90), ...xShape("Bp", 92, 124, 90), ...xShape("Ap", 228, 76, 90), ...xShape("Bm", 228, 124, 90) },
    },
    telofaza1: {
      cells: twoCells,
      nuclei: [{ cx: 95, cy: 100, r: 38, dashed: false }, { cx: 225, cy: 100, r: 38, dashed: false }],
      spindles: [],
      chromatin: false,
      chromatids: { ...xShape("Am", 88, 92, 20, { scale: 0.8 }), ...xShape("Bp", 104, 110, -20, { scale: 0.8 }), ...xShape("Ap", 218, 92, 20, { scale: 0.8 }), ...xShape("Bm", 234, 110, -20, { scale: 0.8 }) },
    },
    profaza2: {
      cells: twoCells,
      nuclei: [{ cx: 95, cy: 100, r: 40, dashed: true }, { cx: 225, cy: 100, r: 40, dashed: true }],
      spindles: [],
      chromatin: false,
      chromatids: { ...xShape("Am", 84, 88, 35), ...xShape("Bp", 108, 114, -25), ...xShape("Ap", 214, 88, 35), ...xShape("Bm", 238, 114, -25) },
    },
    metafaza2: {
      cells: twoCells,
      nuclei: [],
      spindles: [
        { pole: [32, 100], targets: [[95, 78], [95, 122]] },
        { pole: [158, 100], targets: [[95, 78], [95, 122]] },
        { pole: [162, 100], targets: [[225, 78], [225, 122]] },
        { pole: [288, 100], targets: [[225, 78], [225, 122]] },
      ],
      chromatin: false,
      chromatids: { ...xShape("Am", 95, 78, 90), ...xShape("Bp", 95, 122, 90), ...xShape("Ap", 225, 78, 90), ...xShape("Bm", 225, 122, 90) },
    },
    anafaza2: {
      cells: [{ cx: 95, cy: 100, rx: 76, ry: 58 }, { cx: 95, cy: 100, rx: 76, ry: 58 }, { cx: 225, cy: 100, rx: 76, ry: 58 }, { cx: 225, cy: 100, rx: 76, ry: 58 }],
      nuclei: [],
      spindles: [],
      chromatin: false,
      chromatids: {
        Am1: { x: 62, y: 84, rot: 90 }, Am2: { x: 128, y: 84, rot: 90 }, Bp1: { x: 62, y: 116, rot: 90 }, Bp2: { x: 128, y: 116, rot: 90 },
        Ap1: { x: 192, y: 84, rot: 90 }, Ap2: { x: 258, y: 84, rot: 90 }, Bm1: { x: 192, y: 116, rot: 90 }, Bm2: { x: 258, y: 116, rot: 90 },
      },
    },
    telofaza2: {
      cells: fourCells,
      nuclei: [],
      spindles: [],
      chromatin: false,
      chromatids: Object.fromEntries(
        (
          [
            ["Am1", 0, -8], ["Bp1", 0, 8], ["Am2", 1, -8], ["Bp2", 1, 8], ["Ap1", 2, -8], ["Bm1", 2, 8], ["Ap2", 3, -8], ["Bm2", 3, 8],
          ] as [string, number, number][]
        ).map(([id, cell, dy]) => [id, { x: fourCells[cell].cx, y: fourCells[cell].cy + dy, rot: 90, scale: egg && cell > 0 ? 0.5 : 0.65 }]),
      ),
    },
  };
}

export function divisionScenes(type: DivisionType, sex: Sex): Record<string, Scene> {
  return type === "mitoz" ? mitosisScenes() : meiosisScenes(sex);
}

/** Telofaza II hujayralarining nomlari (ovogenez/spermatogenez). */
export function finalCellLabels(type: DivisionType, sex: Sex): string[] {
  if (type === "mitoz") return ["2n", "2n"];
  if (sex === "urgochi") return ["tuxum", "tanacha", "tanacha", "tanacha"];
  if (sex === "erkak") return ["sperma", "sperma", "sperma", "sperma"];
  return ["n", "n", "n", "n"];
}
