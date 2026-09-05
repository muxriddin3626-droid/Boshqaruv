"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { fetchWeaknessRadar } from "@/lib/api";
import type { RadarPoint, Subject } from "@/lib/types";

/**
 * MODUL 3: Weakness Radar — o'quvchining fan bo'limlari (masalan "Genetika",
 * "Organik kimyo") bo'yicha bilim darajasini Radar Chart ko'rinishida
 * ko'rsatadi. Past mastery% — qizil zonaga yaqin, yuqori mastery% — chetga.
 */
export default function WeaknessRadarChart({ token, subject }: { token: string; subject: Subject }) {
  const [points, setPoints] = useState<RadarPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchWeaknessRadar(token, subject)
      .then((data) => {
        if (!cancelled) setPoints(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, subject]);

  if (isLoading) {
    return <p className="text-center text-gray-500">Radar ma&apos;lumotlari yuklanmoqda...</p>;
  }

  if (points.length === 0) {
    return (
      <p className="text-center text-gray-500">
        Hali radar uchun yetarli ma&apos;lumot yo&apos;q — test yeching yoki suhbatni davom ettiring.
      </p>
    );
  }

  const chartData = points.map((point) => ({
    category: point.category,
    mastery: point.mastery_percentage,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="75%">
          <PolarGrid stroke="rgba(168, 85, 247, 0.25)" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#e5e7eb", fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} />
          <Radar
            name="O'zlashtirish %"
            dataKey="mastery"
            stroke="#22d3ee"
            fill="#a855f7"
            fillOpacity={0.45}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(0)}%`, "O'zlashtirish"]}
            contentStyle={{ backgroundColor: "#12121e", border: "1px solid #a855f7" }}
            labelStyle={{ color: "#e5e7eb" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
