"use client";

import { createContext, useContext } from "react";

import type { Subject } from "@/lib/types";

/** Chizmalar (masalan AI rasm) backend'ga murojaat qilishi uchun: kirgan o'quvchi tokeni va joriy fan. */
export const VisualContext = createContext<{ token: string | null; subject: Subject }>({ token: null, subject: "kimyo" });

export function useVisualContext() {
  return useContext(VisualContext);
}
