"use client";

import { useEffect, useState } from "react";

import { fetchPhoto, mediaUrl, requestPhoto } from "@/lib/api";
import type { PhotoState } from "@/lib/types";
import type { PhotoSpec } from "@/lib/visuals/blocks";

import { useVisualContext } from "./VisualContext";
import { VisualFrame } from "./VisualFrame";

const POLL_MS = 2000;
const MAX_POLLS = 30; // ~1 daqiqa

type State = { kind: "loading" } | { kind: "ready"; photo: PhotoState; url: string } | { kind: "missing"; message: string };

/** Faqat http(s) havolalar — Commons metama'lumotidan kelgan matn bo'lgani uchun tekshiriladi. */
function safeLink(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** Internetdagi haqiqiy rasm (Wikimedia Commons): muallif va litsenziya bilan; topilmasa — dars chizmalar bilan davom etadi. */
export default function Photo({ spec }: { spec: PhotoSpec }) {
  const { token, subject } = useVisualContext();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "missing", message: "Rasm faqat tizimga kirgan o'quvchiga ko'rsatiladi." });
      return;
    }
    let isCancelled = false;
    let timer: number | undefined;

    const apply = (photo: PhotoState, polls: number) => {
      if (isCancelled) return;
      if (photo.status === "ready" && photo.image_url) setState({ kind: "ready", photo, url: mediaUrl(photo.image_url) });
      else if (photo.status === "not_found") setState({ kind: "missing", message: "Internetdan mos rasm topilmadi — chizmalar bilan davom etamiz." });
      else if (photo.status === "failed") setState({ kind: "missing", message: "Rasmni hozir olib bo'lmadi — keyinroq yana urinib ko'ramiz." });
      else if (polls >= MAX_POLLS) setState({ kind: "missing", message: "Rasm juda uzoq qidirilyapti — keyinroq qayta oching." });
      else
        timer = window.setTimeout(async () => {
          try {
            apply(await fetchPhoto(token, photo.id), polls + 1);
          } catch {
            apply(photo, polls + 1);
          }
        }, POLL_MS);
    };

    requestPhoto(token, subject, spec.query)
      .then((photo) => apply(photo, 0))
      .catch((err) => !isCancelled && setState({ kind: "missing", message: err instanceof Error ? err.message : "Rasmni topib bo'lmadi." }));
    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, subject, spec.query]);

  const credit =
    state.kind === "ready" ? (
      <p className="text-[11px] leading-snug text-gray-500" data-testid="photo-credit">
        Manba:{" "}
        <a href={safeLink(state.photo.source_url)} target="_blank" rel="noreferrer noopener" className="underline hover:text-gray-300">
          Wikimedia Commons
        </a>
        {state.photo.author && <> · Muallif: {state.photo.author}</>}
        {state.photo.license && (
          <>
            {" "}
            · Litsenziya:{" "}
            {safeLink(state.photo.license_url) ? (
              <a href={safeLink(state.photo.license_url)} target="_blank" rel="noreferrer noopener" className="underline hover:text-gray-300">
                {state.photo.license}
              </a>
            ) : (
              state.photo.license
            )}
          </>
        )}
      </p>
    ) : null;

  return (
    <VisualFrame
      title="Haqiqiy rasm"
      caption={
        state.kind === "ready" ? (
          <div className="space-y-1">
            {spec.caption && <p>{spec.caption}</p>}
            {credit}
          </div>
        ) : (
          spec.caption || undefined
        )
      }
    >
      {state.kind === "loading" && (
        <div className="flex aspect-[4/3] w-full max-w-md animate-pulse items-center justify-center rounded-lg bg-white/5 text-xs text-gray-400" data-testid="photo-loading">
          Internetdan rasm qidirilmoqda...
        </div>
      )}
      {state.kind === "ready" && (
        <a href={state.url} target="_blank" rel="noreferrer" title="Kattalashtirish">
          {/* Oq fon: Commons diagrammalari ko'pincha shaffof va qora yozuvli — qorong'i fonda o'qilmaydi. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.url}
            alt={spec.caption || state.photo.title || spec.query}
            loading="lazy"
            className="visual-pop w-full max-w-md rounded-lg bg-white p-1"
            data-testid="photo-image"
          />
        </a>
      )}
      {state.kind === "missing" && (
        <p className="text-xs text-gray-400" data-testid="photo-missing">
          {state.message}
        </p>
      )}
    </VisualFrame>
  );
}
