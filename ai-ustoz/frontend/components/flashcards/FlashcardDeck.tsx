"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { fetchDueFlashcards, reviewFlashcard } from "@/lib/api";
import {
  cacheDueFlashcards,
  generateClientActionId,
  getCachedDueFlashcards,
  queuePendingReview,
  removeCachedFlashcard,
} from "@/lib/offlineDb";
import type { Flashcard, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

/**
 * MODUL 1: AI Smart Flashcards & Spaced Repetition (Anki/Ebbinghaus).
 *
 * Har safar bitta karta ko'rsatiladi. O'quvchi avval kartaning old tarafini
 * (savol) ko'radi, "Javobni ko'rsatish" bosgach orqa tarafi (tushuntirish)
 * ochiladi, so'ng "Esladim" / "Eslayolmadim" tugmalaridan birini bosadi.
 *
 * MODUL 5 bilan integratsiya: agar server bilan aloqa bo'lmasa (offline),
 * natija IndexedDB navbatiga qo'yiladi va `useOnlineSync` internet
 * tiklanganda avtomatik yuboradi.
 */
export default function FlashcardDeck({ token, subject }: { token: string; subject: Subject }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);

  const loadDueCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const dueCards = await fetchDueFlashcards(token, subject);
      setCards(dueCards);
      await cacheDueFlashcards(dueCards);
    } catch {
      // Offline: oxirgi marta keshlangan kartalarni ko'rsatamiz
      const cached = await getCachedDueFlashcards();
      setCards(cached.filter((card) => card.subject === subject));
    } finally {
      setIsLoading(false);
    }
  }, [token, subject]);

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  const currentCard = cards[0];

  async function handleReview(remembered: boolean) {
    if (!currentCard) return;
    const reviewedAt = new Date().toISOString();

    try {
      await reviewFlashcard(token, currentCard.id, remembered);
    } catch {
      // Internet yo'q — offline navbatga qo'yamiz, MODUL 5 keyinroq sinxronlaydi
      await queuePendingReview({
        client_action_id: generateClientActionId(),
        flashcard_id: currentCard.id,
        remembered,
        reviewed_at: reviewedAt,
      });
    }

    await removeCachedFlashcard(currentCard.id);
    setCards((prev) => prev.slice(1));
    setReviewedCount((count) => count + 1);
    setIsFlipped(false);
  }

  if (isLoading) {
    return <p className="text-center text-gray-500">Kartalar yuklanmoqda...</p>;
  }

  if (!currentCard) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold text-neon-cyan">Ajoyib! Bugungi barcha kartalar tugadi.</p>
        {reviewedCount > 0 && <p className="text-sm text-gray-400">{reviewedCount} ta karta takrorlandi.</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="relative h-64 w-full max-w-md [perspective:1200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id + (isFlipped ? "-back" : "-front")}
            initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-neon-violet/30 bg-surface p-6 text-center shadow-xl"
          >
            <span className="mb-3 text-xs uppercase tracking-widest text-neon-cyan">
              {isFlipped ? "Javob" : "Savol"}
            </span>
            <MarkdownRenderer content={isFlipped ? currentCard.back_text : currentCard.front_text} />
          </motion.div>
        </AnimatePresence>
      </div>

      {!isFlipped ? (
        <button
          onClick={() => setIsFlipped(true)}
          className="rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-6 py-3 text-sm font-semibold text-white"
        >
          Javobni ko&apos;rsatish
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => handleReview(false)}
            className="rounded-xl border border-red-400/50 px-6 py-3 text-sm font-semibold text-red-400"
          >
            Eslayolmadim
          </button>
          <button
            onClick={() => handleReview(true)}
            className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-white"
          >
            Esladim
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">Qolgan kartalar: {cards.length}</p>
    </div>
  );
}
