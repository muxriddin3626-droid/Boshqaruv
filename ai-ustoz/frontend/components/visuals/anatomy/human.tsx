/**
 * Odam anatomiyasi chizmalari (old tomondan, darslik uslubida). Hammasi bitta
 * 240x440 koordinatalar tizimida: yarim-shaffof tana ichida hajmli a'zolar;
 * tizim kerakli joyga "kesib" ko'rsatiladi (viewBox). Chap/o'ng — odamning
 * o'zinikiga ko'ra: uning o'ng o'pkasi ekranda chapda.
 *
 * Eslatma: gradiyent faqat yuzali shakllarga beriladi. Tik/yotiq to'g'ri
 * chiziqning chegaraviy qutisi nol kenglikda bo'lgani uchun unga qo'yilgan
 * gradiyent brauzerda ko'rinmay qoladi — suyak va tomirlar shuning uchun
 * yuzali shakl yoki rangli chiziq bilan chiziladi.
 */
import type { ReactNode } from "react";

import type { DiagramPart, DiagramSpec } from "../LabeledDiagram";
import { mat } from "./materials";

const ARTERY = "#e23b3b";
const ARTERY_DARK = "#7f1212";
const VEIN = "#3d7be0";
const VEIN_DARK = "#173b85";
const NERVE = "#f6d860";

/** Shaklni o'rta chiziqqa nisbatan ko'zgu aksi bilan ikki tomonga chizadi. */
function both(node: ReactNode): ReactNode {
  return (
    <g>
      {node}
      <g transform="translate(240 0) scale(-1 1)">{node}</g>
    </g>
  );
}

const part = (id: string, name: string, aliases: string[], anchor: [number, number], shape: ReactNode, side?: "left" | "right"): DiagramPart => ({
  id,
  name,
  aliases,
  anchor,
  side,
  shape,
});

/** Naycha (tomir, ichak): to'q chet + och o'rta — hajm ko'rinadi. */
function tube(d: string, outer: string, inner: string, width: number): ReactNode {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={outer} strokeWidth={width + 1.4} />
      <path d={d} stroke={inner} strokeWidth={width} />
      <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth={width * 0.28} transform="translate(-0.4 -0.4)" />
    </g>
  );
}

const artery = (d: string, w = 1.8) => tube(d, ARTERY_DARK, ARTERY, w);
const vein = (d: string, w = 1.8) => tube(d, VEIN_DARK, VEIN, w);

/** Naysimon suyak: tana (to'rtburchak) + ikki bo'rtgan uch (epifiz). */
function longBone(x1: number, y1: number, x2: number, y2: number, w: number): ReactNode {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  const shaft = `M${x1 + nx} ${y1 + ny} L${x2 + nx} ${y2 + ny} L${x2 - nx} ${y2 - ny} L${x1 - nx} ${y1 - ny} Z`;
  return (
    <g fill={mat("bone")} stroke="#8f8676" strokeWidth={0.5}>
      <path d={shaft} />
      <ellipse cx={x1} cy={y1} rx={w * 0.95} ry={w * 0.75} />
      <ellipse cx={x2} cy={y2} rx={w * 0.95} ry={w * 0.75} />
    </g>
  );
}

// --- Tana konturi ------------------------------------------------------------------

const HALF_CONTOUR =
  "M111 58 C111 66 110 72 108 77 C100 80 86 82 76 86 C66 89 60 96 59 108 C57 128 54 148 53 168 " +
  "C52 190 49 214 46 238 C45 246 43 252 41 258 C38 268 38 278 43 283 C47 287 52 284 53 278 " +
  "C54 270 55 262 56 254 C58 246 59 238 60 230 C62 210 64 192 65 172 C66 152 68 134 72 120 " +
  "C74 140 76 166 80 196 C81 214 76 236 75 256 C74 290 78 320 82 350 C83 372 80 392 83 412 " +
  "C84 420 86 424 86 428 C80 432 78 438 84 440 C94 442 104 441 110 438 C111 432 110 426 109 420 " +
  "C109 396 110 372 108 350 C108 326 112 304 118 290 C119 288 120 287 120 286";

const BODY = (
  <g>
    {both(<path d={`${HALF_CONTOUR} L120 58 Z`} fill={mat("skin")} opacity={0.16} />)}
    <ellipse cx={120} cy={35} rx={21} ry={26} fill={mat("skin")} opacity={0.16} />
    <g fill="none" stroke="#e8c4ad" strokeOpacity={0.5} strokeWidth={0.9}>
      {both(<path d={HALF_CONTOUR} />)}
      <ellipse cx={120} cy={35} rx={21} ry={26} />
      {both(<ellipse cx={99} cy={38} rx={2.5} ry={6} />)}
    </g>
  </g>
);

// --- A'zolar --------------------------------------------------------------------------

const BRAIN = (
  <g>
    <ellipse cx={120} cy={28} rx={18.5} ry={15} fill={mat("brain")} stroke="#b06a8a" strokeWidth={0.6} />
    <path
      d="M120 14 L120 43 M105 22 q4 -4 7 0 q3 4 6 0 M123 20 q3 -4 6 0 q3 4 6 0 M104 30 q4 4 8 0 q3 -4 6 0 M123 30 q4 4 8 0 q3 -4 6 0 M107 38 q3 -3 6 0 M126 38 q3 -3 6 0"
      fill="none"
      stroke="#b06a8a"
      strokeWidth={0.7}
    />
  </g>
);
const SPINAL_CORD = tube("M120 43 C120 120 120 190 120 250", "#b8960b", NERVE, 2.6);
const NERVES = (
  <g fill="none" stroke={NERVE} strokeWidth={0.9} strokeLinecap="round" opacity={0.95}>
    {both(
      <path d="M120 96 C104 96 84 100 70 116 C60 150 56 190 50 236 M64 140 C60 170 58 200 54 236 M50 236 L44 262 M50 236 L48 268 M54 236 L54 264 M120 116 C104 120 92 124 82 130 M120 136 C104 140 92 144 84 150 M120 156 C104 160 94 164 86 170 M120 176 C106 180 96 186 88 192 M120 248 C112 262 106 276 104 296 C102 330 100 360 98 400 L94 432 M104 300 C96 320 92 340 90 360 M100 380 C104 400 106 420 106 432" />
    )}
  </g>
);
const LARYNX = <path d="M113 59 L127 59 L125 69 L115 69 Z" fill={mat("cartilage")} stroke="#5aa7cf" strokeWidth={0.5} />;
const TRACHEA = (
  <g>
    <rect x={116} y={69} width={8} height={33} rx={4} fill={mat("cartilage")} stroke="#5aa7cf" strokeWidth={0.5} />
    {[73, 77, 81, 85, 89, 93, 97].map((y) => (
      <path key={y} d={`M116.5 ${y} Q120 ${y + 1.2} 123.5 ${y}`} fill="none" stroke="#e8f6ff" strokeWidth={0.8} />
    ))}
  </g>
);
const BRONCHI = (
  <g fill="none" stroke="#9fd3ef" strokeLinecap="round">
    <path d="M120 101 L109 112 M120 101 L131 112" strokeWidth={3.2} />
    <path d="M109 112 L101 121 M109 112 L106 127 M131 112 L139 121 M131 112 L134 127" strokeWidth={2} />
    <path d="M101 121 L94 127 M101 121 L98 134 M106 127 L104 138 M139 121 L146 127 M139 121 L142 134 M134 127 L136 138" strokeWidth={1.1} />
  </g>
);
const RIGHT_LUNG = "M113 96 C100 92 86 100 81 122 C76 146 78 168 84 184 C92 182 104 180 113 176 C116 150 117 120 113 96 Z";
const LEFT_LUNG = "M127 96 C140 92 154 100 159 122 C164 146 162 168 156 184 C148 184 140 182 136 178 C140 166 138 156 130 152 C127 132 126 114 127 96 Z";
const LUNGS = (
  <g>
    <path d={RIGHT_LUNG} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
    <path d={LEFT_LUNG} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.6} />
    <path d={RIGHT_LUNG} fill="url(#p-alveoli)" />
    <path d={LEFT_LUNG} fill="url(#p-alveoli)" />
    <path d="M84 142 Q98 136 113 126 M86 162 Q100 158 113 152 M158 130 Q144 140 131 150" fill="none" stroke="#9b2c4b" strokeWidth={0.8} />
  </g>
);
const HEART = (
  <g>
    <path
      d="M128 132 C122 127 112 131 113 142 C114 154 124 164 137 173 C141 166 149 158 151 147 C153 135 145 127 137 131 C134 129 131 129 128 132 Z"
      fill={mat("heart")}
      stroke="#5c0c0c"
      strokeWidth={0.6}
    />
    <path d="M118 146 Q130 150 140 168 M132 134 Q140 140 146 150" fill="none" stroke="#f8c76a" strokeWidth={0.7} opacity={0.8} />
    {artery("M127 132 C124 120 132 113 141 118", 3)}
    {tube("M134 133 C136 124 143 121 148 125", "#5b21b6", "#8b5cf6", 2.4)}
  </g>
);
const DIAPHRAGM = <path d="M76 188 C92 170 110 176 120 180 C130 176 148 170 164 188" fill="none" stroke="#b9362c" strokeWidth={2.6} strokeLinecap="round" />;
const LIVER = (
  <g>
    <path d="M76 188 C88 180 118 180 140 186 C147 188 147 194 140 198 C128 208 112 214 96 214 C84 214 76 206 76 188 Z" fill={mat("liver")} stroke="#3a1004" strokeWidth={0.6} />
    <path d="M118 184 Q116 198 112 212" fill="none" stroke="#e9a27a" strokeWidth={0.6} opacity={0.7} />
  </g>
);
const GALLBLADDER = <path d="M112 205 C116 205 118 212 116 218 C114 222 110 220 110 214 C110 210 110 205 112 205 Z" fill={mat("gall")} stroke="#14532d" strokeWidth={0.5} />;
const STOMACH = (
  <g>
    <path
      d="M134 188 C142 184 158 186 162 198 C166 214 156 230 140 232 C130 233 124 228 126 220 C128 214 136 214 142 210 C148 204 144 196 134 194 Z"
      fill={mat("stomach")}
      stroke="#8a1c4d"
      strokeWidth={0.6}
    />
    <path d="M146 198 q6 6 10 14 M144 206 q8 6 10 14 M140 216 q6 4 8 10" fill="none" stroke="#e879b0" strokeWidth={0.7} opacity={0.8} />
  </g>
);
const ESOPHAGUS = tube("M123 62 L124 150 Q126 180 136 191", "#a3355f", "#f2a7c3", 2.4);
const SPLEEN = <path d="M158 194 C166 192 170 204 166 216 C163 221 158 217 158 209 C157 203 156 196 158 194 Z" fill={mat("spleen")} stroke="#2e0647" strokeWidth={0.5} />;
const PANCREAS = (
  <g>
    <path d="M104 224 C110 218 126 220 138 218 C148 216 156 218 158 222 C156 228 144 228 132 228 C120 230 108 232 104 224 Z" fill={mat("pancreas")} stroke="#8a6508" strokeWidth={0.5} />
    <path d="M108 225 Q130 222 154 221" fill="none" stroke="#a97c06" strokeWidth={0.5} />
  </g>
);
const DUODENUM = tube("M136 226 C134 242 118 243 108 240 C103 238 103 232 106 228", "#9a3a0c", "#fdc28f", 3.2);
const KIDNEY_SHAPE = (
  <g>
    <path
      d="M96 212 C88 212 85 222 86 230 C87 238 92 242 98 240 C101 239 102 235 100 232 C98 229 98 225 100 222 C102 219 101 212 96 212 Z"
      fill={mat("kidney")}
      stroke="#3b0412"
      strokeWidth={0.5}
    />
    <path d="M99.5 223 Q94 227 99.5 231" fill="none" stroke="#f6d860" strokeWidth={1} />
  </g>
);
const KIDNEYS = both(KIDNEY_SHAPE);
const ADRENALS = both(<path d="M89 214 Q95 201 102 212 Q96 210 89 214 Z" fill={mat("gland")} stroke="#9a3a0c" strokeWidth={0.5} />);
const URETERS = both(<path d="M99 238 C102 248 108 256 113 263" fill="none" stroke="#e0b400" strokeWidth={1.6} strokeLinecap="round" />);
const BLADDER = <path d="M110 262 C110 256 130 256 130 262 C132 272 126 278 120 278 C114 278 108 272 110 262 Z" fill={mat("bladder")} stroke="#a26a05" strokeWidth={0.6} />;
const URETHRA = <path d="M120 278 L120 292" stroke="#e0b400" strokeWidth={1.8} strokeLinecap="round" />;
const SMALL_INTESTINE = tube(
  "M106 246 q5 -5 9 0 t9 0 t9 0 t9 0 M141 252 q-5 5 -9 0 t-9 0 t-9 0 t-9 0 M106 258 q5 -5 9 0 t9 0 t9 0 t9 0 M141 264 q-5 5 -9 0 t-9 0 t-9 0 t-9 0",
  "#c9416d",
  "#fbc0d0",
  2.6
);
const LARGE_INTESTINE_D = "M97 268 L94 242 Q94 235 102 235 L140 235 Q148 235 148 243 L146 264 Q142 272 133 272";
const LARGE_INTESTINE = (
  <g>
    {tube(LARGE_INTESTINE_D, "#8a3208", "#f39a55", 5.5)}
    <path d={LARGE_INTESTINE_D} fill="none" stroke="#8a3208" strokeWidth={6} strokeDasharray="0.8 5" />
  </g>
);
const APPENDIX = tube("M96 268 q-5 6 -2 12", "#8a3208", "#f7b67a", 2);
const RECTUM = tube("M133 272 Q124 276 122 287", "#6e2405", "#d9733a", 4.5);
const MOUTH = <path d="M113 52 Q120 57 127 52 Q120 55 113 52 Z" fill="#c2304a" stroke="#7a1528" strokeWidth={0.5} />;
const SALIVARY = both(<ellipse cx={104} cy={50} rx={4.5} ry={3.2} fill={mat("gland")} stroke="#9a3a0c" strokeWidth={0.4} />);
const NASAL = <path d="M116 28 L120 46 L124 28 Q120 25 116 28 Z" fill={mat("cartilage")} stroke="#5aa7cf" strokeWidth={0.5} />;
const THYROID = <path d="M112 75 q8 8 8 0 q0 8 8 0 q-1 10 -8 7 q-7 3 -8 -7 Z" fill={mat("gland")} stroke="#9a3a0c" strokeWidth={0.5} />;
const PITUITARY = <circle cx={120} cy={36} r={3} fill={mat("gland")} stroke="#fff" strokeWidth={0.5} />;
const THYMUS = <path d="M113 106 q2 -12 7 -3 q5 -9 7 3 q-1 12 -7 9 q-6 3 -7 -9 Z" fill={mat("gland")} stroke="#9a3a0c" strokeWidth={0.5} />;
const GONADS = both(<ellipse cx={103} cy={270} rx={4.5} ry={3.2} fill={mat("egg")} stroke="#8a6d05" strokeWidth={0.4} />);

// --- Tizimlar ---------------------------------------------------------------------

function skeleton(): DiagramSpec {
  const vertebrae = Array.from({ length: 27 }, (_, i) => {
    const y = 64 + i * 7.1;
    const w = i < 7 ? 6 : i < 19 ? 7 : 9;
    return (
      <g key={i}>
        <rect x={120 - w / 2} y={y} width={w} height={5.2} rx={1.6} fill={mat("bone")} stroke="#8f8676" strokeWidth={0.4} />
        <path d={`M${120 - w / 2} ${y + 2.6} l-${w * 0.35} 0 M${120 + w / 2} ${y + 2.6} l${w * 0.35} 0`} stroke="#d6cfc2" strokeWidth={1.2} />
      </g>
    );
  });
  const ribs = Array.from({ length: 10 }, (_, i) => {
    const y = 97 + i * 9.4;
    const reach = 80 - Math.min(i, 5) * 0.6 + Math.max(0, i - 6) * 2.5;
    const front: [number, number] = i < 7 ? [115, y + 18] : [100 + (i - 7) * 4, y + 26];
    const rib = `M117 ${y} C103 ${y - 6} ${reach + 4} ${y - 1} ${reach} ${y + 13} C${reach - 1} ${y + 22} ${reach + 10} ${y + 26} ${front[0] - 10} ${front[1] + 2}`;
    return (
      <g key={i}>
        <path d={rib} fill="none" stroke="#8f8676" strokeWidth={3.2} strokeLinecap="round" />
        <path d={rib} fill="none" stroke="#f3eee3" strokeWidth={2.1} strokeLinecap="round" />
        <path d={`M${front[0] - 10} ${front[1] + 2} Q${front[0] - 4} ${front[1] + 1} ${front[0]} ${front[1] - 3}`} fill="none" stroke="#a8dcf5" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
  });
  const hand = (
    <g stroke="#e9e3d6" strokeLinecap="round" fill="none">
      <g fill={mat("bone")} stroke="none">
        {[[44, 250], [48, 251], [52, 250], [46, 254], [50, 255]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} />
        ))}
      </g>
      <path d="M43 256 L37 270 M45 257 L41 275 M48 257 L46 277 M51 257 L51 275 M53 255 L57 266" strokeWidth={1.4} />
    </g>
  );
  const foot = (
    <g>
      <path d="M92 424 C96 420 106 420 110 424 L111 432 L90 433 Z" fill={mat("bone")} stroke="#8f8676" strokeWidth={0.5} />
      <path d="M90 433 L84 440 M94 433 L90 441 M99 433 L97 442 M104 433 L104 442 M109 432 L110 440" stroke="#e9e3d6" strokeWidth={1.3} strokeLinecap="round" />
    </g>
  );
  return {
    title: "Odam skeleti",
    viewBox: "20 0 200 445",
    maxWidth: 330,
    base: BODY,
    parts: [
      part("bosh_suyagi", "Bosh skeleti (kalla suyagi)", ["kalla", "bosh skelet", "bosh suyag"], [134, 18], (
        <g>
          <path d="M100 30 C100 7 140 7 140 30 C141 42 137 50 133 54 L129 62 L111 62 L107 54 C103 50 99 42 100 30 Z" fill={mat("bone")} stroke="#8f8676" strokeWidth={0.6} />
          <ellipse cx={111.5} cy={31} rx={5} ry={5.5} fill="#2a2520" />
          <ellipse cx={128.5} cy={31} rx={5} ry={5.5} fill="#2a2520" />
          <path d="M118 38 L120 45 L122 38 Z" fill="#2a2520" />
          <path d="M110 52 L130 52 M112 52 L112 56 M116 52 L116 57 M120 52 L120 57 M124 52 L124 57 M128 52 L128 56" stroke="#8f8676" strokeWidth={0.6} />
          <path d="M106 50 Q120 70 134 50" fill="none" stroke="#8f8676" strokeWidth={0.8} />
        </g>
      )),
      part("umurtqa", "Umurtqa pog'onasi", ["umurtqa", "umurtqa pog"], [120, 232], <g>{vertebrae}</g>),
      part("qovurgalar", "Qovurg'alar (ko'krak qafasi)", ["qovurg", "ko'krak qafas", "kokrak qafas"], [84, 142], both(<g>{ribs}</g>)),
      part("tosh", "To'sh suyagi", ["tosh suyag", "to'sh"], [120, 125], (
        <path d="M116 89 L124 89 L125 100 L123 146 L120 153 L117 146 L115 100 Z" fill={mat("bone")} stroke="#8f8676" strokeWidth={0.5} />
      )),
      part("omrov", "O'mrov suyagi", ["omrov", "o'mrov"], [96, 85], both(
        <g>
          <path d="M116 88 C108 84 100 88 92 86 C84 84 78 86 73 89" fill="none" stroke="#8f8676" strokeWidth={4} strokeLinecap="round" />
          <path d="M116 88 C108 84 100 88 92 86 C84 84 78 86 73 89" fill="none" stroke="#f3eee3" strokeWidth={2.8} strokeLinecap="round" />
        </g>
      )),
      part("kurak", "Kurak suyagi", ["kurak"], [88, 104], both(<path d="M74 92 L98 96 L82 128 Z" fill={mat("bone")} opacity={0.45} stroke="#8f8676" strokeWidth={0.5} />)),
      part("yelka", "Yelka suyagi", ["yelka"], [65, 124], both(longBone(68, 96, 58, 168, 5))),
      part("bilak", "Bilak va tirsak suyaklari", ["bilak", "tirsak"], [52, 208], both(<g>{longBone(57, 173, 45, 245, 2.8)}{longBone(61, 174, 50, 246, 2.6)}</g>)),
      part("qol_panjasi", "Qo'l panjasi suyaklari", ["qol panja", "qo'l panja", "kaft"], [46, 266], both(hand)),
      part("tos", "Tos suyaklari", ["tos"], [140, 262], (
        <g>
          <path d="M88 244 C82 262 90 278 102 284 L110 280 C116 274 124 274 130 280 L138 284 C150 278 158 262 152 244 C140 256 130 256 120 254 C110 256 100 256 88 244 Z" fill={mat("bone")} stroke="#8f8676" strokeWidth={0.6} />
          <path d="M114 254 L120 272 L126 254 Z" fill={mat("bone")} stroke="#8f8676" strokeWidth={0.5} />
          <ellipse cx={107} cy={276} rx={4} ry={3} fill="#2a2520" opacity={0.7} />
          <ellipse cx={133} cy={276} rx={4} ry={3} fill="#2a2520" opacity={0.7} />
        </g>
      )),
      part("son", "Son suyagi (eng uzun suyak)", ["son suyag", "son"], [103, 318], both(longBone(101, 284, 104, 352, 6))),
      part("tizza", "Tizza qopqog'i", ["tizza"], [104, 358], both(<ellipse cx={104} cy={358} rx={4} ry={4.6} fill={mat("bone")} stroke="#8f8676" strokeWidth={0.5} />)),
      part("boldir", "Katta va kichik boldir suyaklari", ["boldir"], [103, 392], both(<g>{longBone(103, 366, 101, 420, 4.6)}{longBone(110, 368, 108, 418, 2)}</g>)),
      part("oyoq_panjasi", "Oyoq panjasi suyaklari", ["oyoq panja", "tovon"], [98, 432], both(foot)),
    ],
  };
}

function organs(): DiagramSpec {
  return {
    title: "Odamning ichki a'zolari",
    viewBox: "62 54 116 240",
    maxWidth: 340,
    base: BODY,
    parts: [
      part("traxeya", "Traxeya (kekirdak)", ["traxeya", "kekirdak"], [118, 86], <g>{TRACHEA}{BRONCHI}</g>),
      part("qizilongach", "Qizilo'ngach", ["qizilongach", "qizilo'ngach"], [124, 70], ESOPHAGUS),
      part("opka", "O'pkalar", ["opka", "o'pka"], [92, 150], LUNGS),
      part("yurak", "Yurak", ["yurak"], [138, 152], HEART),
      part("diafragma", "Diafragma", ["diafragma"], [154, 180], DIAPHRAGM),
      part("jigar", "Jigar", ["jigar"], [96, 198], LIVER),
      part("oshqozon", "Oshqozon (me'da)", ["oshqozon", "meda", "me'da"], [152, 210], STOMACH),
      part("taloq", "Taloq", ["taloq"], [164, 206], SPLEEN),
      part("meda_osti", "Me'da osti bezi", ["meda osti", "me'da osti", "oshqozon osti"], [146, 222], PANCREAS),
      part("buyrak", "Buyraklar", ["buyrak"], [90, 228], KIDNEYS),
      part("ichaklar", "Ichaklar (ingichka va yo'g'on)", ["ichak"], [124, 252], <g>{LARGE_INTESTINE}{SMALL_INTESTINE}</g>),
      part("siydik_pufagi", "Siydik pufagi", ["siydik pufag", "qovuq"], [124, 270], BLADDER),
    ],
  };
}

function circulation(): DiagramSpec {
  const arteries = (
    <g>
      {artery("M118 116 C116 100 114 84 114 70 C114 60 116 52 118 44")}
      {artery("M124 114 C126 100 126 84 126 70 C126 60 124 52 122 44", 1.6)}
      {artery("M116 118 C96 108 80 108 70 120 C62 150 58 180 54 210 C50 230 46 244 44 254")}
      {artery("M128 117 C146 108 160 108 170 120 C178 150 182 180 186 210 C190 230 194 244 196 254")}
      {artery("M54 210 C52 230 50 244 49 256 M186 210 C188 230 190 244 191 256", 1.2)}
      {artery("M118 252 C112 262 104 274 102 290 C100 320 100 350 100 380 C99 400 98 414 96 428")}
      {artery("M118 252 C124 262 134 274 138 290 C140 320 140 350 140 380 C141 400 142 414 144 428")}
      {artery("M118 226 C112 226 106 226 100 226 M118 226 C124 226 132 226 140 226", 1.4)}
    </g>
  );
  const veins = (
    <g>
      {vein("M130 118 C130 100 128 84 128 70 C128 58 126 50 124 42")}
      {vein("M110 120 C110 100 110 84 110 70", 1.6)}
      {vein("M128 122 C100 114 84 112 74 124 C66 154 62 184 58 214 C54 234 50 248 48 258")}
      {vein("M134 122 C150 114 166 114 176 126 C184 156 188 186 192 216 C196 236 198 248 200 258")}
      {vein("M126 254 C118 264 110 276 108 292 C106 322 106 352 106 382 C105 402 104 416 102 430")}
      {vein("M126 254 C132 264 142 276 146 292 C148 322 148 352 148 382 C149 402 150 416 152 430")}
      {vein("M126 232 C118 232 110 232 100 232 M126 232 C132 232 136 232 140 232", 1.4)}
    </g>
  );
  const capillaries = (
    <g fill="none" stroke="#c084fc" strokeWidth={0.7}>
      {[[120, 26], [46, 262], [194, 262], [99, 432], [147, 432], [92, 150], [150, 150]].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-6 0 q3 -5 6 0 t6 0 M-6 3 q3 4 6 0 t6 0 M-3 -3 L-3 5 M3 -3 L3 5" />
        </g>
      ))}
    </g>
  );
  return {
    title: "Qon aylanish sistemasi",
    viewBox: "26 0 188 445",
    maxWidth: 330,
    base: BODY,
    note: (
      <p>
        <b className="text-red-400">Qizil</b> — kislorodga boy (arterial) qon, <b className="text-blue-400">ko&apos;k</b> — venoz qon.{" "}
        <b>Katta doira:</b> chap qorincha → aorta → arteriyalar → kapillyarlar → venalar → kovak venalar → o&apos;ng bo&apos;lmacha.{" "}
        <b>Kichik doira:</b> o&apos;ng qorincha → o&apos;pka arteriyasi → o&apos;pka → o&apos;pka venalari → chap bo&apos;lmacha.
      </p>
    ),
    parts: [
      part("yurak", "Yurak", ["yurak"], [134, 156], HEART),
      part("aorta", "Aorta", ["aorta"], [116, 190], artery("M127 134 C126 118 120 112 114 116 C108 120 112 130 116 140 L118 252", 3.4)),
      part("arteriyalar", "Arteriyalar", ["arteriya"], [60, 180], arteries),
      part("kovak_venalar", "Kovak venalar", ["kovak"], [128, 210], vein("M134 140 L131 106 M134 166 C130 200 128 230 126 254", 3.4)),
      part("venalar", "Venalar", ["vena"], [184, 180], veins),
      part("opka", "O'pkalar", ["opka", "o'pka"], [96, 168], LUNGS),
      part("opka_arteriyasi", "O'pka arteriyasi", ["opka arteriya", "o'pka arteriya"], [102, 140], tube("M126 146 C114 136 104 136 96 142 M130 144 C142 132 150 134 152 140", "#5b21b6", "#8b5cf6", 2.2)),
      part("opka_venalari", "O'pka venalari", ["opka vena", "o'pka vena"], [146, 162], artery("M98 160 C110 164 120 160 128 156 M152 160 C146 164 140 162 136 158", 2)),
      part("kapillyarlar", "Kapillyarlar", ["kapillyar"], [194, 262], capillaries),
    ],
  };
}

function heart(): DiagramSpec {
  const chordae = (x: number, top: number) => (
    <g stroke="#f5f5f4" strokeWidth={0.6} opacity={0.85}>
      <path d={`M${x - 8} ${top} L${x - 2} ${top + 30} M${x} ${top} L${x - 1} ${top + 30} M${x + 8} ${top} L${x + 1} ${top + 30}`} />
      <path d={`M${x - 5} ${top + 30} L${x + 4} ${top + 30} L${x} ${top + 44} Z`} fill={mat("muscle")} stroke="none" />
    </g>
  );
  return {
    title: "Yurak tuzilishi (kesimda)",
    viewBox: "20 0 280 290",
    maxWidth: 380,
    base: (
      <g>
        <defs>
          <marker id="heart-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#fff" />
          </marker>
        </defs>
        {/* Yurak devori (miokard) — tashqi shakl */}
        <path
          d="M62 94 C52 124 58 164 90 202 C112 228 132 248 150 268 C178 242 214 210 232 176 C246 146 242 110 228 92 C198 80 168 88 152 98 C128 86 94 80 62 94 Z"
          fill={mat("muscle")}
          stroke="#4a0808"
          strokeWidth={1}
        />
      </g>
    ),
    note: (
      <p>
        O&apos;ng tomonda <b className="text-blue-400">venoz</b>, chap tomonda <b className="text-red-400">arterial</b> qon — ular aralashmaydi.
        Chap qorincha devori eng qalin: u qonni butun tanaga haydaydi. Klapanlar qonni faqat bir tomonga o&apos;tkazadi.
      </p>
    ),
    parts: [
      part("ong_bolmacha", "O'ng bo'lmacha", ["ong bolmacha", "o'ng bo'lmacha"], [100, 122], <path d="M72 102 C64 122 68 140 80 150 L138 150 L138 106 C116 96 92 94 72 102 Z" fill={mat("vein")} stroke={VEIN_DARK} strokeWidth={0.8} />),
      part("ong_qorincha", "O'ng qorincha", ["ong qorincha", "o'ng qorincha"], [112, 196], <path d="M86 158 C90 196 112 224 142 250 L142 158 Z" fill={mat("vein")} stroke={VEIN_DARK} strokeWidth={0.8} />),
      part("chap_bolmacha", "Chap bo'lmacha", ["chap bolmacha", "chap bo'lmacha"], [196, 122], <path d="M162 106 L162 150 L220 150 C230 132 230 110 220 100 C198 94 180 96 162 106 Z" fill={mat("artery")} stroke={ARTERY_DARK} strokeWidth={0.8} />),
      part("chap_qorincha", "Chap qorincha (devori eng qalin)", ["chap qorincha"], [180, 194], <path d="M160 160 L160 232 C184 214 202 190 208 160 Z" fill={mat("artery")} stroke={ARTERY_DARK} strokeWidth={0.8} />),
      part("tosiq", "Qorinchalararo to'siq", ["tosiq", "to'siq"], [151, 210], <path d="M146 152 L146 254 L156 244 L156 152 Z" fill="#9b1c1c" stroke="#4a0808" strokeWidth={0.6} />, "right"),
      part("uch_tavaqali", "Uch tavaqali klapan", ["uch tavaqali", "trikuspid"], [110, 158], <g>{chordae(112, 152)}<path d="M92 150 L102 162 L112 150 M114 150 L124 162 L134 150" fill="rgba(255,255,255,0.85)" stroke="#fff" strokeWidth={1} /></g>),
      part("ikki_tavaqali", "Ikki tavaqali (mitral) klapan", ["ikki tavaqali", "mitral"], [184, 158], <g>{chordae(184, 152)}<path d="M166 150 L180 164 L192 150 M194 150 L206 164 L216 150" fill="rgba(255,255,255,0.85)" stroke="#fff" strokeWidth={1} /></g>),
      part("yarim_oysimon", "Yarim oysimon klapanlar", ["yarim oysimon"], [164, 84], <path d="M156 86 q5 6 10 0 q5 6 10 0 M118 92 q4 6 8 0 q4 6 8 0" fill="rgba(255,255,255,0.85)" stroke="#fff" strokeWidth={1} />),
      part("opka_arteriyasi", "O'pka arteriyasi (kichik doiraga)", ["opka arteriya", "o'pka arteriya"], [236, 52], tube("M126 150 L126 72 C126 56 140 52 154 52 L262 52 M140 54 C118 54 92 54 62 54", "#173b85", "#5b8ff0", 10)),
      part("aorta", "Aorta (katta doiraga)", ["aorta"], [100, 34], (
        <g>
          {tube("M168 150 L168 76 C168 34 136 28 120 34 C104 40 96 56 96 72", ARTERY_DARK, ARTERY, 11)}
          {tube("M126 30 L122 6 M140 28 L140 4 M154 32 L160 8", ARTERY_DARK, ARTERY, 3.5)}
        </g>
      )),
      part("yuqori_kovak", "Yuqori kovak vena", ["yuqori kovak"], [80, 50], tube("M80 14 L80 98", VEIN_DARK, VEIN, 11)),
      part("pastki_kovak", "Pastki kovak vena", ["pastki kovak"], [56, 230], tube("M52 288 C54 210 60 160 72 138", VEIN_DARK, VEIN, 10)),
      part("opka_venalari", "O'pka venalari (o'pkadan)", ["opka vena", "o'pka vena"], [262, 118], tube("M292 102 L224 110 M292 132 L226 130", ARTERY_DARK, ARTERY, 6)),
      part("qon_yonalishi", "Qon oqimi yo'nalishi", ["yonalish", "oqim"], [178, 204], (
        <g fill="none" stroke="#fff" strokeWidth={1.6} markerEnd="url(#heart-arrow)" opacity={0.95}>
          <path d="M108 112 L112 140" />
          <path d="M106 176 L118 214" />
          <path d="M194 112 L190 140" />
          <path d="M186 222 L170 186 L168 158" />
          <path d="M134 226 L130 168" />
        </g>
      ), "right"),
    ],
  };
}

function respiration(): DiagramSpec {
  return {
    title: "Nafas olish sistemasi",
    viewBox: "62 6 120 196",
    maxWidth: 340,
    base: BODY,
    parts: [
      part("burun", "Burun bo'shlig'i", ["burun"], [120, 34], NASAL),
      part("hiqildoq", "Hiqildoq (ovoz paychalari)", ["hiqildoq", "ovoz"], [120, 64], LARYNX),
      part("traxeya", "Traxeya (kekirdak)", ["traxeya", "kekirdak"], [120, 86], TRACHEA),
      part("bronxlar", "Bronxlar", ["bronx"], [133, 116], BRONCHI),
      part("opka", "O'pkalar", ["opka", "o'pka"], [94, 160], LUNGS),
      part("alveolalar", "Alveolalar (gaz almashinuvi)", ["alveola"], [166, 40], (
        <g>
          <path d="M140 124 L158 54" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
          <circle cx={166} cy={40} r={15} fill="#0b1020" stroke="#d9587a" />
          {[[160, 34], [168, 32], [172, 40], [164, 42], [158, 46], [170, 48]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill={mat("lung")} stroke="#b3415f" strokeWidth={0.5} />
          ))}
          <path d="M152 44 q6 -2 8 -6" stroke="#c084fc" strokeWidth={0.8} fill="none" />
        </g>
      )),
      part("diafragma", "Diafragma (nafas muskuli)", ["diafragma"], [152, 180], DIAPHRAGM),
    ],
  };
}

function digestion(): DiagramSpec {
  return {
    title: "Hazm qilish sistemasi",
    viewBox: "74 40 92 254",
    maxWidth: 320,
    base: BODY,
    parts: [
      part("ogiz", "Og'iz bo'shlig'i", ["ogiz", "og'iz"], [124, 54], MOUTH),
      part("solak", "So'lak bezlari", ["solak", "so'lak"], [104, 50], SALIVARY),
      part("qizilongach", "Qizilo'ngach", ["qizilongach", "qizilo'ngach"], [124, 110], ESOPHAGUS),
      part("jigar", "Jigar (o't ishlab chiqaradi)", ["jigar"], [94, 198], LIVER),
      part("ot_pufagi", "O't pufagi", ["ot pufag", "o't pufag"], [113, 214], GALLBLADDER),
      part("oshqozon", "Oshqozon (me'da)", ["oshqozon", "meda", "me'da"], [152, 204], STOMACH),
      part("meda_osti", "Me'da osti bezi", ["meda osti", "me'da osti", "oshqozon osti"], [150, 222], PANCREAS),
      part("onikki_barmoqli", "O'n ikki barmoqli ichak", ["onikki", "o'n ikki", "12 barmoq"], [118, 242], DUODENUM),
      part("ingichka_ichak", "Ingichka ichak", ["ingichka"], [126, 258], SMALL_INTESTINE),
      part("yogon_ichak", "Yo'g'on ichak", ["yogon", "yo'g'on"], [147, 250], LARGE_INTESTINE),
      part("korichak", "Ko'richak (chuvalchangsimon o'simta)", ["korichak", "ko'richak", "appendiks"], [94, 276], APPENDIX),
      part("togri_ichak", "To'g'ri ichak", ["togri ichak", "to'g'ri ichak"], [126, 280], RECTUM),
    ],
  };
}

function excretion(): DiagramSpec {
  return {
    title: "Ayirish sistemasi",
    viewBox: "78 198 84 98",
    maxWidth: 330,
    base: (
      <g>
        {BODY}
        {/* Aorta (chapda) va pastki kovak vena (o'ngda) — buyrak tomirlari shularga ulanadi. */}
        <g opacity={0.55}>
          {artery("M117 200 C117 220 117 236 117 252", 2.4)}
          {vein("M123 200 C123 220 123 236 123 252", 2.4)}
        </g>
      </g>
    ),
    parts: [
      part("buyrak", "Buyraklar", ["buyrak"], [91, 226], KIDNEYS),
      part("buyrak_tomirlari", "Buyrak arteriyasi va venasi", ["buyrak arteriya", "buyrak vena"], [110, 224], (
        // Ko'zgu aksi emas: ikkala arteriya aortaga (x=117), ikkala vena kovak venaga (x=123) ulanadi.
        <g>
          {artery("M100 224 C106 223 112 222 117 222 M140 224 C132 223 124 222 117 222", 1.3)}
          {vein("M100 230 C108 229 116 228 123 228 M140 230 C134 229 128 228 123 228", 1.3)}
        </g>
      )),
      part("siydik_yoli", "Siydik yo'llari (siydik nayi)", ["siydik yol", "siydik nay"], [104, 250], URETERS),
      part("siydik_pufagi", "Siydik pufagi", ["siydik pufag", "qovuq"], [124, 268], BLADDER),
      part("siydik_kanali", "Siydik chiqarish kanali", ["chiqarish kanal"], [120, 287], URETHRA),
    ],
  };
}

function nervous(): DiagramSpec {
  return {
    title: "Nerv sistemasi",
    viewBox: "26 0 188 445",
    maxWidth: 330,
    base: BODY,
    note: <p>Markaziy nerv sistemasi — bosh va orqa miya; periferik — ulardan chiqadigan nervlar.</p>,
    parts: [
      part("bosh_miya", "Bosh miya", ["bosh miya", "miya"], [128, 24], BRAIN),
      part("orqa_miya", "Orqa miya", ["orqa miya"], [120, 200], SPINAL_CORD),
      part("nervlar", "Nervlar (periferik nerv sistemasi)", ["nerv"], [64, 150], NERVES),
    ],
  };
}

function endocrine(): DiagramSpec {
  return {
    title: "Ichki sekretsiya bezlari (endokrin sistema)",
    viewBox: "74 4 92 290",
    maxWidth: 320,
    base: (
      <g>
        {BODY}
        <g opacity={0.25}>
          {BRAIN}
          {KIDNEYS}
        </g>
      </g>
    ),
    parts: [
      part("gipofiz", "Gipofiz (bezlar boshqaruvchisi)", ["gipofiz"], [120, 36], PITUITARY),
      part("qalqonsimon", "Qalqonsimon bez (tiroksin)", ["qalqonsimon"], [126, 79], THYROID),
      part("ayrisimon", "Ayrisimon bez (timus)", ["ayrisimon", "timus"], [116, 108], THYMUS),
      part("buyrak_usti", "Buyrak usti bezlari (adrenalin)", ["buyrak usti", "adrenalin"], [95, 210], ADRENALS),
      part("meda_osti", "Me'da osti bezi (insulin)", ["meda osti", "me'da osti", "insulin", "langergans"], [146, 223], PANCREAS),
      part("jinsiy_bezlar", "Jinsiy bezlar", ["jinsiy"], [104, 270], GONADS),
    ],
  };
}

export const HUMAN_SYSTEMS: Record<string, { build: () => DiagramSpec; aliases: string[] }> = {
  skelet: { build: skeleton, aliases: ["skelet", "suyak"] },
  ichki_azolar: { build: organs, aliases: ["ichki", "azolar", "a'zolar", "organ"] },
  qon_aylanish: { build: circulation, aliases: ["qon", "tomir", "aylanish", "arteriya", "vena"] },
  yurak: { build: heart, aliases: ["yurak"] },
  nafas: { build: respiration, aliases: ["nafas", "opka", "o'pka"] },
  hazm: { build: digestion, aliases: ["hazm", "ovqat", "ichak", "oshqozon"] },
  ayirish: { build: excretion, aliases: ["ayirish", "buyrak", "siydik"] },
  nerv: { build: nervous, aliases: ["nerv", "miya"] },
  endokrin: { build: endocrine, aliases: ["endokrin", "bez", "gormon", "sekretsiya"] },
};
