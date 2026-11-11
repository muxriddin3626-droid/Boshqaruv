"use client";

import type { Emotion } from "./realtimeEvents";

const INK = "#111827";

const EMOTION_STYLE: Record<Emotion, { color: string; label: string }> = {
  neutral: { color: "#9ca3af", label: "xotirjam" },
  thinking: { color: "#a78bfa", label: "o'ylayapti" },
  happy: { color: "#22d3ee", label: "xursand" },
  laughing: { color: "#facc15", label: "kulyapti" },
  shocked: { color: "#f59e0b", label: "hayratda" },
  angry: { color: "#ef4444", label: "jahli chiqqan" },
};

const LEFT_EYE = { x: 95, y: 138 };
const RIGHT_EYE = { x: 165, y: 138 };
const MOUTH = { x: 130, y: 172 };

// Ovoz amplitudasi shundan yuqori bo'lsa, og'iz gapirish holatiga o'tadi.
const SPEAKING_THRESHOLD = 0.05;

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

function Eyes({ emotion }: { emotion: Emotion }) {
  const stroke = { stroke: INK, strokeWidth: 9, strokeLinecap: "round" as const, fill: "none" };
  switch (emotion) {
    case "thinking":
      return (
        <>
          <circle cx={LEFT_EYE.x + 7} cy={LEFT_EYE.y - 8} r={7} fill={INK} />
          <circle cx={RIGHT_EYE.x + 7} cy={RIGHT_EYE.y - 8} r={7} fill={INK} />
        </>
      );
    case "happy":
      return (
        <>
          <path d={`M ${LEFT_EYE.x - 15} ${LEFT_EYE.y + 6} Q ${LEFT_EYE.x} ${LEFT_EYE.y - 14} ${LEFT_EYE.x + 15} ${LEFT_EYE.y + 6}`} {...stroke} />
          <path d={`M ${RIGHT_EYE.x - 15} ${RIGHT_EYE.y + 6} Q ${RIGHT_EYE.x} ${RIGHT_EYE.y - 14} ${RIGHT_EYE.x + 15} ${RIGHT_EYE.y + 6}`} {...stroke} />
        </>
      );
    case "laughing":
      return (
        <>
          <path d={`M ${LEFT_EYE.x - 12} ${LEFT_EYE.y - 11} L ${LEFT_EYE.x + 10} ${LEFT_EYE.y} L ${LEFT_EYE.x - 12} ${LEFT_EYE.y + 11}`} {...stroke} strokeLinejoin="round" />
          <path d={`M ${RIGHT_EYE.x + 12} ${RIGHT_EYE.y - 11} L ${RIGHT_EYE.x - 10} ${RIGHT_EYE.y} L ${RIGHT_EYE.x + 12} ${RIGHT_EYE.y + 11}`} {...stroke} strokeLinejoin="round" />
        </>
      );
    case "shocked":
      return (
        <>
          <polygon points={starPoints(LEFT_EYE.x, LEFT_EYE.y, 15, 6.5)} fill={INK} strokeLinejoin="round" />
          <polygon points={starPoints(RIGHT_EYE.x, RIGHT_EYE.y, 15, 6.5)} fill={INK} strokeLinejoin="round" />
        </>
      );
    case "angry":
      return (
        <>
          <path d={`M ${LEFT_EYE.x - 17} ${LEFT_EYE.y - 13} L ${LEFT_EYE.x + 15} ${LEFT_EYE.y - 2}`} {...stroke} />
          <path d={`M ${RIGHT_EYE.x + 17} ${RIGHT_EYE.y - 13} L ${RIGHT_EYE.x - 15} ${RIGHT_EYE.y - 2}`} {...stroke} />
          <ellipse cx={LEFT_EYE.x + 1} cy={LEFT_EYE.y + 9} rx={7} ry={6} fill={INK} />
          <ellipse cx={RIGHT_EYE.x - 1} cy={RIGHT_EYE.y + 9} rx={7} ry={6} fill={INK} />
        </>
      );
    default:
      return (
        <>
          <line x1={LEFT_EYE.x - 15} y1={LEFT_EYE.y} x2={LEFT_EYE.x + 15} y2={LEFT_EYE.y} {...stroke} />
          <line x1={RIGHT_EYE.x - 15} y1={RIGHT_EYE.y} x2={RIGHT_EYE.x + 15} y2={RIGHT_EYE.y} {...stroke} />
        </>
      );
  }
}

function Mouth({ emotion, amplitude }: { emotion: Emotion; amplitude: number }) {
  if (amplitude > SPEAKING_THRESHOLD) {
    const width = (emotion === "laughing" ? 20 : 13) + amplitude * 6;
    return <ellipse cx={MOUTH.x} cy={MOUTH.y} rx={width} ry={3 + amplitude * 14} fill={INK} />;
  }
  switch (emotion) {
    case "thinking":
      return <path d={`M ${MOUTH.x - 10} ${MOUTH.y + 2} Q ${MOUTH.x + 2} ${MOUTH.y - 3} ${MOUTH.x + 12} ${MOUTH.y}`} stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none" />;
    case "happy":
      return <path d={`M ${MOUTH.x - 18} ${MOUTH.y - 6} Q ${MOUTH.x} ${MOUTH.y + 14} ${MOUTH.x + 18} ${MOUTH.y - 6}`} stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none" />;
    case "laughing":
      return <path d={`M ${MOUTH.x - 22} ${MOUTH.y - 8} Q ${MOUTH.x} ${MOUTH.y + 24} ${MOUTH.x + 22} ${MOUTH.y - 8} Z`} fill={INK} />;
    case "shocked":
      return <ellipse cx={MOUTH.x} cy={MOUTH.y} rx={7} ry={9} fill={INK} />;
    case "angry":
      return <rect x={MOUTH.x - 14} y={MOUTH.y - 3} width={28} height={8} rx={3} fill={INK} />;
    default:
      return <rect x={MOUTH.x - 11} y={MOUTH.y - 3} width={22} height={7} rx={3.5} fill={INK} />;
  }
}

const FLAMES = [
  { x: 62, h: 46, w: 36, delay: 0 },
  { x: 86, h: 66, w: 40, delay: 0.15 },
  { x: 110, h: 56, w: 38, delay: 0.3 },
  { x: 132, h: 74, w: 42, delay: 0.05 },
  { x: 155, h: 58, w: 38, delay: 0.25 },
  { x: 178, h: 68, w: 40, delay: 0.1 },
  { x: 200, h: 44, w: 34, delay: 0.2 },
];

function flamePath(cx: number, base: number, height: number, width: number): string {
  const half = width / 2;
  const top = base - height;
  return `M ${cx - half} ${base} C ${cx - half * 1.15} ${base - height * 0.55} ${cx - half * 0.5} ${base - height * 0.82} ${cx} ${top} C ${cx + half * 0.5} ${base - height * 0.82} ${cx + half * 1.15} ${base - height * 0.55} ${cx + half} ${base} Z`;
}

function Flames() {
  const base = 112;
  return (
    <g>
      {FLAMES.map((flame) => (
        <g key={flame.x} className="mascot-flame" style={{ animationDelay: `${flame.delay}s` }}>
          <path d={flamePath(flame.x, base, flame.h, flame.w)} fill="#ef4444" />
          <path d={flamePath(flame.x, base, flame.h * 0.75, flame.w * 0.7)} fill="#f97316" />
          <path d={flamePath(flame.x, base, flame.h * 0.45, flame.w * 0.42)} fill="#fde047" />
        </g>
      ))}
    </g>
  );
}

function ThinkingDots() {
  return (
    <g fill="#a78bfa">
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={212 + i * 13} cy={78 - i * 10} r={5 + i} className="mascot-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </g>
  );
}

const MOTION_CLASS: Partial<Record<Emotion, string>> = {
  angry: "mascot-shake",
  laughing: "mascot-bounce",
  shocked: "mascot-pop",
};

/**
 * AI Ustoz yuzchasi: kayfiyati (`emotion`) model `set_emotion` chaqirganda
 * almashadi, og'zi esa modelning ovoz amplitudasiga qarab ochilib-yopiladi.
 */
export default function TutorMascot({
  emotion,
  amplitude,
  isActive,
}: {
  emotion: Emotion;
  amplitude: number;
  isActive: boolean;
}) {
  const { color, label } = EMOTION_STYLE[emotion];
  // `key={emotion}`: kayfiyat almashganda kirish animatsiyasi (masalan, hayratdagi "sakrash") qayta o'ynaydi.
  return (
    <div className="mascot-float w-full max-w-[280px]">
      <svg
        key={emotion}
        viewBox="0 0 260 230"
        role="img"
        aria-label={`AI Ustoz: ${label}`}
        className={`w-full overflow-visible ${MOTION_CLASS[emotion] ?? ""}`}
        style={{ filter: isActive ? `drop-shadow(0 0 22px ${color}aa)` : `drop-shadow(0 0 10px ${color}55)` }}
      >
        {emotion === "angry" && <Flames />}
        {emotion === "thinking" && <ThinkingDots />}
        <rect x={30} y={90} width={200} height={110} rx={55} fill="#f8fafc" stroke={color} strokeWidth={10} />
        <Eyes emotion={emotion} />
        <Mouth emotion={emotion} amplitude={amplitude} />
      </svg>
    </div>
  );
}
