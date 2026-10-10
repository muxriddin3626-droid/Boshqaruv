"use client";

import { useEffect } from "react";

/**
 * MODUL 5: Offline Sync (PWA) — sahifa yuklanganda service worker'ni
 * ro'yxatdan o'tkazadi. Render qilmaydi, faqat effekt sifatida ishlaydi.
 */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker ro'yxatdan o'tmasa ham ilova oddiy online rejimda ishlayveradi
      });
    }
  }, []);

  return null;
}
