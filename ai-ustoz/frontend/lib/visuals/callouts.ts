/**
 * Chizma chetidagi raqamlar joylashuvi (darslikdagi kabi): har qism uchun raqam
 * chap yoki o'ng ustunga chiqariladi va a'zoga ingichka chiziq bilan ulanadi.
 * Raqamlar bir-birining ustiga tushmasligi uchun vertikal suriladi.
 */

export interface CalloutInput {
  id: string;
  anchor: [number, number];
  side?: "left" | "right";
}

export interface Callout {
  id: string;
  anchor: [number, number];
  marker: [number, number];
  /** Chiziq shu x gacha gorizontal boradi, keyin langarga buriladi (bir ustunda hammasiniki bir xil — chiziqlar kesishmaydi). */
  elbowX: number;
  side: "left" | "right";
}

export interface CalloutLayout {
  viewBox: [number, number, number, number];
  radius: number;
  callouts: Callout[];
}

export function parseViewBox(viewBox: string): [number, number, number, number] {
  const [x, y, w, h] = viewBox.split(/[\s,]+/).map(Number);
  return [x, y, w, h];
}

/** Bir ustundagi raqamlarni langar (anchor) balandligiga yaqin, lekin `gap`dan zich qo'ymasdan joylaydi. */
export function spreadColumn(targets: number[], top: number, bottom: number, gap: number): number[] {
  const placed = targets.map((y) => Math.min(Math.max(y, top), bottom));
  for (let i = 1; i < placed.length; i++) placed[i] = Math.max(placed[i], placed[i - 1] + gap);
  // Pastga sig'masa — pastdan yuqoriga qaytib suriladi.
  if (placed.length && placed[placed.length - 1] > bottom) {
    placed[placed.length - 1] = bottom;
    for (let i = placed.length - 2; i >= 0; i--) placed[i] = Math.min(placed[i], placed[i + 1] - gap);
  }
  return placed;
}

/**
 * Raqam o'rinlarini langarlarga shunday taqsimlaydiki, (elbowX, y) -> langar kesmalari
 * kesishmaydi: ikki kesma kesishsa, o'rinlarini almashtirish umumiy uzunlikni
 * kamaytiradi — almashtirish foyda bermay qolguncha takrorlanadi.
 * Natija: i-langarga ys[order[i]] beriladi.
 */
export function untangle(anchors: [number, number][], ys: number[], elbowX: number): number[] {
  const order = anchors.map((_, i) => i);
  const len = (a: number, slot: number) => Math.hypot(anchors[a][0] - elbowX, anchors[a][1] - ys[slot]);
  for (let pass = 0, improved = true; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        if (len(i, order[j]) + len(j, order[i]) < len(i, order[i]) + len(j, order[j]) - 1e-9) {
          [order[i], order[j]] = [order[j], order[i]];
          improved = true;
        }
      }
    }
  }
  return order;
}

export function layoutCallouts(parts: CalloutInput[], viewBox: string): CalloutLayout {
  const [minX, minY, width, height] = parseViewBox(viewBox);
  const margin = width * 0.14;
  const total = width + margin * 2;
  const radius = total * 0.026;
  const gap = radius * 2.25;
  const centerX = minX + width / 2;

  const sides: Record<"left" | "right", CalloutInput[]> = { left: [], right: [] };
  for (const part of parts) sides[part.side ?? (part.anchor[0] < centerX ? "left" : "right")].push(part);

  const callouts: Callout[] = [];
  for (const side of ["left", "right"] as const) {
    const column = [...sides[side]].sort((a, b) => a.anchor[1] - b.anchor[1]);
    const ys = spreadColumn(
      column.map((part) => part.anchor[1]),
      minY + radius * 1.2,
      minY + height - radius * 1.2,
      gap
    );
    const x = side === "left" ? minX - margin / 2 : minX + width + margin / 2;
    // Tirsak — chizma cheti: raqamdan bu yergacha gorizontal (parallel) chiziq, keyin langarga to'g'ri chiziq.
    const elbowX = side === "left" ? minX : minX + width;
    const order = untangle(column.map((part) => part.anchor), ys, elbowX);
    column.forEach((part, i) => callouts.push({ id: part.id, anchor: part.anchor, marker: [x, ys[order[i]]], elbowX, side }));
  }
  return { viewBox: [minX - margin, minY, total, height], radius, callouts };
}
