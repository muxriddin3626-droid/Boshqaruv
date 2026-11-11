/**
 * "Zarrachalar" modeli: reaksiyagacha va keyin molekulalar atom-sharchalar bilan.
 * Har bir atomning ikkala holatdagi o'rni hisoblanadi — komponent ularni silliq
 * ko'chiradi: atomlar yo'qolmaydi va paydo bo'lmaydi, faqat qayta guruhlanadi
 * (massaning saqlanish qonuni ko'z bilan ko'rinadi).
 */
import type { Reaction, Species } from "./reaction";

export const PARTICLE_LIMITS = { atomsPerMolecule: 12, totalAtoms: 60, coefficient: 8 };

export interface Point {
  x: number;
  y: number;
}

export interface ParticleAtom {
  id: string;
  element: string;
  radius: number;
  before: Point;
  after: Point;
}

export interface ParticleLabel {
  x: number;
  text: string;
}

export interface ParticleLayout {
  width: number;
  height: number;
  atoms: ParticleAtom[];
  before: { labels: ParticleLabel[]; pluses: number[] };
  after: { labels: ParticleLabel[]; pluses: number[] };
}

const BIG = new Set(["Na", "K", "Ca", "Ba", "Fe", "Cu", "Zn", "Ag", "Al", "Mg", "Pb", "Cl", "Br", "I", "S", "P", "Li", "Mn", "Cr", "Hg"]);

export function atomRadius(element: string): number {
  return element === "H" ? 6 : BIG.has(element) ? 10.5 : 8.5;
}

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** "Fe2(SO4)3" -> "Fe₂(SO₄)₃" (koeffitsiyent oldida oddiy raqam). */
export function prettyFormula(formula: string): string {
  const sup = (text: string) => text.replace(/\d/g, (d) => SUPERSCRIPT[Number(d)]).replace("+", "⁺").replace("-", "⁻");
  // Zaryad: "SO4^2-" (ko'p zaryad faqat ^ bilan), "NH4+" (oxirgi raqam — indeks, zaryad 1).
  let charge = "";
  let body = formula;
  const multi = body.match(/\^(\d*)([+-])$/) ?? body.match(/([+-])$/);
  if (multi) {
    charge = sup(multi.length === 3 ? `${multi[1]}${multi[2]}` : multi[1]);
    body = body.slice(0, body.length - multi[0].length);
  }
  return body.replace(/([A-Za-z)\]])(\d+)/g, (_, before: string, digits: string) => before + digits.replace(/\d/g, (d) => SUBSCRIPT[Number(d)])).replace(/\*/g, "·") + charge;
}

interface Molecule {
  atoms: { element: string; dx: number; dy: number; radius: number }[];
  width: number;
  height: number;
}

/** Bitta molekulaning atomlari: markaziy atom (bitta bo'lgan, H/O emas) atrofida halqa; yo'q bo'lsa — qatorlar. */
export function moleculeShape(species: Species): Molecule {
  const list = Object.entries(species.atoms).flatMap(([element, count]) => Array<string>(count).fill(element));
  const once = Object.entries(species.atoms).filter(([, count]) => count === 1).map(([element]) => element);
  const center = once.find((element) => element !== "H" && element !== "O") ?? (list.length > 2 ? once[0] : undefined);
  const placed: Molecule["atoms"] = [];
  if (center) {
    const rc = atomRadius(center);
    placed.push({ element: center, dx: 0, dy: 0, radius: rc });
    const others = [...list];
    others.splice(others.indexOf(center), 1);
    others.forEach((element, i) => {
      const r = atomRadius(element);
      const angle = others.length === 2 ? (i === 0 ? 150 : 30) : -90 + (i * 360) / others.length;
      const distance = (rc + r) * 0.82;
      placed.push({ element, dx: distance * Math.cos((angle * Math.PI) / 180), dy: distance * Math.sin((angle * Math.PI) / 180), radius: r });
    });
  } else {
    // Ikki atomli (H2, O2) yoki markazsiz (C2H6) — yonma-yon qatorlar, atomlar bir-biriga tegib turadi.
    const perRow = list.length <= 3 ? list.length : Math.ceil(Math.sqrt(list.length * 2));
    // Qadam radiusga bog'liq va ikki radius yig'indisidan kichik — atomlar bir-biriga kirib turadi (bog'langan ko'rinadi).
    const step = Math.max(...list.map(atomRadius)) * 1.55;
    list.forEach((element, i) => {
      const r = atomRadius(element);
      placed.push({ element, dx: (i % perRow) * step, dy: Math.floor(i / perRow) * step, radius: r });
    });
    const maxX = Math.max(...placed.map((a) => a.dx));
    const maxY = Math.max(...placed.map((a) => a.dy));
    placed.forEach((a) => {
      a.dx -= maxX / 2;
      a.dy -= maxY / 2;
    });
  }
  const left = Math.min(...placed.map((a) => a.dx - a.radius));
  const right = Math.max(...placed.map((a) => a.dx + a.radius));
  const top = Math.min(...placed.map((a) => a.dy - a.radius));
  const bottom = Math.max(...placed.map((a) => a.dy + a.radius));
  // Molekula markazi bounding-box markaziga keltiriladi.
  placed.forEach((a) => {
    a.dx -= (left + right) / 2;
    a.dy -= (top + bottom) / 2;
  });
  return { atoms: placed, width: right - left, height: bottom - top };
}

interface Slot {
  element: string;
  radius: number;
  point: Point;
}

const GROUP_GAP = 26;
const COPY_GAP = 10;
const PAD = 14;
const LABEL_SPACE = 22;

function layoutSide(side: Species[]): { slots: Slot[]; width: number; height: number; labels: ParticleLabel[]; pluses: number[] } {
  const groups = side
    .filter((species) => Object.keys(species.atoms).length)
    .map((species) => {
      const shape = moleculeShape(species);
      const copies = species.coefficient;
      return { species, shape, copies, width: shape.width, height: copies * shape.height + (copies - 1) * COPY_GAP };
    });
  const height = Math.max(...groups.map((g) => g.height));
  const slots: Slot[] = [];
  const labels: ParticleLabel[] = [];
  const pluses: number[] = [];
  let x = 0;
  groups.forEach((group, gi) => {
    if (gi > 0) {
      pluses.push(x + GROUP_GAP / 2);
      x += GROUP_GAP;
    }
    const cx = x + group.width / 2;
    const top = (height - group.height) / 2;
    for (let c = 0; c < group.copies; c++) {
      const cy = top + c * (group.shape.height + COPY_GAP) + group.shape.height / 2;
      for (const atom of group.shape.atoms) slots.push({ element: atom.element, radius: atom.radius, point: { x: cx + atom.dx, y: cy + atom.dy } });
    }
    labels.push({ x: cx, text: `${group.copies > 1 ? group.copies : ""}${prettyFormula(group.species.formula)}` });
    x += group.width;
  });
  return { slots, width: x, height, labels, pluses };
}

/** Zarrachalar modelini chizib bo'ladimi: butun koeffitsiyentlar, tenglashgan, juda katta emas. */
export function particleProblem(reaction: Reaction): string | null {
  const all = [...reaction.reactants, ...reaction.products];
  if (all.some((s) => !Number.isInteger(s.coefficient) || s.coefficient > PARTICLE_LIMITS.coefficient)) return "koeffitsiyentlar juda katta";
  if (all.some((s) => Object.values(s.atoms).reduce((a, b) => a + b, 0) > PARTICLE_LIMITS.atomsPerMolecule)) return "molekulalar juda katta";
  const total = reaction.reactants.reduce((sum, s) => sum + s.coefficient * Object.values(s.atoms).reduce((a, b) => a + b, 0), 0);
  if (total > PARTICLE_LIMITS.totalAtoms) return "atomlar juda ko'p";
  return null;
}

export function particleLayout(reaction: Reaction): ParticleLayout {
  const before = layoutSide(reaction.reactants);
  const after = layoutSide(reaction.products);
  const width = Math.max(before.width, after.width) + PAD * 2;
  const height = Math.max(before.height, after.height) + PAD * 2 + LABEL_SPACE;
  const shift = (side: typeof before) => ({ dx: (width - side.width) / 2, dy: PAD + (Math.max(before.height, after.height) - side.height) / 2 });
  const sb = shift(before);
  const sa = shift(after);
  // Har bir element bo'yicha: chapdagi atomlar o'ngdagi o'rinlarga (ikkalasi x, keyin y bo'yicha tartiblangan) — yo'llar kam kesishadi.
  const order = (a: Slot, b: Slot) => a.point.x - b.point.x || a.point.y - b.point.y;
  const atoms: ParticleAtom[] = [];
  const elements = [...new Set(before.slots.map((s) => s.element))];
  for (const element of elements) {
    const from = before.slots.filter((s) => s.element === element).sort(order);
    const to = after.slots.filter((s) => s.element === element).sort(order);
    from.forEach((slot, i) => {
      const target = to[i] ?? slot;
      atoms.push({
        id: `${element}-${i}`,
        element,
        radius: slot.radius,
        before: { x: slot.point.x + sb.dx, y: slot.point.y + sb.dy },
        after: to[i] ? { x: target.point.x + sa.dx, y: target.point.y + sa.dy } : { x: slot.point.x + sb.dx, y: slot.point.y + sb.dy },
      });
    });
  }
  const labelY = (labels: ParticleLabel[], dx: number) => labels.map((l) => ({ ...l, x: l.x + dx }));
  return {
    width,
    height,
    atoms,
    before: { labels: labelY(before.labels, sb.dx), pluses: before.pluses.map((x) => x + sb.dx) },
    after: { labels: labelY(after.labels, sa.dx), pluses: after.pluses.map((x) => x + sa.dx) },
  };
}

/** Atom ranglari (CPK uslubi) va ichidagi yozuv rangi. */
export function atomColors(element: string): { fill: string; text: string } {
  const table: Record<string, string> = {
    H: "#f8fafc", C: "#3f3f46", N: "#3b82f6", O: "#ef4444", F: "#84cc16", Cl: "#22c55e", Br: "#b45309", I: "#7e22ce",
    S: "#facc15", P: "#f97316", Na: "#a855f7", K: "#9333ea", Li: "#c084fc", Mg: "#15803d", Ca: "#16a34a", Ba: "#166534",
    Fe: "#ea580c", Cu: "#c2410c", Zn: "#94a3b8", Al: "#cbd5e1", Ag: "#d4d4d8", Mn: "#be185d", Cr: "#0f766e", Pb: "#475569", Hg: "#a1a1aa",
  };
  const fill = table[element] ?? "#ec4899";
  const light = ["H", "S", "Al", "Ag", "Zn", "Hg", "F"].includes(element);
  return { fill, text: light ? "#111827" : "#ffffff" };
}
