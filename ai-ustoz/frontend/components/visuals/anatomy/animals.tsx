/**
 * Hayvonlar ichki tuzilishi (darslikdagi "yorib ko'rsatilgan" uslubda, 7-sinf
 * zoologiya): baliq, qurbaqa, qush, sutemizuvchi (quyon) — tana yarim shaffof,
 * ichida hajmli a'zolar; hasharot — tashqi tuzilish. Yurak kameralari (DTMda
 * ko'p so'raladigan farq) har birida ko'rsatilgan.
 */
import type { ReactNode } from "react";

import type { DiagramPart, DiagramSpec } from "../LabeledDiagram";
import { mat } from "./materials";

const part = (id: string, name: string, aliases: string[], anchor: [number, number], shape: ReactNode, side?: "left" | "right"): DiagramPart => ({
  id,
  name,
  aliases,
  anchor,
  side,
  shape,
});

/** Naycha (ichak, qizilo'ngach): to'q chet + och o'rta + yaltiroq — hajm ko'rinadi. */
function tube(d: string, outer: string, inner: string, width: number): ReactNode {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={outer} strokeWidth={width + 1.4} />
      <path d={d} stroke={inner} strokeWidth={width} />
      <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth={width * 0.28} transform="translate(-0.4 -0.4)" />
    </g>
  );
}

const gut = (d: string, width = 3.4) => tube(d, "#b4466e", "#f9b4cb", width);

/** Oyoq/qo'l: to'q kontur ustida och rang — tekis chiziq ham "go'shtli" ko'rinadi. */
function limb(d: string, color: string, edge: string, width: number): ReactNode {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={edge} strokeWidth={width + 1.6} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
}

/** Ko'z: oq/oltin rangdor parda, qorachiq va yaltiroq nuqta. */
function eye(cx: number, cy: number, r: number, iris = "#1f2937", pupilWide = false): ReactNode {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={iris} stroke="#0b0b0b" strokeWidth={0.6} />
      {pupilWide ? <ellipse cx={cx} cy={cy} rx={r * 0.6} ry={r * 0.32} fill="#000" /> : <circle cx={cx} cy={cy} r={r * 0.55} fill="#000" />}
      <circle cx={cx - r * 0.3} cy={cy - r * 0.35} r={r * 0.22} fill="#fff" />
    </g>
  );
}

/** Kichik yurak: bo'lmachalar (tepada) va qorinchalar (pastda) hajmli kameralar bilan. */
function miniHeart(x: number, y: number, kind: 2 | 3 | 4, scale = 1): ReactNode {
  const w = 9 * scale;
  const h = 8 * scale;
  const chamber = (cx: number, cy: number, rw: number, rh: number, fill: string) => (
    <ellipse cx={cx} cy={cy} rx={rw} ry={rh} fill={fill} stroke="#fff" strokeWidth={0.6} />
  );
  if (kind === 2) {
    return (
      <g>
        {chamber(x, y - h / 2, w * 0.55, h * 0.5, mat("vein"))}
        <path d={`M${x - w * 0.55} ${y + 1} Q${x} ${y + h * 1.4} ${x + w * 0.55} ${y + 1} Q${x} ${y - 1} ${x - w * 0.55} ${y + 1} Z`} fill={mat("vein")} stroke="#fff" strokeWidth={0.6} />
      </g>
    );
  }
  return (
    <g>
      {chamber(x - w / 2, y - h / 2, w * 0.5, h * 0.48, mat("vein"))}
      {chamber(x + w / 2, y - h / 2, w * 0.5, h * 0.48, mat("artery"))}
      {kind === 3 ? (
        <path d={`M${x - w} ${y + 1} Q${x} ${y + h * 1.7} ${x + w} ${y + 1} Q${x} ${y - 1} ${x - w} ${y + 1} Z`} fill={mat("mixed")} stroke="#fff" strokeWidth={0.6} />
      ) : (
        <>
          <path d={`M${x - w} ${y + 1} Q${x - w * 0.6} ${y + h * 1.3} ${x} ${y + h * 1.4} L${x} ${y} Q${x - w * 0.5} ${y - 1} ${x - w} ${y + 1} Z`} fill={mat("vein")} stroke="#fff" strokeWidth={0.6} />
          <path d={`M${x + w} ${y + 1} Q${x + w * 0.6} ${y + h * 1.3} ${x} ${y + h * 1.4} L${x} ${y} Q${x + w * 0.5} ${y - 1} ${x + w} ${y + 1} Z`} fill={mat("artery")} stroke="#fff" strokeWidth={0.6} />
        </>
      )}
    </g>
  );
}

/** Suzgich qanot: parda + nurlar (bir nuqtadan yelpig'ich shaklida). */
function fin(outline: string, root: [number, number], tips: [number, number][]): ReactNode {
  return (
    <g>
      <path d={outline} fill="rgba(148,163,184,0.45)" stroke="#94a3b8" strokeWidth={0.8} />
      <path d={tips.map(([x, y]) => `M${root[0]} ${root[1]} L${x} ${y}`).join(" ")} stroke="#cbd5e1" strokeWidth={0.6} />
    </g>
  );
}

function fish(): DiagramSpec {
  const BODY = "M44 90 Q74 44 170 42 Q250 46 294 90 Q250 134 170 138 Q74 136 44 90 Z";
  const vertebrae = Array.from({ length: 22 }, (_, i) => {
    const t = 0.06 + i * 0.042;
    const x = (1 - t) ** 2 * 30 + 2 * (1 - t) * t * 64 + t * t * 248;
    const y = (1 - t) ** 2 * 90 + 2 * (1 - t) * t * 56 + t * t * 58;
    return (
      <g key={i}>
        <rect x={x - 2.4} y={y - 2.2} width={4.8} height={4.4} rx={1.2} fill={mat("bone")} stroke="#8f8676" strokeWidth={0.4} />
        {i > 4 && i < 19 && <path d={`M${x} ${y + 2} q-3 14 -6 26`} fill="none" stroke="#e7e1d5" strokeWidth={0.7} opacity={0.75} />}
        <path d={`M${x} ${y - 2} l-2 -8`} stroke="#e7e1d5" strokeWidth={0.7} opacity={0.75} />
      </g>
    );
  });
  return {
    title: "Baliq ichki tuzilishi",
    viewBox: "0 10 320 150",
    base: (
      <g>
        {fin("M46 90 L8 54 Q16 72 18 90 Q16 108 8 126 Z", [44, 90], [[10, 58], [14, 70], [17, 82], [17, 98], [14, 110], [10, 122]])}
        {fin("M136 46 Q150 22 168 16 Q186 26 200 47 Z", [168, 46], [[146, 32], [156, 22], [168, 17], [180, 22], [192, 34]])}
        {fin("M148 134 L162 156 L186 136 Z", [166, 136], [[154, 144], [162, 154], [176, 146]])}
        {fin("M96 128 L84 146 L112 132 Z", [100, 130], [[86, 144], [96, 142]])}
        <path d={BODY} fill={mat("fish")} opacity={0.5} />
        <path d={BODY} fill="url(#p-scales)" />
        {/* Ochilgan tana bo'shlig'i — a'zolar shu yerda */}
        <ellipse cx={170} cy={96} rx={74} ry={30} fill="rgba(255,236,224,0.16)" stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
        <path d={BODY} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
        <path d="M246 60 Q236 90 246 120" fill="none" stroke="#94a3b8" strokeWidth={1.6} />
        {fin("M246 104 Q226 116 214 128 Q232 124 250 110 Z", [248, 106], [[218, 126], [226, 122], [236, 116]])}
        {eye(270, 78, 6, "#e5e7eb")}
        <path d="M290 92 Q284 96 294 98" fill="none" stroke="#475569" strokeWidth={1.2} />
      </g>
    ),
    parts: [
      part("miya", "Bosh miya", ["miya"], [254, 66], <ellipse cx={254} cy={66} rx={8} ry={4.5} fill={mat("brain")} stroke="#b06a8a" strokeWidth={0.5} />),
      part("jabralar", "Jabralar (suvdagi kislorod bilan nafas)", ["jabra"], [232, 96], (
        <g>
          {[224, 230, 236, 242].map((x) => (
            <g key={x}>
              <path d={`M${x} 80 Q${x - 7} 96 ${x} 112`} fill="none" stroke="#e7e1d5" strokeWidth={1.2} />
              <path d={`M${x} 80 Q${x - 7} 96 ${x} 112`} fill="none" stroke="#dc2626" strokeWidth={3.4} strokeDasharray="0.9 0.6" transform="translate(-2 0)" />
            </g>
          ))}
        </g>
      )),
      part("yurak", "Yurak — 2 kamerali (faqat venoz qon)", ["yurak"], [232, 118], miniHeart(232, 118, 2)),
      part("jigar", "Jigar", ["jigar"], [208, 110], <path d="M196 104 Q208 96 222 104 Q224 114 214 118 Q204 122 196 116 Q190 110 196 104 Z" fill={mat("liver")} stroke="#3a1004" strokeWidth={0.5} />),
      part("ichak", "Oshqozon va ichak", ["ichak", "oshqozon"], [150, 118], gut("M214 98 Q192 114 176 110 Q160 122 140 116 Q126 120 112 126 Q104 128 100 124", 3.6)),
      part("suzgich_pufak", "Suzgich pufak (cho'kish/suzish)", ["suzgich", "pufak"], [160, 80], (
        <g>
          <path d="M120 80 Q122 70 150 70 L156 76 L162 70 Q200 70 204 80 Q200 90 162 90 L156 84 L150 90 Q122 90 120 80 Z" fill={mat("swim")} stroke="#64748b" strokeWidth={0.7} />
          <path d="M128 75 Q140 72 148 73 M166 73 Q186 72 196 75" fill="none" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
        </g>
     ), "left"),
      part("buyrak", "Buyraklar", ["buyrak"], [130, 66], <path d="M104 67 Q160 62 216 65 Q160 70 104 69 Z" fill={mat("kidney")} stroke="#4c0519" strokeWidth={1.4} strokeLinejoin="round" />),
      part("jinsiy_bez", "Jinsiy bez (ikra / urug')", ["jinsiy", "ikra"], [150, 102], (
        <g>
          <ellipse cx={150} cy={102} rx={22} ry={6} fill={mat("egg")} stroke="#a16207" strokeWidth={0.5} />
          <ellipse cx={150} cy={102} rx={22} ry={6} fill="url(#p-alveoli)" />
        </g>
      )),
      part("umurtqa", "Umurtqa pog'onasi", ["umurtqa", "skelet"], [56, 75], <g>{vertebrae}</g>),
      part("yon_chiziq", "Yon chiziq (suv tebranishini sezadi)", ["yon chiziq"], [96, 89], (
        <g fill="none">
          <path d="M52 92 Q150 86 246 90" stroke="#0e7490" strokeWidth={1.6} />
          <path d="M52 92 Q150 86 246 90" stroke="#67e8f9" strokeWidth={1.4} strokeDasharray="1 3" />
        </g>
      )),
    ],
  };
}

function frog(): DiagramSpec {
  const GREEN = "#4ea64f";
  const EDGE = "#1f5a2a";
  const side = (mirror: boolean) => (
    <g transform={mirror ? "translate(320 0) scale(-1 1)" : undefined}>
      {limb("M120 98 L94 112 L86 132", GREEN, EDGE, 7)}
      {limb("M86 132 L78 140 M86 132 L82 143 M86 132 L88 144 M86 132 L94 141", GREEN, EDGE, 2)}
      {limb("M128 166 Q96 140 88 156 Q80 170 96 186 L110 196", GREEN, EDGE, 10)}
      <path d="M108 194 L96 206 L104 207 L110 208 L118 206 L124 202 Z" fill={GREEN} stroke={EDGE} strokeWidth={0.8} />
      <path d="M110 196 L96 206 M110 196 L104 207 M110 196 L111 208 M110 196 L118 206 M110 196 L124 202" stroke={EDGE} strokeWidth={0.8} />
    </g>
  );
  return {
    title: "Qurbaqa ichki tuzilishi",
    viewBox: "60 0 200 214",
    maxWidth: 340,
    base: (
      <g>
        {side(false)}
        {side(true)}
        <g>
          <ellipse cx={160} cy={118} rx={48} ry={64} fill={mat("frog")} />
          <ellipse cx={160} cy={48} rx={40} ry={26} fill={mat("frog")} />
          <ellipse cx={160} cy={118} rx={48} ry={64} fill="url(#p-warts)" />
          <ellipse cx={160} cy={48} rx={40} ry={26} fill="url(#p-warts)" />
        </g>
        {/* Ochilgan tana bo'shlig'i */}
        <ellipse cx={160} cy={124} rx={38} ry={54} fill="#2a1a1a" opacity={0.75} stroke="#7f1d1d" strokeWidth={0.8} />
        <path d="M128 64 Q160 76 192 64" fill="none" stroke={EDGE} strokeWidth={1} />
        {eye(140, 34, 7, "#d4a017", true)}
        {eye(180, 34, 7, "#d4a017", true)}
        <circle cx={152} cy={24} r={1.2} fill={EDGE} />
        <circle cx={168} cy={24} r={1.2} fill={EDGE} />
      </g>
    ),
    note: <p>Yurak 3 kamerali: qorinchada arterial va venoz qon aralashadi. Nafas o&apos;pka va teri orqali.</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [160, 46], (
        <g>
          <ellipse cx={160} cy={46} rx={9} ry={6.5} fill={mat("brain")} stroke="#b06a8a" strokeWidth={0.5} />
          <path d="M160 40 L160 52" stroke="#b06a8a" strokeWidth={0.6} />
        </g>
      )),
      part("yurak", "Yurak — 3 kamerali (aralash qon)", ["yurak"], [160, 84], miniHeart(160, 80, 3, 1.2)),
      part("opka", "O'pkalar", ["opka", "o'pka"], [134, 94], (
        <g>
          <ellipse cx={134} cy={94} rx={10} ry={16} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
          <ellipse cx={186} cy={94} rx={10} ry={16} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
          <ellipse cx={134} cy={94} rx={10} ry={16} fill="url(#p-alveoli)" />
          <ellipse cx={186} cy={94} rx={10} ry={16} fill="url(#p-alveoli)" />
        </g>
      )),
      part("jigar", "Jigar", ["jigar"], [148, 108], <path d="M130 102 Q160 92 190 102 Q186 116 172 114 Q160 122 148 114 Q134 116 130 102 Z" fill={mat("liver")} stroke="#3a1004" strokeWidth={0.5} />),
      part("oshqozon", "Oshqozon", ["oshqozon", "meda"], [182, 126], tube("M176 110 Q190 124 180 138 Q172 142 168 134", "#8a1c4d", "#f6a5c8", 5.5)),
      part("ichak", "Ichak", ["ichak"], [148, 144], gut("M168 136 Q146 132 146 142 Q148 152 166 148 Q176 154 160 160 Q148 162 150 168", 3.4)),
      part("buyrak", "Buyraklar", ["buyrak"], [146, 156], (
        <g fill={mat("kidney")} stroke="#3b0412" strokeWidth={0.5}>
          <ellipse cx={146} cy={156} rx={5} ry={12} />
          <ellipse cx={174} cy={156} rx={5} ry={12} />
        </g>
      )),
      part("siydik_pufagi", "Siydik pufagi", ["siydik"], [160, 172], <ellipse cx={160} cy={172} rx={8} ry={5} fill={mat("bladder")} stroke="#a26a05" strokeWidth={0.6} />),
      part("kloaka", "Kloaka", ["kloaka"], [160, 180], <circle cx={160} cy={180} r={3} fill="#7c2d12" stroke="#fdba74" strokeWidth={0.5} />),
    ],
  };
}

function bird(): DiagramSpec {
  const BODY = "M70 110 Q80 70 150 66 Q206 66 222 96 L236 70 Q240 50 252 44 Q268 42 268 58 Q264 70 252 78 L232 112 Q222 152 150 158 Q90 156 70 110 Z";
  return {
    title: "Qush ichki tuzilishi",
    viewBox: "20 20 290 186",
    base: (
      <g>
        {/* Dum patlari (yelpig'ich) */}
        <g fill={mat("feather")} stroke="#78716c" strokeWidth={0.6}>
          {[-14, -7, 0, 7, 14].map((a) => (
            <path key={a} d="M76 112 L30 106 Q26 112 30 118 Z" transform={`rotate(${a} 76 112)`} />
          ))}
        </g>
        {/* Oyoqlar: tangachali, 4 barmoq */}
        {[140, 162].map((x) => (
          <g key={x}>
            {limb(`M${x} 154 L${x - 2} 192`, "#f59e0b", "#92400e", 2.6)}
            {limb(`M${x - 2} 192 L${x - 14} 198 M${x - 2} 192 L${x - 2} 202 M${x - 2} 192 L${x + 10} 198 M${x - 2} 192 L${x + 6} 186`, "#f59e0b", "#92400e", 1.4)}
          </g>
        ))}
        <path d={BODY} fill={mat("feather")} opacity={0.55} />
        <path d={BODY} fill="url(#p-feathers)" />
        <path d={BODY} fill="none" stroke="#d6d3d1" strokeWidth={1} />
        {/* Patli sonlar */}
        {[142, 164].map((x) => (
          <ellipse key={x} cx={x} cy={150} rx={9} ry={7} fill={mat("feather")} opacity={0.7} stroke="#a8a29e" strokeWidth={0.5} />
        ))}
        {/* Qanot (orqaga yig'ilgan) — yarim shaffof patlar */}
        <g fill="none" stroke="rgba(214,211,209,0.55)" strokeWidth={0.9}>
          <path d="M206 88 Q150 74 84 104 Q130 98 196 104" />
          {[100, 114, 128, 142, 156, 170].map((x) => (
            <path key={x} d={`M${x} ${92 - (x - 100) * 0.08} q-12 6 -22 ${8 + (170 - x) * 0.04}`} />
          ))}
        </g>
        {/* Tana bo'shlig'i */}
        <ellipse cx={156} cy={118} rx={66} ry={32} fill="rgba(255,236,224,0.13)" stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
        {/* Tumshuq */}
        <path d="M264 50 L298 60 L264 66 Q260 58 264 50 Z" fill="#f59e0b" stroke="#92400e" strokeWidth={0.8} />
        <path d="M264 58 L296 60" stroke="#92400e" strokeWidth={0.6} />
        {eye(256, 52, 3.6, "#f97316")}
      </g>
    ),
    note: <p>Yurak 4 kamerali, qon aralashmaydi — tana harorati doimiy. Havo xaltachalari parvozda nafasni yengillashtiradi (qo&apos;sh nafas).</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [250, 60], <ellipse cx={250} cy={60} rx={7} ry={5} fill={mat("brain")} stroke="#b06a8a" strokeWidth={0.5} />),
      part("jigildon", "Jig'ildon (ovqat yumshatiladi)", ["jigildon", "jig'ildon", "zob"], [222, 98], (
        <g>
          {tube("M250 68 L222 98", "#a3355f", "#f2a7c3", 2.6)}
          <circle cx={222} cy={100} r={9} fill={mat("stomach")} stroke="#8a1c4d" strokeWidth={0.6} />
        </g>
      )),
      part("yurak", "Yurak — 4 kamerali", ["yurak"], [196, 120], miniHeart(196, 118, 4, 1.2)),
      part("opka", "O'pkalar", ["opka", "o'pka"], [172, 92], (
        <g>
          <ellipse cx={172} cy={92} rx={14} ry={7} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
          <ellipse cx={172} cy={92} rx={14} ry={7} fill="url(#p-alveoli)" />
        </g>
      )),
      part("havo_xaltachalari", "Havo xaltachalari", ["havo xalta"], [126, 96], (
        <g fill="rgba(165,243,252,0.22)" stroke="#67e8f9" strokeWidth={0.8} strokeDasharray="3 2">
          <ellipse cx={126} cy={96} rx={18} ry={9} />
          <ellipse cx={108} cy={124} rx={14} ry={10} />
          <ellipse cx={210} cy={140} rx={11} ry={7} />
        </g>
      )),
      part("bezli_oshqozon", "Bezli oshqozon", ["bezli"], [180, 110], <ellipse cx={180} cy={110} rx={8} ry={5} fill={mat("stomach")} stroke="#8a1c4d" strokeWidth={0.6} />),
      part("muskulli_oshqozon", "Muskulli oshqozon (ovqatni maydalaydi)", ["muskulli", "maydalaydi"], [164, 128], (
        <g>
          <circle cx={164} cy={128} r={11} fill={mat("muscle")} stroke="#4a0808" strokeWidth={0.8} />
          <ellipse cx={164} cy={128} rx={5} ry={3.6} fill="#fde68a" stroke="#a16207" strokeWidth={0.5} />
        </g>
      )),
      part("jigar", "Jigar", ["jigar"], [188, 136], <path d="M176 134 Q186 124 198 132 Q200 142 188 144 Q176 144 176 134 Z" fill={mat("liver")} stroke="#3a1004" strokeWidth={0.5} />),
      part("ichak", "Ichak", ["ichak"], [120, 134], gut("M156 136 Q130 142 118 132 Q100 124 86 120", 3)),
      part("buyrak", "Buyraklar", ["buyrak"], [128, 84], <path d="M114 84 Q120 78 128 82 Q136 78 142 84 Q136 90 128 86 Q120 90 114 84 Z" fill={mat("kidney")} stroke="#3b0412" strokeWidth={0.5} />),
      part("kloaka", "Kloaka", ["kloaka"], [80, 120], <circle cx={80} cy={120} r={3.5} fill="#7c2d12" stroke="#fdba74" strokeWidth={0.5} />),
    ],
  };
}

function mammal(): DiagramSpec {
  const FUR = "#cdb69a";
  const FUR_EDGE = "#6b5440";
  return {
    title: "Sutemizuvchi (quyon) ichki tuzilishi",
    viewBox: "20 4 290 190",
    base: (
      <g>
        {/* Oyoqlar */}
        {limb("M212 150 Q214 168 206 184 L220 186", FUR, FUR_EDGE, 8)}
        {limb("M110 140 Q86 150 90 170 Q94 182 84 186 L118 188", FUR, FUR_EDGE, 12)}
        {/* Quloqlar (ichi pushti) */}
        {[
          ["rotate(-15 246 40)", 246],
          ["rotate(10 262 38)", 262],
        ].map(([t, x]) => (
          <g key={x} transform={t as string}>
            <ellipse cx={x as number} cy={40} rx={8} ry={27} fill={mat("fur")} stroke={FUR_EDGE} strokeWidth={0.8} />
            <ellipse cx={x as number} cy={42} rx={4} ry={20} fill="#f9a8d4" opacity={0.8} />
          </g>
        ))}
        {/* Dum */}
        <circle cx={58} cy={100} r={10} fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.8} />
        <g>
          <ellipse cx={150} cy={112} rx={92} ry={50} fill={mat("fur")} opacity={0.6} />
          <ellipse cx={258} cy={84} rx={32} ry={24} fill={mat("fur")} />
          <ellipse cx={150} cy={112} rx={92} ry={50} fill="none" stroke={FUR_EDGE} strokeWidth={1} strokeDasharray="1.5 1.5" />
        </g>
        {/* Ochilgan ko'krak va qorin bo'shlig'i */}
        <ellipse cx={156} cy={114} rx={78} ry={38} fill="#2a1a1a" opacity={0.7} stroke="#7f1d1d" strokeWidth={0.8} />
        {eye(270, 76, 4.5, "#3f2a1d")}
        <path d="M288 90 L284 94 L289 95 Z" fill="#f472b6" />
        <path d="M286 94 L304 90 M286 95 L305 97 M286 96 L302 102" stroke="#e7e5e4" strokeWidth={0.5} />
      </g>
    ),
    note: <p>Sutemizuvchilarda diafragma ko&apos;krak va qorin bo&apos;shlig&apos;ini ajratadi; yurak 4 kamerali; o&apos;txo&apos;r quyonda ko&apos;richak juda katta.</p>,
    parts: [
      part("miya", "Bosh miya", ["miya"], [256, 76], (
        <g>
          <ellipse cx={256} cy={76} rx={11} ry={8} fill={mat("brain")} stroke="#b06a8a" strokeWidth={0.5} />
          <path d="M248 74 q3 -3 6 0 t6 0 M249 79 q3 3 6 0 t6 0" fill="none" stroke="#b06a8a" strokeWidth={0.5} />
        </g>
      )),
      part("opka", "O'pkalar", ["opka", "o'pka"], [218, 92], (
        <g>
          <path d="M200 96 Q202 80 216 82 Q230 82 230 98 Q228 110 214 108 Q200 108 200 96 Z" fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
          <path d="M200 96 Q202 80 216 82 Q230 82 230 98 Q228 110 214 108 Q200 108 200 96 Z" fill="url(#p-alveoli)" />
        </g>
      )),
      part("yurak", "Yurak — 4 kamerali", ["yurak"], [214, 122], miniHeart(214, 120, 4, 1.2)),
      part("diafragma", "Diafragma", ["diafragma"], [190, 140], (
        <g fill="none" strokeLinecap="round">
          <path d="M196 78 Q186 112 198 150" stroke="#7f1d1d" strokeWidth={3.6} />
          <path d="M196 78 Q186 112 198 150" stroke="#f87171" strokeWidth={2.2} />
        </g>
      )),
      part("jigar", "Jigar", ["jigar"], [178, 104], <path d="M168 96 Q182 84 192 96 Q192 120 178 122 Q164 116 168 96 Z" fill={mat("liver")} stroke="#3a1004" strokeWidth={0.5} />),
      part("oshqozon", "Oshqozon", ["oshqozon", "meda"], [162, 126], tube("M178 118 Q170 134 152 130 Q144 124 150 116", "#8a1c4d", "#f6a5c8", 6)),
      part("ichak", "Ingichka ichak", ["ingichka", "ichak"], [126, 136], gut("M150 132 q-8 8 -16 0 t-16 0 t-16 0 M102 140 q8 8 16 0 t16 0 t16 0", 3)),
      part("korichak", "Ko'richak (o'simlik tolasini hazm qiladi)", ["korichak", "ko'richak"], [86, 130], (
        <g>
          {tube("M100 124 Q84 116 82 130 Q84 144 98 138 Q104 132 96 128", "#8a3208", "#f39a55", 5.5)}
          <path d="M100 124 Q84 116 82 130 Q84 144 98 138" fill="none" stroke="#8a3208" strokeWidth={6} strokeDasharray="0.8 4" />
        </g>
      )),
      part("buyrak", "Buyraklar", ["buyrak"], [128, 88], (
        <g>
          <path d="M128 80 C120 80 120 96 128 96 C132 96 132 90 130 88 C132 86 132 80 128 80 Z" fill={mat("kidney")} stroke="#3b0412" strokeWidth={0.5} />
          <path d="M144 82 C136 82 136 98 144 98 C148 98 148 92 146 90 C148 88 148 82 144 82 Z" fill={mat("kidney")} stroke="#3b0412" strokeWidth={0.5} opacity={0.7} />
        </g>
      )),
      part("siydik_pufagi", "Siydik pufagi", ["siydik"], [86, 112], <ellipse cx={86} cy={112} rx={8} ry={6} fill={mat("bladder")} stroke="#a26a05" strokeWidth={0.6} />),
    ],
  };
}

function insect(): DiagramSpec {
  const LEG = "#65a30d";
  const LEG_EDGE = "#1a2e05";
  const legs = (
    <g>
      {limb("M146 70 L120 62 L104 46 M174 70 L200 62 L216 46", LEG, LEG_EDGE, 2.4)}
      {limb("M144 80 L114 86 L96 100 M176 80 L206 86 L224 100", LEG, LEG_EDGE, 2.4)}
      {/* Orqa (sakrovchi) oyoqlar — sonlari yo'g'on */}
      {limb("M146 92 L118 112", LEG, LEG_EDGE, 5)}
      {limb("M174 92 L202 112", LEG, LEG_EDGE, 5)}
      {limb("M118 112 L110 148 M202 112 L210 148", LEG, LEG_EDGE, 2)}
      <g fill="#fef08a">
        {[[120, 62], [200, 62], [114, 86], [206, 86], [118, 112], [202, 112]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={1.4} />
        ))}
      </g>
    </g>
  );
  const antenna = (d: string) => (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={LEG_EDGE} strokeWidth={2} />
      <path d={d} stroke="#a3e635" strokeWidth={1.2} strokeDasharray="2.2 0.8" />
    </g>
  );
  const wingVeins = (d: string) => <path d={d} fill="none" stroke="#7aa6cc" strokeWidth={0.5} />;
  return {
    title: "Hasharot tashqi tuzilishi",
    viewBox: "40 0 240 210",
    maxWidth: 340,
    note: <p>Tana 3 qismdan iborat: bosh, ko&apos;krak, qorin. 3 juft oyoq va (ko&apos;pchiligida) 2 juft qanot ko&apos;krakka birikkan.</p>,
    parts: [
      part("qanotlar", "Qanotlar (2 juft)", ["qanot"], [236, 100], (
        <g>
          <g fill={mat("wing")} opacity={0.55} stroke="#9cc8ef" strokeWidth={0.8}>
            <path d="M174 86 Q226 118 228 158 Q196 140 174 98 Z" />
            <path d="M146 86 Q94 118 92 158 Q124 140 146 98 Z" />
            <path d="M172 72 Q236 64 254 110 Q220 116 176 86 Z" />
            <path d="M148 72 Q84 64 66 110 Q100 116 144 86 Z" />
          </g>
          {wingVeins("M176 78 Q220 76 250 106 M178 82 Q214 92 240 110 M200 74 L210 100 M224 82 L228 108")}
          {wingVeins("M144 78 Q100 76 70 106 M142 82 Q106 92 80 110 M120 74 L110 100 M96 82 L92 108")}
          {wingVeins("M176 92 Q206 116 224 150 M190 104 L206 134 M144 92 Q114 116 96 150 M130 104 L114 134")}
        </g>
      )),
      part("oyoqlar", "Oyoqlar (3 juft, bo'g'imli)", ["oyoq"], [114, 86], legs),
      part("qorin", "Qorin (bo'g'imlarga bo'lingan)", ["qorin"], [176, 150], (
        <g>
          <ellipse cx={160} cy={140} rx={20} ry={42} fill={mat("insect")} stroke="#365314" strokeWidth={0.8} />
          {[112, 124, 136, 148, 160, 170].map((y) => (
            <path key={y} d={`M${143 + Math.abs(140 - y) / 8} ${y} Q160 ${y + 3} ${177 - Math.abs(140 - y) / 8} ${y}`} fill="none" stroke="#365314" strokeWidth={0.9} />
          ))}
        </g>
      )),
      part("kokrak", "Ko'krak (3 bo'g'im)", ["kokrak", "ko'krak"], [160, 78], (
        <g>
          <ellipse cx={160} cy={78} rx={17} ry={20} fill={mat("insect")} stroke="#365314" strokeWidth={0.8} />
          <path d="M144 72 Q160 75 176 72 M144 86 Q160 89 176 86" fill="none" stroke="#365314" strokeWidth={0.9} />
        </g>
      )),
      part("nafas_teshiklari", "Nafas teshiklari (traxeyalarga)", ["nafas teshik", "traxeya", "dixalsa"], [145, 132], (
        <g fill="#1a2e05" stroke="#fde047" strokeWidth={0.6}>
          {[116, 128, 140, 152, 164].map((y) => (
            <g key={y}>
              <ellipse cx={145 + Math.abs(140 - y) / 10} cy={y + 4} rx={1.4} ry={2} />
              <ellipse cx={175 - Math.abs(140 - y) / 10} cy={y + 4} rx={1.4} ry={2} />
            </g>
          ))}
        </g>
      )),
      part("bosh", "Bosh", ["bosh"], [160, 26], <path d="M145 36 Q145 20 160 20 Q175 20 175 36 Q174 50 160 53 Q146 50 145 36 Z" fill={mat("insect")} stroke="#365314" strokeWidth={0.8} />),
      part("moylov", "Mo'ylovlar (hid va sezgi)", ["moylov", "mo'ylov", "antenna"], [132, 8], <g>{antenna("M154 22 Q140 4 120 2")}{antenna("M166 22 Q180 4 200 2")}</g>),
      part("kozlar", "Murakkab (fasetkali) ko'zlar", ["koz", "ko'z", "fasetka"], [150, 32], (
        <g>
          {[149, 171].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy={32} rx={5.5} ry={6.5} fill="#7c2d12" stroke="#1c0a02" strokeWidth={0.6} />
              <ellipse cx={cx} cy={32} rx={5.5} ry={6.5} fill="url(#p-alveoli)" />
              <circle cx={cx - 1.5} cy={29.5} r={1.2} fill="rgba(255,255,255,0.7)" />
            </g>
          ))}
        </g>
      )),
      part("ogiz", "Og'iz organlari", ["ogiz", "og'iz"], [160, 54], (
        <g fill="#a16207" stroke="#422006" strokeWidth={0.5}>
          <path d="M153 48 L158 58 L160 50 Z" />
          <path d="M167 48 L162 58 L160 50 Z" />
          <path d="M156 52 L152 60 M164 52 L168 60" stroke="#ca8a04" strokeWidth={1.2} />
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
