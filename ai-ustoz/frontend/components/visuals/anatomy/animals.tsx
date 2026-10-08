/**
 * Hayvonlar ichki tuzilishi (sxematik, 7-sinf zoologiya): baliq, qurbaqa, qush,
 * sutemizuvchi (quyon) — yon yoki ustdan ko'rinish; hasharot — tashqi tuzilish.
 * Yurak kameralari (DTMda ko'p so'raladigan farq) har birida ko'rsatilgan.
 */
import type { ReactNode } from "react";

import type { DiagramPart, DiagramSpec } from "../LabeledDiagram";

const ARTERY = "#ef4444";
const VEIN = "#3b82f6";
const MIXED = "#a855f7";
const BODY_STYLE = { fill: "rgba(255,255,255,0.045)", stroke: "rgba(229,231,235,0.35)", strokeWidth: 1.2 };

const part = (id: string, name: string, aliases: string[], marker: [number, number], shape: ReactNode): DiagramPart => ({
  id,
  name,
  aliases,
  marker,
  shape,
});

/** Kichik yurak: bo'lmachalar va qorinchalar rangli kataklar bilan. */
function miniHeart(x: number, y: number, kind: 2 | 3 | 4, scale = 1): ReactNode {
  const w = 9 * scale;
  const h = 8 * scale;
  if (kind === 2) {
    return (
      <g stroke="#fff" strokeWidth={0.6}>
        <rect x={x - w / 2} y={y - h} width={w} height={h} rx={2} fill={VEIN} />
        <rect x={x - w / 2} y={y} width={w} height={h} rx={2} fill={VEIN} opacity={0.8} />
      </g>
    );
  }
  return (
    <g stroke="#fff" strokeWidth={0.6}>
      <rect x={x - w} y={y - h} width={w} height={h} rx={2} fill={VEIN} />
      <rect x={x} y={y - h} width={w} height={h} rx={2} fill={ARTERY} />
      {kind === 3 ? (
        <rect x={x - w} y={y} width={w * 2} height={h} rx={2} fill={MIXED} />
      ) : (
        <>
          <rect x={x - w} y={y} width={w} height={h} rx={2} fill={VEIN} opacity={0.8} />
          <rect x={x} y={y} width={w} height={h} rx={2} fill={ARTERY} opacity={0.85} />
        </>
      )}
    </g>
  );
}

function fish(): DiagramSpec {
  return {
    title: "Baliq ichki tuzilishi",
    viewBox: "0 10 320 150",
    base: (
      <g {...BODY_STYLE}>
        <path d="M44 90 Q74 44 170 42 Q250 46 294 90 Q250 134 170 138 Q74 136 44 90 Z" />
        <path d="M46 90 L10 58 L20 90 L10 122 Z" />
        <path d="M140 45 L168 18 L198 46 Z" />
        <path d="M150 136 L170 154 L186 136 Z" />
        <path d="M244 64 Q236 90 244 116" fill="none" />
        <circle cx={268} cy={80} r={5} fill="rgba(255,255,255,0.3)" />
      </g>
    ),
    parts: [
      part("miya", "Bosh miya", ["miya"], [258, 60], <ellipse cx={258} cy={72} rx={8} ry={5} fill="rgba(244,114,182,0.5)" stroke="#f472b6" />),
      part("jabralar", "Jabralar (suvdagi kislorod bilan nafas)", ["jabra"], [228, 80], (
        <g fill="none" stroke={ARTERY} strokeWidth={2}>
          {[226, 232, 238].map((x) => (
            <path key={x} d={`M${x} 84 Q${x - 6} 98 ${x} 112`} />
          ))}
        </g>
      )),
      part("yurak", "Yurak — 2 kamerali (faqat venoz qon)", ["yurak"], [246, 126], miniHeart(232, 118, 2)),
      part("jigar", "Jigar", ["jigar"], [212, 128], <ellipse cx={208} cy={110} rx={15} ry={9} fill="rgba(180,83,9,0.6)" stroke="#d97706" />),
      part("ichak", "Oshqozon va ichak", ["ichak", "oshqozon"], [150, 128], <path d="M214 98 Q192 114 176 110 Q160 122 140 116 Q126 120 118 126" fill="none" stroke="#f9a8d4" strokeWidth={4} strokeLinecap="round" />),
      part("suzgich_pufak", "Suzgich pufak (cho'kish/suzish)", ["suzgich", "pufak"], [160, 66], <ellipse cx={160} cy={74} rx={42} ry={11} fill="rgba(203,213,225,0.35)" stroke="#cbd5e1" />),
      part("buyrak", "Buyraklar", ["buyrak"], [96, 62], <path d="M100 62 L212 60" stroke="#dc2626" strokeWidth={3} strokeLinecap="round" />),
      part("jinsiy_bez", "Jinsiy bez (ikra / urug')", ["jinsiy", "ikra"], [124, 100], <ellipse cx={150} cy={98} rx={20} ry={6} fill="rgba(250,204,21,0.55)" stroke="#facc15" />),
      part("umurtqa", "Umurtqa pog'onasi", ["umurtqa", "skelet"], [70, 70], <path d="M30 90 Q64 56 248 58" fill="none" stroke="#e7e5e4" strokeWidth={2} strokeDasharray="4 2" />),
      part("yon_chiziq", "Yon chiziq (suv tebranishini sezadi)", ["yon chiziq"], [80, 96], <path d="M52 92 Q150 86 250 90" fill="none" stroke="#67e8f9" strokeWidth={1} strokeDasharray="2 2" />),
    ],
  };
}

function frog(): DiagramSpec {
  return {
    title: "Qurbaqa ichki tuzilishi",
    viewBox: "60 0 200 210",
    maxWidth: 340,
    base: (
      <g {...BODY_STYLE}>
        <ellipse cx={160} cy={48} rx={40} ry={26} />
        <ellipse cx={160} cy={118} rx={48} ry={64} />
        <path d="M118 96 L90 112 L84 132 M202 96 L230 112 L236 132" fill="none" />
        <path d="M128 168 L96 150 L76 186 L110 200 M192 168 L224 150 L244 186 L210 200" fill="none" />
        <circle cx={140} cy={36} r={6} />
        <circle cx={180} cy={36} r={6} />
      </g>
    ),
    note: <p>Yurak 3 kamerali: qorinchada arterial va venoz qon aralashadi. Nafas o&apos;pka va teri orqali.</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [160, 26], <ellipse cx={160} cy={46} rx={8} ry={6} fill="rgba(244,114,182,0.5)" stroke="#f472b6" />),
      part("yurak", "Yurak — 3 kamerali (aralash qon)", ["yurak"], [196, 76], miniHeart(160, 80, 3, 1.2)),
      part("opka", "O'pkalar", ["opka", "o'pka"], [112, 88], (
        <g fill="rgba(251,113,133,0.35)" stroke="#fb7185">
          <ellipse cx={134} cy={94} rx={10} ry={16} />
          <ellipse cx={186} cy={94} rx={10} ry={16} />
        </g>
      )),
      part("jigar", "Jigar", ["jigar"], [208, 106], <path d="M130 102 Q160 92 190 102 Q186 116 172 114 Q160 122 148 114 Q134 116 130 102 Z" fill="rgba(180,83,9,0.6)" stroke="#d97706" />),
      part("oshqozon", "Oshqozon", ["oshqozon", "meda"], [206, 130], <path d="M176 110 Q190 124 180 138 Q172 142 168 134" fill="none" stroke="#f472b6" strokeWidth={5} strokeLinecap="round" />),
      part("ichak", "Ichak", ["ichak"], [112, 140], <path d="M168 136 Q146 132 146 142 Q148 152 166 148 Q176 154 160 160 Q148 162 150 168" fill="none" stroke="#f9a8d4" strokeWidth={3.5} strokeLinecap="round" />),
      part("buyrak", "Buyraklar", ["buyrak"], [122, 162], (
        <g fill="rgba(220,38,38,0.5)" stroke="#dc2626">
          <ellipse cx={146} cy={156} rx={5} ry={12} />
          <ellipse cx={174} cy={156} rx={5} ry={12} />
        </g>
      )),
      part("siydik_pufagi", "Siydik pufagi", ["siydik"], [192, 174], <ellipse cx={160} cy={172} rx={8} ry={5} fill="rgba(250,204,21,0.55)" stroke="#eab308" />),
      part("kloaka", "Kloaka", ["kloaka"], [140, 184], <circle cx={160} cy={180} r={3} fill="#9a3412" />),
    ],
  };
}

function bird(): DiagramSpec {
  return {
    title: "Qush ichki tuzilishi",
    viewBox: "20 20 290 180",
    base: (
      <g {...BODY_STYLE}>
        <ellipse cx={150} cy={112} rx={80} ry={46} />
        <path d="M212 96 Q226 74 240 60" fill="none" strokeWidth={14} stroke="rgba(255,255,255,0.06)" />
        <circle cx={250} cy={56} r={18} />
        <path d="M266 52 L296 60 L266 66 Z" />
        <path d="M72 108 L28 94 L30 112 L28 128 L72 118 Z" />
        <path d="M110 92 Q150 70 210 96" fill="none" strokeDasharray="3 3" />
        <path d="M138 156 L136 192 L126 196 M136 192 L146 196 M164 156 L166 192 L156 196 M166 192 L176 196" fill="none" />
        <circle cx={256} cy={50} r={3} fill="rgba(255,255,255,0.4)" />
      </g>
    ),
    note: <p>Yurak 4 kamerali, qon aralashmaydi — tana harorati doimiy. Havo xaltachalari parvozda nafasni yengillashtiradi (qo&apos;sh nafas).</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [242, 36], <ellipse cx={246} cy={52} rx={8} ry={6} fill="rgba(244,114,182,0.5)" stroke="#f472b6" />),
      part("jigildon", "Jig'ildon (ovqat yumshatiladi)", ["jigildon", "jig'ildon", "zob"], [232, 108], (
        <g>
          <path d="M244 66 L216 98" stroke="#f9a8d4" strokeWidth={3} strokeLinecap="round" />
          <circle cx={216} cy={100} r={9} fill="rgba(249,168,212,0.45)" stroke="#f9a8d4" />
        </g>
      )),
      part("yurak", "Yurak — 4 kamerali", ["yurak"], [212, 132], miniHeart(196, 118, 4, 1.2)),
      part("opka", "O'pkalar", ["opka", "o'pka"], [172, 74], <ellipse cx={172} cy={92} rx={14} ry={7} fill="rgba(251,113,133,0.4)" stroke="#fb7185" />),
      part("havo_xaltachalari", "Havo xaltachalari", ["havo xalta"], [100, 86], (
        <g fill="rgba(103,232,249,0.12)" stroke="#67e8f9" strokeDasharray="3 2">
          <ellipse cx={126} cy={96} rx={18} ry={9} />
          <ellipse cx={108} cy={124} rx={14} ry={10} />
          <ellipse cx={200} cy={140} rx={12} ry={8} />
        </g>
      )),
      part("bezli_oshqozon", "Bezli oshqozon", ["bezli"], [186, 98], <ellipse cx={180} cy={110} rx={8} ry={5} fill="rgba(244,114,182,0.6)" stroke="#f472b6" />),
      part("muskulli_oshqozon", "Muskulli oshqozon (ovqatni maydalaydi)", ["muskulli", "maydalaydi"], [150, 148], <circle cx={164} cy={128} r={11} fill="rgba(153,27,27,0.65)" stroke="#b91c1c" />),
      part("jigar", "Jigar", ["jigar"], [186, 154], <ellipse cx={186} cy={134} rx={12} ry={8} fill="rgba(180,83,9,0.6)" stroke="#d97706" />),
      part("ichak", "Ichak", ["ichak"], [116, 146], <path d="M156 136 Q130 142 118 132 Q100 124 86 120" fill="none" stroke="#f9a8d4" strokeWidth={3} strokeLinecap="round" />),
      part("buyrak", "Buyraklar", ["buyrak"], [116, 78], <ellipse cx={128} cy={84} rx={14} ry={4} fill="rgba(220,38,38,0.5)" stroke="#dc2626" />),
      part("kloaka", "Kloaka", ["kloaka"], [66, 132], <circle cx={80} cy={120} r={3.5} fill="#9a3412" />),
    ],
  };
}

function mammal(): DiagramSpec {
  return {
    title: "Sutemizuvchi (quyon) ichki tuzilishi",
    viewBox: "20 10 290 180",
    base: (
      <g {...BODY_STYLE}>
        <ellipse cx={150} cy={112} rx={92} ry={50} />
        <ellipse cx={258} cy={84} rx={32} ry={24} />
        <ellipse cx={246} cy={40} rx={7} ry={26} transform="rotate(-15 246 40)" />
        <ellipse cx={262} cy={38} rx={7} ry={26} transform="rotate(10 262 38)" />
        <circle cx={58} cy={100} r={9} />
        <path d="M200 150 L204 184 M106 150 L96 182 Q120 186 126 180" fill="none" />
        <circle cx={270} cy={78} r={3} fill="rgba(255,255,255,0.4)" />
      </g>
    ),
    note: <p>Sutemizuvchilarda diafragma ko&apos;krak va qorin bo&apos;shlig&apos;ini ajratadi; yurak 4 kamerali; o&apos;txo&apos;r quyonda ko&apos;richak juda katta.</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [270, 60], <ellipse cx={256} cy={76} rx={11} ry={8} fill="rgba(244,114,182,0.5)" stroke="#f472b6" />),
      part("opka", "O'pkalar", ["opka", "o'pka"], [222, 72], <ellipse cx={214} cy={96} rx={16} ry={14} fill="rgba(251,113,133,0.35)" stroke="#fb7185" />),
      part("yurak", "Yurak — 4 kamerali", ["yurak"], [232, 132], miniHeart(214, 120, 4, 1.2)),
      part("diafragma", "Diafragma", ["diafragma"], [198, 160], <path d="M196 70 Q186 112 198 154" fill="none" stroke="#fca5a5" strokeWidth={2.5} />),
      part("jigar", "Jigar", ["jigar"], [170, 82], <path d="M168 96 Q182 84 192 96 Q192 120 178 122 Q164 116 168 96 Z" fill="rgba(180,83,9,0.6)" stroke="#d97706" />),
      part("oshqozon", "Oshqozon", ["oshqozon", "meda"], [160, 150], <path d="M178 118 Q170 134 152 130 Q144 124 150 116" fill="none" stroke="#f472b6" strokeWidth={6} strokeLinecap="round" />),
      part("ichak", "Ingichka ichak", ["ingichka", "ichak"], [118, 156], <path d="M150 132 q-8 8 -16 0 t-16 0 t-16 0 M102 140 q8 8 16 0 t16 0 t16 0" fill="none" stroke="#f9a8d4" strokeWidth={3} strokeLinecap="round" />),
      part("korichak", "Ko'richak (o'simlik tolasini hazm qiladi)", ["korichak", "ko'richak"], [80, 150], <path d="M100 124 Q84 116 82 130 Q84 144 98 138 Q104 132 96 128" fill="none" stroke="#fb923c" strokeWidth={5} strokeLinecap="round" />),
      part("buyrak", "Buyraklar", ["buyrak"], [132, 70], <path d="M128 80 C120 80 120 96 128 96 C132 96 132 90 130 88 C132 86 132 80 128 80 Z" fill="rgba(220,38,38,0.5)" stroke="#dc2626" />),
      part("siydik_pufagi", "Siydik pufagi", ["siydik"], [66, 124], <ellipse cx={80} cy={112} rx={8} ry={6} fill="rgba(250,204,21,0.55)" stroke="#eab308" />),
    ],
  };
}

function insect(): DiagramSpec {
  const legs = (
    <g fill="none" stroke="#a3e635" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M146 70 L120 62 L104 46 M174 70 L200 62 L216 46" />
      <path d="M144 80 L114 86 L96 100 M176 80 L206 86 L224 100" />
      <path d="M146 90 L120 112 L112 146 M174 90 L200 112 L208 146" />
    </g>
  );
  return {
    title: "Hasharot tashqi tuzilishi",
    viewBox: "40 0 240 210",
    maxWidth: 340,
    note: <p>Tana 3 qismdan iborat: bosh, ko&apos;krak, qorin. 3 juft oyoq va (ko&apos;pchiligida) 2 juft qanot ko&apos;krakka birikkan.</p>,
    parts: [
      part("bosh", "Bosh", ["bosh"], [184, 30], <circle cx={160} cy={36} r={15} fill="rgba(132,204,22,0.35)" stroke="#84cc16" />),
      part("moylov", "Mo'ylovlar (hid va sezgi)", ["moylov", "mo'ylov", "antenna"], [216, 10], <path d="M154 24 Q140 4 120 2 M166 24 Q180 4 200 2" fill="none" stroke="#a3e635" strokeWidth={1.5} />),
      part("kozlar", "Murakkab (fasetkali) ko'zlar", ["koz", "ko'z", "fasetka"], [126, 32], (
        <g fill="rgba(56,189,248,0.6)" stroke="#38bdf8">
          <ellipse cx={149} cy={32} rx={5} ry={6} />
          <ellipse cx={171} cy={32} rx={5} ry={6} />
        </g>
      )),
      part("ogiz", "Og'iz organlari", ["ogiz", "og'iz"], [184, 52], <path d="M154 48 L160 56 L166 48" fill="none" stroke="#fde047" strokeWidth={1.5} />),
      part("kokrak", "Ko'krak (3 bo'g'im)", ["kokrak", "ko'krak"], [128, 76], (
        <g fill="rgba(132,204,22,0.3)" stroke="#84cc16">
          <ellipse cx={160} cy={78} rx={17} ry={20} />
          <path d="M144 72 L176 72 M144 86 L176 86" />
        </g>
      )),
      part("qanotlar", "Qanotlar (2 juft)", ["qanot"], [252, 120], (
        <g fill="rgba(186,230,253,0.18)" stroke="#bae6fd" strokeWidth={1}>
          <path d="M172 72 Q236 64 254 110 Q220 116 176 86 Z" />
          <path d="M148 72 Q84 64 66 110 Q100 116 144 86 Z" />
          <path d="M174 86 Q226 118 228 158 Q196 140 174 98 Z" opacity={0.8} />
          <path d="M146 86 Q94 118 92 158 Q124 140 146 98 Z" opacity={0.8} />
        </g>
      )),
      part("oyoqlar", "Oyoqlar (3 juft, bo'g'imli)", ["oyoq"], [94, 112], legs),
      part("qorin", "Qorin (bo'g'imlarga bo'lingan)", ["qorin"], [192, 150], (
        <g fill="rgba(132,204,22,0.25)" stroke="#84cc16">
          <ellipse cx={160} cy={140} rx={20} ry={42} />
          {[112, 124, 136, 148, 160, 170].map((y) => (
            <path key={y} d={`M${143 + Math.abs(140 - y) / 8} ${y} L${177 - Math.abs(140 - y) / 8} ${y}`} />
          ))}
        </g>
      )),
      part("nafas_teshiklari", "Nafas teshiklari (traxeyalarga)", ["nafas teshik", "traxeya", "dixalsa"], [128, 160], (
        <g fill="#fde047">
          {[116, 128, 140, 152, 164].map((y) => (
            <g key={y}>
              <circle cx={143 + Math.abs(140 - y) / 10} cy={y + 4} r={1.6} />
              <circle cx={177 - Math.abs(140 - y) / 10} cy={y + 4} r={1.6} />
            </g>
          ))}
        </g>
      )),
    ],
  };
}

export const ANIMALS: Record<string, { build: () => DiagramSpec; aliases: string[] }> = {
  baliq: { build: fish, aliases: ["baliq", "fish"] },
  qurbaqa: { build: frog, aliases: ["qurbaqa", "baqa", "amfibiya", "suvda va quruqlikda"] },
  qush: { build: bird, aliases: ["qush", "kaptar", "tovuq"] },
  sutemizuvchi: { build: mammal, aliases: ["sutemizuvchi", "quyon", "sut emizuvchi"] },
  hasharot: { build: insect, aliases: ["hasharot", "chigirtka", "qo'ng'iz", "qongiz", "insect"] },
};

// --- Yurak kameralari taqqoslash ------------------------------------------------------

export const HEART_CLASSES = [
  { id: "baliq", name: "Baliqlar", kind: 2 as const, chambers: "2 kamerali", circles: 1, blood: "faqat venoz qon", warm: false },
  { id: "suvda_quruqlikda", name: "Suvda va quruqlikda yashovchilar", kind: 3 as const, chambers: "3 kamerali", circles: 2, blood: "qorinchada aralash", warm: false },
  { id: "sudralib", name: "Sudralib yuruvchilar", kind: 3 as const, chambers: "3 kamerali (qorinchada to'liqsiz to'siq)", circles: 2, blood: "kam aralashadi", warm: false, partial: true },
  { id: "qush", name: "Qushlar", kind: 4 as const, chambers: "4 kamerali", circles: 2, blood: "aralashmaydi", warm: true },
  { id: "sutemizuvchi", name: "Sutemizuvchilar", kind: 4 as const, chambers: "4 kamerali", circles: 2, blood: "aralashmaydi", warm: true },
];
