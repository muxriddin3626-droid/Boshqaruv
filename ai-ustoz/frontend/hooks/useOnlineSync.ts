"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pushOfflineSync } from "@/lib/api";
import {
  clearPendingReviews,
  clearPendingTestResults,
  getPendingReviews,
  getPendingTestResults,
} from "@/lib/offlineDb";

/**
 * MODUL 5: Offline Sync — internetni kuzatib boradi va tarmoq tiklanishi
 * bilan (yoki komponent mount bo'lganda, agar allaqachon online bo'lsa)
 * IndexedDB'da to'plangan barcha offline harakatlarni serverga yuboradi.
 */
export function useOnlineSync(token: string) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlightRef = useRef(false);

  const flushPendingSync = useCallback(async () => {
    if (syncInFlightRef.current || !token) return;
    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const [reviews, testResults] = await Promise.all([getPendingReviews(), getPendingTestResults()]);
      if (reviews.length === 0 && testResults.length === 0) return;

      await pushOfflineSync(token, reviews, testResults);

      // Backend har bir elementni client_action_id orqali idempotent qo'llaydi,
      // shuning uchun muvaffaqiyatli yuborilgan barcha elementlarni (applied
      // yoki duplicate sifatida skip qilinganlarni ham) xavfsiz o'chiramiz.
      await clearPendingReviews(reviews.map((r) => r.client_action_id));
      await clearPendingTestResults(testResults.map((r) => r.client_action_id));
    } catch {
      // Tarmoq hali barqaror emas — keyingi "online" hodisasida qayta urinib ko'riladi.
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      flushPendingSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      flushPendingSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushPendingSync]);

  return { isOnline, isSyncing, flushPendingSync };
}
