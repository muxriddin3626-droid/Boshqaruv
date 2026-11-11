"use client";

import { useMemo } from "react";

import { ANIMALS } from "./anatomy/animals";
import { HUMAN_SYSTEMS } from "./anatomy/human";
import HeartComparison from "./HeartComparison";
import LabeledDiagram from "./LabeledDiagram";

/**
 * Kalitlar ro'yxati — bloklarni ajratishda ishlatiladi. Yurak taqqoslash oxirida:
 * "qush yuragi" qushga, "yurak kameralari" esa taqqoslashga tushadi.
 */
export const ANIMAL_CHOICES: Record<string, { aliases: string[] }> = {
  ...ANIMALS,
  yuraklar: { aliases: ["yuraklar", "yurak", "taqqosla", "kamera"] },
};
export { HUMAN_SYSTEMS };

/** Odam tizimi chizmasi (skelet, qon aylanish, yurak...). */
export function HumanDiagram({ system, highlight }: { system: string; highlight: string[] }) {
  const spec = useMemo(() => HUMAN_SYSTEMS[system].build(), [system]);
  return <LabeledDiagram spec={spec} highlight={highlight} testId={`anatomy-${system}`} />;
}

/** Hayvon ichki/tashqi tuzilishi yoki umurtqalilar yuragini taqqoslash. */
export function AnimalDiagram({ animal, highlight }: { animal: string; highlight: string[] }) {
  const spec = useMemo(() => (animal === "yuraklar" ? null : ANIMALS[animal].build()), [animal]);
  if (!spec) return <HeartComparison highlight={highlight} />;
  return <LabeledDiagram spec={spec} highlight={highlight} testId={`animal-${animal}`} />;
}
