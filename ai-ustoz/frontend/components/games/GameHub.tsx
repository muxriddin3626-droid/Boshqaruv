"use client";

import { useState } from "react";

import type { Subject } from "@/lib/types";

import Blitz from "./Blitz";
import Matching from "./Matching";
import Millionaire from "./Millionaire";

type GameKey = "millioner" | "blitz" | "matching";

const GAMES: { key: GameKey; title: string; description: string; accent: string }[] = [
  {
    key: "millioner",
    title: "Millioner",
    description: "15 savol, qiyinlashib boradi. 50/50 va Ustoz maslahati yordamlari.",
    accent: "from-yellow-400/20 to-orange-500/10 border-yellow-500/30",
  },
  {
    key: "blitz",
    title: "Tezkor blits",
    description: "60 soniya: to'g'ri yoki noto'g'ri? Kombo bilan ochko ikki-uch barobar.",
    accent: "from-cyan-400/20 to-violet-500/10 border-cyan-500/30",
  },
  {
    key: "matching",
    title: "Juftlash",
    description: "Atamani ta'rifi bilan juftla: element ↔ belgi, organoid ↔ vazifasi.",
    accent: "from-pink-400/20 to-violet-500/10 border-pink-500/30",
  },
];

export default function GameHub({ token, subject }: { token: string; subject: Subject }) {
  const [active, setActive] = useState<GameKey | null>(null);
  const exit = () => setActive(null);

  if (active === "millioner") return <Millionaire token={token} subject={subject} onExit={exit} />;
  if (active === "blitz") return <Blitz token={token} subject={subject} onExit={exit} />;
  if (active === "matching") return <Matching token={token} subject={subject} onExit={exit} />;

  return (
    <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
      {GAMES.map((game) => (
        <button
          key={game.key}
          onClick={() => setActive(game.key)}
          className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition hover:scale-[1.01] ${game.accent}`}
        >
          <p className="font-bold text-white">{game.title}</p>
          <p className="mt-1 text-sm text-gray-400">{game.description}</p>
        </button>
      ))}
    </div>
  );
}
