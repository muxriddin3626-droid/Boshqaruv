"use client";

import { HEART_CLASSES } from "./anatomy/animals";
import { VisualFrame } from "./VisualFrame";

const VEIN = "#3b82f6";
const ARTERY = "#ef4444";
const MIXED = "#a855f7";

function Heart({ kind, partial }: { kind: 2 | 3 | 4; partial?: boolean }) {
  // Yuqorida bo'lmacha(lar), pastda qorincha(lar); rang — qon turi.
  return (
    <svg viewBox="0 0 80 84" className="mx-auto h-20 w-20" aria-hidden>
      {kind === 2 ? (
        <>
          <rect x={20} y={6} width={40} height={30} rx={8} fill={VEIN} opacity={0.75} />
          <rect x={16} y={40} width={48} height={36} rx={10} fill={VEIN} />
        </>
      ) : (
        <>
          <rect x={6} y={6} width={32} height={30} rx={8} fill={VEIN} opacity={0.75} />
          <rect x={42} y={6} width={32} height={30} rx={8} fill={ARTERY} opacity={0.75} />
          {kind === 3 ? (
            <>
              <rect x={6} y={40} width={68} height={38} rx={10} fill={MIXED} />
              {partial && <path d="M40 78 L40 56" stroke="#fff" strokeWidth={3} strokeLinecap="round" />}
            </>
          ) : (
            <>
              <rect x={6} y={40} width={32} height={38} rx={10} fill={VEIN} />
              <rect x={42} y={40} width={32} height={38} rx={10} fill={ARTERY} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

/** Umurtqalilar yuragi: kameralar soni, qon aylanish doiralari va qon aralashishi — yonma-yon. */
export default function HeartComparison({ highlight }: { highlight: string[] }) {
  const wanted = highlight.map((item) => item.toLowerCase());
  const isLit = (id: string, name: string) => wanted.some((item) => id.includes(item) || name.toLowerCase().includes(item) || item.includes(id));
  const anyLit = HEART_CLASSES.some((c) => isLit(c.id, c.name));
  return (
    <VisualFrame
      title="Umurtqalilar yuragi taqqoslash"
      caption={
        <p>
          <span className="text-blue-400">Ko&apos;k</span> — venoz, <span className="text-red-400">qizil</span> — arterial,{" "}
          <span className="text-violet-400">binafsha</span> — aralash qon. Yuqorida bo&apos;lmacha(lar), pastda qorincha(lar). Qushlar va
          sutemizuvchilarda qon aralashmaydi — shuning uchun tana harorati doimiy.
        </p>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="heart-comparison">
        {HEART_CLASSES.map((item, i) => (
          <div
            key={item.id}
            className={`visual-pop rounded-lg border p-2 text-center text-[11px] ${
              isLit(item.id, item.name) ? "border-neon-cyan bg-neon-cyan/10" : anyLit ? "border-gray-800 opacity-50" : "border-gray-800"
            }`}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <p className="mb-1 font-semibold text-white">{item.name}</p>
            <Heart kind={item.kind} partial={"partial" in item ? item.partial : false} />
            <p className="mt-1 font-bold text-neon-cyan">{item.chambers}</p>
            <p className="text-gray-400">
              {item.circles} ta qon aylanish doirasi · {item.blood}
            </p>
            <p className={item.warm ? "text-orange-300" : "text-sky-300"}>{item.warm ? "issiq qonli" : "sovuq qonli"}</p>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}
