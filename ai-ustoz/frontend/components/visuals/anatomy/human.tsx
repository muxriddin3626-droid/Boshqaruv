/**
 * Odam anatomiyasi chizmalari (old tomondan, sxematik). Hammasi bitta 240x440
 * koordinatalar tizimida: tana konturi ustiga tizimga oid a'zolar chiziladi,
 * tizim kerakli joyga "kesib" ko'rsatiladi (viewBox). Chap/o'ng — odamning
 * o'zinikiga ko'ra: uning o'ng o'pkasi ekranda chapda.
 */
import type { ReactNode } from "react";

import type { DiagramPart, DiagramSpec } from "../LabeledDiagram";

const BONE = "#e7e5e4";
const ARTERY = "#ef4444";
const VEIN = "#3b82f6";

/** Shaklni o'rta chiziqqa nisbatan ko'zgu aksi bilan ikki tomonga chizadi. */
function both(node: ReactNode): ReactNode {
  return (
    <g>
      {node}
      <g transform="translate(240 0) scale(-1 1)">{node}</g>
    </g>
  );
}

const BODY = (
  <g fill="rgba(255,255,255,0.045)" stroke="rgba(229,231,235,0.3)" strokeWidth={1}>
    <ellipse cx={120} cy={36} rx={24} ry={28} />
    <path d="M110 60 L130 60 L132 82 L108 82 Z" />
    <path d="M80 82 Q120 74 160 82 L178 94 Q184 160 170 225 L164 278 L76 278 L70 225 Q56 160 62 94 Z" />
    {both(<path d="M62 94 Q46 104 42 160 L34 262 Q34 274 44 272 L52 262 L58 168 L70 116 Z" />)}
    {both(<path d="M78 276 L118 276 L114 424 Q113 434 102 434 L84 434 Q80 428 86 420 Z" />)}
  </g>
);

const part = (id: string, name: string, aliases: string[], marker: [number, number], shape: ReactNode): DiagramPart => ({
  id,
  name,
  aliases,
  marker,
  shape,
});

// --- A'zolar (bir necha tizimda qayta ishlatiladi) -----------------------------------

const BRAIN = (
  <g>
    <ellipse cx={120} cy={30} rx={19} ry={15} fill="rgba(244,114,182,0.35)" stroke="#f472b6" strokeWidth={1.2} />
    <path d="M106 26 q4 -5 8 0 t8 0 t8 0 M106 33 q4 4 8 0 t8 0 t8 0 M120 16 L120 44" fill="none" stroke="#f9a8d4" strokeWidth={0.8} />
  </g>
);
const SPINAL_CORD = <path d="M120 44 L120 252" stroke="#fde68a" strokeWidth={3} strokeLinecap="round" />;
const NERVES = (
  <g fill="none" stroke="#fde68a" strokeWidth={1} opacity={0.85}>
    {both(<path d="M120 100 Q90 104 66 124 L52 200 L42 256 M120 120 Q100 124 84 126 M120 150 Q100 152 86 156 M120 190 Q104 192 90 196 M120 250 L104 282 L100 360 L98 426 M104 300 L92 320" />)}
  </g>
);
const LARYNX = <ellipse cx={120} cy={66} rx={6} ry={5} fill="rgba(147,197,253,0.4)" stroke="#93c5fd" />;
const TRACHEA = (
  <g stroke="#93c5fd" fill="none">
    <rect x={116} y={70} width={8} height={32} rx={3} strokeWidth={1.2} />
    {[75, 81, 87, 93, 99].map((y) => (
      <path key={y} d={`M116 ${y} L124 ${y}`} strokeWidth={0.8} />
    ))}
  </g>
);
const BRONCHI = <path d="M120 102 L108 116 L100 124 M108 116 L104 130 M120 102 L132 116 L140 124 M132 116 L136 130" fill="none" stroke="#93c5fd" strokeWidth={2} />;
const LUNGS = (
  <g fill="rgba(251,113,133,0.25)" stroke="#fb7185" strokeWidth={1.2}>
    <path d="M114 96 Q92 92 82 120 Q74 158 84 182 L112 176 Q118 136 114 96 Z" />
    <path d="M126 96 Q148 92 158 120 Q166 158 156 182 L138 180 Q142 160 130 152 Q126 130 126 96 Z" />
  </g>
);
const HEART = (
  <path
    d="M131 168 C112 156 112 136 124 135 C128 135 130 139 131 141 C133 137 137 133 142 135 C151 139 147 158 131 168 Z"
    fill="rgba(239,68,68,0.65)"
    stroke={ARTERY}
    strokeWidth={1.2}
  />
);
const DIAPHRAGM = <path d="M76 186 Q120 168 164 186" fill="none" stroke="#fca5a5" strokeWidth={2} />;
const LIVER = <path d="M78 190 Q118 180 142 192 Q130 210 102 214 Q82 212 78 190 Z" fill="rgba(180,83,9,0.55)" stroke="#d97706" strokeWidth={1.2} />;
const GALLBLADDER = <ellipse cx={112} cy={212} rx={4} ry={6} fill="rgba(34,197,94,0.7)" stroke="#22c55e" />;
const STOMACH = (
  <path d="M134 190 Q160 184 162 204 Q160 228 140 230 Q128 228 130 218 Q144 214 140 202 Q138 196 134 190 Z" fill="rgba(244,114,182,0.45)" stroke="#f472b6" strokeWidth={1.2} />
);
const ESOPHAGUS = <path d="M123 62 L124 150 Q126 180 136 192" fill="none" stroke="#f9a8d4" strokeWidth={3} strokeLinecap="round" />;
const SPLEEN = <ellipse cx={162} cy={206} rx={5} ry={11} fill="rgba(147,51,234,0.55)" stroke="#a855f7" />;
const PANCREAS = <path d="M108 224 Q130 217 154 221 Q146 229 112 229 Z" fill="rgba(250,204,21,0.55)" stroke="#facc15" strokeWidth={1} />;
const DUODENUM = <path d="M136 226 Q134 242 118 242 Q104 240 106 228" fill="none" stroke="#fdba74" strokeWidth={3.5} strokeLinecap="round" />;
const KIDNEYS = both(<path d="M96 214 C86 214 86 238 96 240 C102 240 102 233 98 227 C102 221 102 214 96 214 Z" fill="rgba(220,38,38,0.45)" stroke="#dc2626" strokeWidth={1.2} />);
const ADRENALS = both(<path d="M90 214 L96 205 L102 214 Z" fill="rgba(251,146,60,0.8)" stroke="#fb923c" />);
const URETERS = both(<path d="M98 238 Q104 252 113 264" fill="none" stroke="#fde047" strokeWidth={1.8} />);
const BLADDER = <ellipse cx={120} cy={268} rx={11} ry={8} fill="rgba(250,204,21,0.45)" stroke="#eab308" strokeWidth={1.2} />;
const URETHRA = <path d="M120 276 L120 290" stroke="#fde047" strokeWidth={2} />;
const SMALL_INTESTINE = (
  <path
    d="M104 248 q6 -6 12 0 t12 0 t12 0 M140 255 q-6 6 -12 0 t-12 0 t-12 0 M104 262 q6 -6 12 0 t12 0 t12 0"
    fill="none"
    stroke="#fda4af"
    strokeWidth={3}
    strokeLinecap="round"
  />
);
const LARGE_INTESTINE = (
  <path d="M97 266 L94 242 Q94 235 102 235 L140 235 Q148 235 148 243 L146 264 Q142 272 133 272" fill="none" stroke="#c2410c" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
);
const APPENDIX = <path d="M96 266 q-5 6 -2 12" fill="none" stroke="#fb923c" strokeWidth={2.5} strokeLinecap="round" />;
const RECTUM = <path d="M133 272 Q124 276 122 286" fill="none" stroke="#9a3412" strokeWidth={5} strokeLinecap="round" />;
const MOUTH = <ellipse cx={120} cy={52} rx={7} ry={3} fill="rgba(244,63,94,0.5)" stroke="#f43f5e" />;
const SALIVARY = both(<ellipse cx={104} cy={52} rx={4} ry={3} fill="rgba(253,186,116,0.7)" stroke="#fdba74" />);
const NASAL = <path d="M116 30 L120 46 L124 30 Z" fill="rgba(147,197,253,0.35)" stroke="#93c5fd" />;
const THYROID = <path d="M112 76 q8 7 8 0 q0 7 8 0 q-1 9 -8 7 q-7 2 -8 -7 Z" fill="rgba(251,146,60,0.75)" stroke="#fb923c" />;
const PITUITARY = <circle cx={120} cy={38} r={3} fill="#fb923c" stroke="#fff" strokeWidth={0.5} />;
const THYMUS = <path d="M114 106 q2 -10 6 -2 q4 -8 6 2 q-2 10 -6 8 q-4 2 -6 -8 Z" fill="rgba(251,146,60,0.6)" stroke="#fb923c" />;
const GONADS = both(<ellipse cx={104} cy={268} rx={4} ry={3} fill="rgba(236,72,153,0.7)" stroke="#ec4899" />);

// --- Tizimlar ---------------------------------------------------------------------

function skeleton(): DiagramSpec {
  const vertebrae = Array.from({ length: 28 }, (_, i) => <rect key={i} x={117} y={62 + i * 7} width={6} height={5} rx={1} />);
  const ribs = Array.from({ length: 8 }, (_, i) => {
    const y = 96 + i * 10;
    return <path key={i} d={`M118 ${y} C100 ${y - 4} 84 ${y} 84 ${y + 12 + i}`} />;
  });
  return {
    title: "Odam skeleti",
    viewBox: "0 0 240 440",
    maxWidth: 300,
    base: BODY,
    parts: [
      part("bosh_suyagi", "Bosh skeleti (kalla suyagi)", ["kalla", "bosh skelet", "bosh suyag"], [148, 20], (
        <g fill="rgba(231,229,228,0.15)" stroke={BONE} strokeWidth={1.5}>
          <ellipse cx={120} cy={32} rx={20} ry={22} />
          <path d="M106 46 Q120 64 134 46" fill="none" />
          <circle cx={112} cy={30} r={5} />
          <circle cx={128} cy={30} r={5} />
        </g>
      )),
      part("umurtqa", "Umurtqa pog'onasi", ["umurtqa", "umurtqa pog"], [132, 236], <g fill={BONE} opacity={0.85}>{vertebrae}</g>),
      part("qovurgalar", "Qovurg'alar (ko'krak qafasi)", ["qovurg", "ko'krak qafas", "kokrak qafas"], [78, 120], <g fill="none" stroke={BONE} strokeWidth={2}>{both(<g>{ribs}</g>)}</g>),
      part("tosh", "To'sh suyagi", ["tosh suyag", "to'sh"], [120, 160], <rect x={116} y={92} width={8} height={54} rx={3} fill="rgba(231,229,228,0.5)" stroke={BONE} />),
      part("omrov", "O'mrov suyagi", ["omrov", "o'mrov"], [86, 78], both(<path d="M116 86 Q96 82 72 88" fill="none" stroke={BONE} strokeWidth={3} strokeLinecap="round" />)),
      part("yelka", "Yelka suyagi", ["yelka"], [46, 132], both(<path d="M68 96 L54 172" stroke={BONE} strokeWidth={5} strokeLinecap="round" />)),
      part("bilak", "Bilak va tirsak suyaklari", ["bilak", "tirsak"], [32, 208], both(<path d="M54 176 L42 248 M58 176 L48 248" stroke={BONE} strokeWidth={2.5} strokeLinecap="round" />)),
      part("qol_panjasi", "Qo'l panjasi suyaklari", ["qol panja", "qo'l panja", "kaft"], [28, 262], both(<path d="M44 250 L36 268 M45 251 L40 271 M47 251 L45 272 M49 251 L50 270 M50 250 L54 264" stroke={BONE} strokeWidth={1.5} strokeLinecap="round" />)),
      part("tos", "Tos suyaklari", ["tos"], [152, 262], (
        <path d="M90 246 Q84 270 100 282 L112 278 Q120 268 128 278 L140 282 Q156 270 150 246 Q136 258 120 256 Q104 258 90 246 Z" fill="rgba(231,229,228,0.25)" stroke={BONE} strokeWidth={1.5} />
      )),
      part("son", "Son suyagi (eng uzun suyak)", ["son suyag", "son"], [88, 318], both(<path d="M100 282 L102 352" stroke={BONE} strokeWidth={6} strokeLinecap="round" />)),
      part("tizza", "Tizza qopqog'i", ["tizza"], [86, 358], both(<circle cx={102} cy={358} r={4} fill="rgba(231,229,228,0.5)" stroke={BONE} />)),
      part("boldir", "Katta va kichik boldir suyaklari", ["boldir"], [88, 394], both(<path d="M100 364 L100 422 M107 364 L106 420" stroke={BONE} strokeWidth={3} strokeLinecap="round" />)),
      part("oyoq_panjasi", "Oyoq panjasi suyaklari", ["oyoq panja", "tovon"], [82, 434], both(<path d="M92 424 L110 424 L112 432 L88 432 Z" fill="rgba(231,229,228,0.4)" stroke={BONE} />)),
    ],
  };
}

function organs(): DiagramSpec {
  return {
    title: "Odamning ichki a'zolari",
    viewBox: "50 50 140 245",
    maxWidth: 320,
    base: BODY,
    parts: [
      part("traxeya", "Traxeya (kekirdak)", ["traxeya", "kekirdak"], [108, 80], <g>{TRACHEA}{BRONCHI}</g>),
      part("qizilongach", "Qizilo'ngach", ["qizilongach", "qizilo'ngach"], [134, 70], ESOPHAGUS),
      part("opka", "O'pkalar", ["opka", "o'pka"], [76, 130], LUNGS),
      part("yurak", "Yurak", ["yurak"], [150, 150], HEART),
      part("diafragma", "Diafragma", ["diafragma"], [164, 184], DIAPHRAGM),
      part("jigar", "Jigar", ["jigar"], [86, 200], LIVER),
      part("oshqozon", "Oshqozon (me'da)", ["oshqozon", "meda", "me'da"], [150, 216], STOMACH),
      part("taloq", "Taloq", ["taloq"], [172, 206], SPLEEN),
      part("meda_osti", "Me'da osti bezi", ["meda osti", "me'da osti", "oshqozon osti"], [130, 224], PANCREAS),
      part("buyrak", "Buyraklar", ["buyrak"], [80, 230], KIDNEYS),
      part("ichaklar", "Ichaklar (ingichka va yo'g'on)", ["ichak"], [120, 254], <g>{LARGE_INTESTINE}{SMALL_INTESTINE}</g>),
      part("siydik_pufagi", "Siydik pufagi", ["siydik pufag", "qovuq"], [136, 280], BLADDER),
    ],
  };
}

function circulation(): DiagramSpec {
  const arteries = (
    <g fill="none" stroke={ARTERY} strokeWidth={1.8} strokeLinecap="round">
      <path d="M116 118 L114 72 L118 46" />
      <path d="M114 120 Q80 110 66 132 L52 200 L42 252" />
      <path d="M124 116 Q160 108 174 132 L188 200 L198 252" />
      <path d="M118 250 L104 280 L100 360 L98 424" />
      <path d="M118 250 L134 280 L138 360 L140 424" />
    </g>
  );
  const veins = (
    <g fill="none" stroke={VEIN} strokeWidth={1.8} strokeLinecap="round">
      <path d="M128 70 L124 46" />
      <path d="M130 124 Q86 116 72 134 L58 200 L48 252" />
      <path d="M134 124 Q166 114 180 134 L194 200 L204 252" />
      <path d="M126 252 L110 280 L106 360 L104 424" />
      <path d="M126 252 L142 280 L146 360 L148 424" />
    </g>
  );
  const capillaries = (
    <g fill="none" stroke="#c084fc" strokeWidth={0.8}>
      {[[120, 26], [44, 258], [198, 258], [101, 428], [143, 428], [88, 150], [152, 150]].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-6 0 q3 -5 6 0 t6 0 M-6 3 q3 4 6 0 t6 0" />
        </g>
      ))}
    </g>
  );
  return {
    title: "Qon aylanish sistemasi",
    viewBox: "0 0 240 440",
    maxWidth: 300,
    base: BODY,
    note: (
      <p>
        <b className="text-red-400">Qizil</b> — kislorodga boy (arterial) qon, <b className="text-blue-400">ko&apos;k</b> — venoz qon.{" "}
        <b>Katta doira:</b> chap qorincha → aorta → arteriyalar → kapillyarlar → venalar → kovak venalar → o&apos;ng bo&apos;lmacha.{" "}
        <b>Kichik doira:</b> o&apos;ng qorincha → o&apos;pka arteriyasi → o&apos;pka → o&apos;pka venalari → chap bo&apos;lmacha.
      </p>
    ),
    parts: [
      part("yurak", "Yurak", ["yurak"], [150, 160], HEART),
      part("aorta", "Aorta", ["aorta"], [104, 128], <path d="M128 138 Q128 114 118 114 Q108 116 110 132 L118 250" fill="none" stroke={ARTERY} strokeWidth={4} strokeLinecap="round" />),
      part("arteriyalar", "Arteriyalar", ["arteriya"], [58, 172], arteries),
      part("kovak_venalar", "Kovak venalar", ["kovak"], [140, 212], <path d="M134 140 L132 108 M134 164 L126 252" fill="none" stroke={VEIN} strokeWidth={4} strokeLinecap="round" />),
      part("venalar", "Venalar", ["vena"], [190, 172], veins),
      part("opka", "O'pkalar", ["opka", "o'pka"], [80, 104], LUNGS),
      part("opka_arteriyasi", "O'pka arteriyasi", ["opka arteriya", "o'pka arteriya"], [100, 146], <path d="M124 146 Q110 136 96 142 M128 144 Q146 132 150 140" fill="none" stroke={VEIN} strokeWidth={2.5} strokeLinecap="round" />),
      part("opka_venalari", "O'pka venalari", ["opka vena", "o'pka vena"], [98, 166], <path d="M98 160 Q114 162 128 156 M152 158 Q144 162 136 158" fill="none" stroke={ARTERY} strokeWidth={2.5} strokeLinecap="round" />),
      part("kapillyarlar", "Kapillyarlar", ["kapillyar"], [214, 268], capillaries),
    ],
  };
}

function heart(): DiagramSpec {
  return {
    title: "Yurak tuzilishi",
    viewBox: "0 0 300 300",
    maxWidth: 360,
    base: (
      <defs>
        <marker id="heart-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#fff" />
        </marker>
      </defs>
    ),
    note: (
      <p>
        O&apos;ng tomonda <b className="text-blue-400">venoz</b>, chap tomonda <b className="text-red-400">arterial</b> qon — ular aralashmaydi.
        Chap qorincha devori eng qalin: u qonni butun tanaga haydaydi. Klapanlar qonni faqat bir tomonga o&apos;tkazadi.
      </p>
    ),
    parts: [
      part("ong_bolmacha", "O'ng bo'lmacha", ["ong bolmacha", "o'ng bo'lmacha"], [96, 118], <path d="M70 92 Q58 122 78 150 L140 150 L140 98 Q110 82 70 92 Z" fill="rgba(59,130,246,0.35)" stroke={VEIN} strokeWidth={2} />),
      part("ong_qorincha", "O'ng qorincha", ["ong qorincha", "o'ng qorincha"], [112, 196], <path d="M78 152 Q84 212 148 262 L148 152 Z" fill="rgba(59,130,246,0.45)" stroke={VEIN} strokeWidth={2} />),
      part("chap_bolmacha", "Chap bo'lmacha", ["chap bolmacha", "chap bo'lmacha"], [200, 118], <path d="M160 98 L160 150 L222 150 Q238 122 226 94 Q194 84 160 98 Z" fill="rgba(239,68,68,0.35)" stroke={ARTERY} strokeWidth={2} />),
      part("chap_qorincha", "Chap qorincha (devori eng qalin)", ["chap qorincha"], [196, 196], <path d="M152 152 L152 262 Q232 214 222 152 Z" fill="rgba(239,68,68,0.5)" stroke={ARTERY} strokeWidth={5} />),
      part("tosiq", "Qorinchalararo to'siq", ["tosiq", "to'siq"], [150, 280], <path d="M150 96 L150 264" stroke="#fecaca" strokeWidth={4} />),
      part("uch_tavaqali", "Uch tavaqali klapan", ["uch tavaqali", "trikuspid"], [84, 164], <path d="M94 150 L104 163 L114 150 M118 150 L128 163 L138 150" fill="none" stroke="#fff" strokeWidth={1.8} />),
      part("ikki_tavaqali", "Ikki tavaqali (mitral) klapan", ["ikki tavaqali", "mitral"], [228, 166], <path d="M166 150 L180 164 L194 150 M196 150 L208 164 L218 150" fill="none" stroke="#fff" strokeWidth={1.8} />),
      part("yarim_oysimon", "Yarim oysimon klapanlar", ["yarim oysimon"], [186, 64], <path d="M158 86 q10 8 20 0 M118 92 q8 8 16 0" fill="none" stroke="#fff" strokeWidth={1.8} />),
      part("opka_arteriyasi", "O'pka arteriyasi (kichik doiraga)", ["opka arteriya", "o'pka arteriya"], [252, 46], <path d="M126 148 L126 70 Q126 54 150 54 L262 54 M150 54 L60 54" fill="none" stroke={VEIN} strokeWidth={10} strokeLinejoin="round" />),
      part("aorta", "Aorta (katta doiraga)", ["aorta"], [100, 20], (
        <g fill="none" stroke={ARTERY} strokeLinecap="round">
          <path d="M168 150 L168 74 Q168 30 132 30 Q100 30 96 70" strokeWidth={12} />
          <path d="M126 32 L122 8 M140 30 L140 6 M154 34 L160 10" strokeWidth={4} />
        </g>
      )),
      part("yuqori_kovak", "Yuqori kovak vena", ["yuqori kovak"], [62, 30], <path d="M80 18 L80 94" stroke={VEIN} strokeWidth={13} strokeLinecap="round" />),
      part("pastki_kovak", "Pastki kovak vena", ["pastki kovak"], [40, 250], <path d="M50 290 Q54 160 70 136" fill="none" stroke={VEIN} strokeWidth={12} strokeLinecap="round" />),
      part("opka_venalari", "O'pka venalari (o'pkadan)", ["opka vena", "o'pka vena"], [278, 114], <path d="M292 100 L228 108 M292 132 L230 130" stroke={ARTERY} strokeWidth={7} strokeLinecap="round" />),
      part("qon_yonalishi", "Qon oqimi yo'nalishi", ["yonalish", "oqim"], [70, 210], (
        <g fill="none" stroke="#fff" strokeWidth={1.6} markerEnd="url(#heart-arrow)" opacity={0.9}>
          <path d="M110 112 L114 140" />
          <path d="M110 176 L120 210" />
          <path d="M194 112 L190 140" />
          <path d="M190 228 L172 190 L170 160" />
          <path d="M132 220 L130 170" />
        </g>
      )),
    ],
  };
}

function respiration(): DiagramSpec {
  return {
    title: "Nafas olish sistemasi",
    viewBox: "56 6 132 194",
    maxWidth: 320,
    base: BODY,
    parts: [
      part("burun", "Burun bo'shlig'i", ["burun"], [106, 40], NASAL),
      part("hiqildoq", "Hiqildoq (ovoz paychalari)", ["hiqildoq", "ovoz"], [104, 64], LARYNX),
      part("traxeya", "Traxeya (kekirdak)", ["traxeya", "kekirdak"], [134, 86], TRACHEA),
      part("bronxlar", "Bronxlar", ["bronx"], [146, 120], BRONCHI),
      part("opka", "O'pkalar", ["opka", "o'pka"], [80, 150], LUNGS),
      part("alveolalar", "Alveolalar (gaz almashinuvi)", ["alveola"], [176, 38], (
        <g>
          <path d="M140 124 L162 52" stroke="rgba(255,255,255,0.4)" strokeDasharray="2 2" />
          <circle cx={170} cy={40} r={16} fill="rgba(17,24,39,0.9)" stroke="#fb7185" />
          {[[164, 34], [172, 32], [176, 40], [168, 42], [162, 46], [174, 48]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="rgba(251,113,133,0.5)" stroke="#fb7185" strokeWidth={0.6} />
          ))}
          <path d="M156 44 q6 -2 8 -6" stroke="#c084fc" strokeWidth={0.8} fill="none" />
        </g>
      )),
      part("diafragma", "Diafragma (nafas muskuli)", ["diafragma"], [164, 186], DIAPHRAGM),
    ],
  };
}

function digestion(): DiagramSpec {
  return {
    title: "Hazm qilish sistemasi",
    viewBox: "64 40 112 254",
    maxWidth: 300,
    base: BODY,
    parts: [
      part("ogiz", "Og'iz bo'shlig'i", ["ogiz", "og'iz"], [140, 52], MOUTH),
      part("solak", "So'lak bezlari", ["solak", "so'lak"], [94, 48], SALIVARY),
      part("qizilongach", "Qizilo'ngach", ["qizilongach", "qizilo'ngach"], [134, 110], ESOPHAGUS),
      part("jigar", "Jigar (o't ishlab chiqaradi)", ["jigar"], [84, 196], LIVER),
      part("ot_pufagi", "O't pufagi", ["ot pufag", "o't pufag"], [104, 218], GALLBLADDER),
      part("oshqozon", "Oshqozon (me'da)", ["oshqozon", "meda", "me'da"], [156, 196], STOMACH),
      part("meda_osti", "Me'da osti bezi", ["meda osti", "me'da osti", "oshqozon osti"], [158, 226], PANCREAS),
      part("onikki_barmoqli", "O'n ikki barmoqli ichak", ["onikki", "o'n ikki", "12 barmoq"], [132, 244], DUODENUM),
      part("ingichka_ichak", "Ingichka ichak", ["ingichka"], [122, 258], SMALL_INTESTINE),
      part("yogon_ichak", "Yo'g'on ichak", ["yogon", "yo'g'on"], [152, 248], LARGE_INTESTINE),
      part("korichak", "Ko'richak (chuvalchangsimon o'simta)", ["korichak", "ko'richak", "appendiks"], [86, 276], APPENDIX),
      part("togri_ichak", "To'g'ri ichak", ["togri ichak", "to'g'ri ichak"], [134, 288], RECTUM),
    ],
  };
}

function excretion(): DiagramSpec {
  return {
    title: "Ayirish sistemasi",
    viewBox: "70 196 100 100",
    maxWidth: 300,
    base: (
      <g>
        {BODY}
        {/* Aorta (chapda) va pastki kovak vena (o'ngda) — buyrak tomirlari shularga ulanadi. */}
        <path d="M117 200 L117 252" stroke="rgba(239,68,68,0.35)" strokeWidth={3} />
        <path d="M123 200 L123 252" stroke="rgba(59,130,246,0.35)" strokeWidth={3} />
      </g>
    ),
    parts: [
      part("buyrak", "Buyraklar", ["buyrak"], [80, 222], KIDNEYS),
      part("buyrak_tomirlari", "Buyrak arteriyasi va venasi", ["buyrak arteriya", "buyrak vena"], [110, 206], (
        // Ko'zgu aksi emas: ikkala arteriya aortaga (x=117), ikkala vena kovak venaga (x=123) ulanadi.
        <g strokeWidth={1.8}>
          <path d="M100 224 L117 222 M140 224 L117 222" stroke={ARTERY} />
          <path d="M100 230 L123 228 M140 230 L123 228" stroke={VEIN} />
        </g>
      )),
      part("siydik_yoli", "Siydik yo'llari (siydik nayi)", ["siydik yol", "siydik nay"], [96, 254], URETERS),
      part("siydik_pufagi", "Siydik pufagi", ["siydik pufag", "qovuq"], [136, 268], BLADDER),
      part("siydik_kanali", "Siydik chiqarish kanali", ["chiqarish kanal"], [130, 288], URETHRA),
    ],
  };
}

function nervous(): DiagramSpec {
  return {
    title: "Nerv sistemasi",
    viewBox: "0 0 240 440",
    maxWidth: 300,
    base: BODY,
    note: <p>Markaziy nerv sistemasi — bosh va orqa miya; periferik — ulardan chiqadigan nervlar.</p>,
    parts: [
      part("bosh_miya", "Bosh miya", ["bosh miya", "miya"], [152, 24], BRAIN),
      part("orqa_miya", "Orqa miya", ["orqa miya"], [132, 210], SPINAL_CORD),
      part("nervlar", "Nervlar (periferik nerv sistemasi)", ["nerv"], [36, 186], NERVES),
    ],
  };
}

function endocrine(): DiagramSpec {
  return {
    title: "Ichki sekretsiya bezlari (endokrin sistema)",
    viewBox: "64 4 112 290",
    maxWidth: 300,
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
      part("gipofiz", "Gipofiz (bezlar boshqaruvchisi)", ["gipofiz"], [152, 30], PITUITARY),
      part("qalqonsimon", "Qalqonsimon bez (tiroksin)", ["qalqonsimon"], [144, 74], THYROID),
      part("ayrisimon", "Ayrisimon bez (timus)", ["ayrisimon", "timus"], [98, 106], THYMUS),
      part("buyrak_usti", "Buyrak usti bezlari (adrenalin)", ["buyrak usti", "adrenalin"], [80, 206], ADRENALS),
      part("meda_osti", "Me'da osti bezi (insulin)", ["meda osti", "me'da osti", "insulin", "langergans"], [158, 222], PANCREAS),
      part("jinsiy_bezlar", "Jinsiy bezlar", ["jinsiy"], [88, 276], GONADS),
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
