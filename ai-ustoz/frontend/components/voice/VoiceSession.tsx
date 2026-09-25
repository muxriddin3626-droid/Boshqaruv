"use client";

import { useRef, useState } from "react";

import { createVoiceSession } from "@/lib/api";
import type { Subject, VoiceMode } from "@/lib/types";

import NeonOrb from "./NeonOrb";
import { useAudioVisualizer } from "./useAudioVisualizer";

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

/**
 * OpenAI Realtime API bilan to'g'ridan-to'g'ri WebRTC ulanish o'rnatadi:
 * 1. Backenddan ephemeral client_secret olinadi (audio backend orqali oqmaydi).
 * 2. Mikrofon oqimi RTCPeerConnection'ga qo'shiladi.
 * 3. SDP offer OpenAI serveriga yuboriladi, javobda kelgan SDP answer o'rnatiladi.
 * 4. Modelning ovoz oqimi (remote track) audio elementga ulanadi va
 *    Neon Orb vizualizatori shu oqimning amplitudasini ko'rsatadi.
 *
 * MODUL 2: "Munozara rejimi" — `mode="debate"` tanlansa, AI Ustoz atayin
 * noto'g'ri ilmiy gipoteza aytadi va o'quvchi buni ovozli ravishda rad
 * etishi kerak bo'ladi (backend `debate_prompt.py` orqali system promptni
 * almashtiradi, frontend faqat rejimni tanlab beradi).
 */
export default function VoiceSession({ token, subject }: { token: string; subject: Subject }) {
  const [mode, setMode] = useState<VoiceMode>("tutor");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const amplitude = useAudioVisualizer(remoteStream);

  async function startVoiceSession() {
    setError(null);
    setIsConnecting(true);
    try {
      const session = await createVoiceSession(token, subject, mode);

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (audioElRef.current) {
          audioElRef.current.srcObject = event.streams[0];
        }
      };

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = micStream;
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      // Model matn/hodisa xabarlari uchun data channel (transkript, funksiya chaqiruvlari va h.k.)
      pc.createDataChannel("oai-events");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${session.model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error("OpenAI Realtime bilan SDP almashinuvi muvaffaqiyatsiz tugadi");
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ovozli suhbatni boshlab bo'lmadi");
      stopVoiceSession();
    } finally {
      setIsConnecting(false);
    }
  }

  function stopVoiceSession() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <NeonOrb amplitude={amplitude} isActive={isConnected} />
      <audio ref={audioElRef} autoPlay hidden />

      {!isConnected && (
        <div className="flex gap-2 text-xs">
          {(
            [
              { value: "tutor" as VoiceMode, label: "Repetitor rejimi" },
              { value: "debate" as VoiceMode, label: "Munozara rejimi" },
            ]
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-full px-3 py-1 ${
                mode === option.value ? "bg-neon-pink text-white" : "bg-surface text-gray-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={isConnected ? stopVoiceSession : startVoiceSession}
        disabled={isConnecting}
        className="rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isConnecting ? "Ulanmoqda..." : isConnected ? "Suhbatni tugatish" : "Ovozli suhbatni boshlash"}
      </button>
    </div>
  );
}
