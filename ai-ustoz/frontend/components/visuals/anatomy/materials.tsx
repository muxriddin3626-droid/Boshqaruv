/**
 * "Materiallar": a'zolarga hajm beruvchi gradiyentlar (yorug'lik yuqori-chapdan),
 * yumshoq soya va to'qima naqshlari. Har bir chizmaga bir xil `<defs>` qo'shiladi —
 * id'lar takrorlansa ham ta'riflar bir xil, shuning uchun to'qnashuv zarari yo'q.
 */

export const MATERIALS = {
  skin: ["#fde7d6", "#c99a7e"],
  bone: ["#fffdf5", "#bfb5a3"],
  liver: ["#b4532a", "#4a1406"],
  lung: ["#fecdd3", "#d9587a"],
  heart: ["#f05252", "#6b1010"],
  muscle: ["#e2483d", "#6b1010"],
  stomach: ["#fbcfe8", "#c0266d"],
  intestine: ["#fed7aa", "#b8460f"],
  small: ["#ffe4e6", "#e7678f"],
  kidney: ["#c0392b", "#4c0519"],
  bladder: ["#fef3c7", "#d08a0a"],
  brain: ["#fdf0f6", "#d38fae"],
  spleen: ["#a855f7", "#36064f"],
  pancreas: ["#fef08a", "#b7860b"],
  gall: ["#5fe08f", "#14532d"],
  gland: ["#fdba74", "#b8460f"],
  artery: ["#ff6b6b", "#8f1414"],
  vein: ["#6aa8ff", "#1b3a8a"],
  nerve: ["#fffbe0", "#e3b508"],
  cartilage: ["#e8f6ff", "#7cc6ef"],
  fish: ["#e2e8f0", "#526073"],
  frog: ["#a3e8a3", "#1f6b35"],
  feather: ["#f5f5f4", "#8a837c"],
  fur: ["#efe0cc", "#8b6f55"],
  insect: ["#c8f06a", "#3f6212"],
  wing: ["#eef8ff", "#9cc8ef"],
  swim: ["#f8fafc", "#94a3b8"],
  mixed: ["#c99cff", "#5b1d99"],
  egg: ["#fff3b0", "#c9a206"],
  // Hujayra organoidlari
  cytoplasm: ["#fdf2f8", "#f9a8d4"],
  plantcyto: ["#f0fdf4", "#86efac"],
  nucleus: ["#e9d5ff", "#7e22ce"],
  nucleolus: ["#c084fc", "#3b0764"],
  mito: ["#fed7aa", "#c2410c"],
  chloro: ["#bbf7d0", "#15803d"],
  vacuole: ["#e0f2fe", "#38bdf8"],
  lyso: ["#d9f99d", "#4d7c0f"],
  golgi: ["#fef9c3", "#ca8a04"],
  er: ["#e0f2fe", "#0284c7"],
} as const;

export type Material = keyof typeof MATERIALS;

/** `fill={mat("liver")}` */
export function mat(name: Material): string {
  return `url(#m-${name})`;
}

/**
 * Soya va yorug'lik filtrlari uchun soha: butun chizma (userSpaceOnUse). Odatiy
 * "objectBoundingBox" sohasi tik/yotiq tomir kabi eni nol shakllarni butunlay
 * kesib tashlaydi, shuning uchun har chizmaga o'z id'si va sohasi bilan filtr beriladi.
 */
export function ShapeFilters({ shadowId, glowId, region }: { shadowId: string; glowId: string; region: [number, number, number, number] }) {
  const [x, y, width, height] = region;
  const box = { x, y, width, height, filterUnits: "userSpaceOnUse" as const };
  return (
    <defs>
      <filter id={shadowId} {...box}>
        <feDropShadow dx="0.5" dy="1.2" stdDeviation="1" floodColor="#000" floodOpacity="0.55" />
      </filter>
      <filter id={glowId} {...box}>
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

export function MaterialDefs() {
  return (
    <defs>
      {Object.entries(MATERIALS).map(([name, [light, dark]]) => (
        <radialGradient key={name} id={`m-${name}`} cx="35%" cy="28%" r="85%">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={dark} stopOpacity={0.92} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      ))}
      <linearGradient id="m-bone-shaft" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#bfb5a3" />
        <stop offset="0.45" stopColor="#fffdf5" />
        <stop offset="1" stopColor="#a39886" />
      </linearGradient>
      <pattern id="p-alveoli" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="2.5" cy="2.5" r="1.1" fill="rgba(255,255,255,0.28)" />
      </pattern>
      <pattern id="p-scales" width="8" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 6 Q4 0 8 6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      </pattern>
      <pattern id="p-feathers" width="7" height="5" patternUnits="userSpaceOnUse">
        <path d="M0 5 Q3.5 1 7 5" fill="none" stroke="rgba(90,80,70,0.45)" strokeWidth="0.6" />
      </pattern>
      <pattern id="p-warts" width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.3" fill="rgba(20,83,45,0.5)" />
        <circle cx="7" cy="7" r="0.9" fill="rgba(20,83,45,0.4)" />
      </pattern>
    </defs>
  );
}
