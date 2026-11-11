"use client";

import { useEffect, useState } from "react";

import { fetchIllustration, mediaUrl, requestIllustration } from "@/lib/api";
import type { IllustrationSpec } from "@/lib/visuals/blocks";

import { useVisualContext } from "./VisualContext";
import { VisualFrame } from "./VisualFrame";

const POLL_MS = 3000;
const MAX_POLLS = 40; // ~2 daqiqa

type State = { kind: "loading" } | { kind: "ready"; url: string } | { kind: "error"; message: string };

/** AI chizgan dars rasmi: bir xil tavsif keshdan darhol keladi, yangisi fonda chiziladi. */
export default function Illustration({ spec }: { spec: IllustrationSpec }) {
  const { token, subject } = useVisualContext();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Rasm faqat tizimga kirgan o'quvchiga chiziladi." });
      return;
    }
    let isCancelled = false;
    let timer: number | undefined;

    const apply = (id: string, status: string, url: string | null, polls: number) => {
      if (isCancelled) return;
      if (status === "ready" && url) setState({ kind: "ready", url: mediaUrl(url) });
      else if (status === "failed") setState({ kind: "error", message: "Rasm chizilmadi." });
      else if (polls >= MAX_POLLS) setState({ kind: "error", message: "Rasm juda uzoq chizilyapti — keyinroq qayta oching." });
      else
        timer = window.setTimeout(async () => {
          try {
            const next = await fetchIllustration(token, id);
            apply(id, next.status, next.image_url, polls + 1);
          } catch {
            apply(id, "generating", null, polls + 1);
          }
        }, POLL_MS);
    };

    requestIllustration(token, subject, spec.prompt)
      .then((result) => apply(result.id, result.status, result.image_url, 0))
      .catch((err) => !isCancelled && setState({ kind: "error", message: err instanceof Error ? err.message : "Rasm chizilmadi." }));
    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, subject, spec.prompt]);

  return (
    <VisualFrame title="Rasm" caption={spec.caption || undefined}>
      {state.kind === "loading" && (
        <div className="flex aspect-square w-full max-w-sm animate-pulse items-center justify-center rounded-lg bg-white/5 text-xs text-gray-400" data-testid="illustration-loading">
          AI Ustoz rasm chizyapti...
        </div>
      )}
      {state.kind === "ready" && (
        <a href={state.url} target="_blank" rel="noreferrer" title="Kattalashtirish">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.url} alt={spec.caption || spec.prompt} loading="lazy" className="visual-pop w-full max-w-sm rounded-lg" data-testid="illustration-image" />
        </a>
      )}
      {state.kind === "error" && <p className="text-xs text-gray-400">{state.message}</p>}
    </VisualFrame>
  );
}
