"use client";

import { useEffect, useState } from "react";

import GameHub from "@/components/games/GameHub";
import HomeworkCenter, { type HomeworkRequest } from "@/components/homework/HomeworkCenter";
import LecturesView, { type LectureRequest } from "@/components/lectures/LecturesView";
import LoginForm from "@/components/auth/LoginForm";
import ChatWindow, { type LessonRequest } from "@/components/chat/ChatWindow";
import FlashcardDeck from "@/components/flashcards/FlashcardDeck";
import VoiceSession from "@/components/voice/VoiceSession";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import StudyPlanView from "@/components/plan/StudyPlanView";
import LeaderboardView from "@/components/progress/LeaderboardView";
import StatsBadge from "@/components/progress/StatsBadge";
import TestCenter from "@/components/tests/TestCenter";
import TextbookManager from "@/components/textbooks/TextbookManager";
import { VisualContext } from "@/components/visuals/VisualContext";
import TargetedDrill from "@/components/weakness/TargetedDrill";
import WeaknessRadarChart from "@/components/weakness/WeaknessRadarChart";
import { useOnlineSync } from "@/hooks/useOnlineSync";
import { downloadLessonConspect, fetchTextbookAccess } from "@/lib/api";
import type { Subject, TextbookAccess } from "@/lib/types";

type TabKey = "suhbat" | "reja" | "homework" | "tests" | "games" | "reyting" | "flashcards" | "radar" | "audio" | "darsliklar";

const TABS: { key: TabKey; label: string }[] = [
  { key: "suhbat", label: "Suhbat" },
  { key: "reja", label: "Reja" },
  { key: "homework", label: "Uy vazifasi" },
  { key: "tests", label: "Testlar" },
  { key: "games", label: "O'yinlar" },
  { key: "reyting", label: "Reyting" },
  { key: "flashcards", label: "Flashcard'lar" },
  { key: "radar", label: "Zaif nuqtalar" },
  { key: "audio", label: "Ma'ruzalar" },
];

/**
 * Asosiy sahifa: fan tanlash + 3 ta bo'lim (Suhbat/Ovoz, Flashcard'lar,
 * Weakness Radar) va PDF konspekt tugmasi bir joyda.
 *
 * Token bo'lmasa (yangi foydalanuvchi) — kirish so'rovnomasi ko'rsatiladi; u
 * oxirida akkaunt yaratib token qaytaradi. Token localStorage'da saqlanadi.
 * NOTE: production'da Supabase Auth bilan to'liq login oqimi ham kerak
 * (hozir boshqa qurilmadan shu akkauntga qayta kirish imkoni yo'q).
 */
export default function HomePage() {
  const [subject, setSubject] = useState<Subject>("kimyo");
  const [activeTab, setActiveTab] = useState<TabKey>("suhbat");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [lessonRequest, setLessonRequest] = useState<LessonRequest | null>(null);
  const [homeworkRequest, setHomeworkRequest] = useState<HomeworkRequest | null>(null);
  const [lectureRequest, setLectureRequest] = useState<LectureRequest | null>(null);

  // `token`ni useState initializer'ida emas, useEffect'da o'qiymiz: server
  // render paytida `window` mavjud emas, shuning uchun agar client'ning
  // BIRINCHI render'i (hydration uchun ishlatiladigan) localStorage'ni
  // sinxron o'qib, boshqacha JSX chiqarsa — React "Hydration failed"
  // xatosini beradi. Shu sababli ikkala tomon ham dastlab bir xil (bo'sh)
  // holatni chizadi, token esa faqat mount bo'lgach (hydration tugagach)
  // o'rnatiladi.
  const [token, setToken] = useState("");
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  // "Darsliklar" bo'limi faqat administratorlarga ko'rinadi (server ADMIN_PHONES bo'yicha aytadi).
  const [textbookAccess, setTextbookAccess] = useState<TextbookAccess | null>(null);

  useEffect(() => {
    if (!token) {
      setTextbookAccess(null);
      return;
    }
    let isCancelled = false;
    fetchTextbookAccess(token)
      .then((access) => !isCancelled && setTextbookAccess(access))
      .catch(() => !isCancelled && setTextbookAccess(null));
    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    // Mobil qurilmalarda Developer Tools/Console ochish qulay bo'lmagani
    // uchun token URL query parametri sifatida ham qabul qilinadi
    // (masalan: https://.../?token=...). Topilsa localStorage'ga
    // ko'chiriladi va URL'dan tozalanadi (tarixda/ekranda qolib ketmasin).
    const urlToken = new URLSearchParams(window.location.search).get("token");
    if (urlToken) {
      window.localStorage.setItem("ai_ustoz_token", urlToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    setToken(urlToken ?? window.localStorage.getItem("ai_ustoz_token") ?? "");
    const savedSubject = window.localStorage.getItem("ai_ustoz_subject");
    if (savedSubject === "kimyo" || savedSubject === "biologiya") setSubject(savedSubject);
    setIsTokenChecked(true);
  }, []);

  function selectSubject(next: Subject) {
    setSubject(next);
    window.localStorage.setItem("ai_ustoz_subject", next);
  }

  function startLesson(lessonSubject: Subject, topic: string) {
    selectSubject(lessonSubject);
    setLessonRequest({ id: Date.now(), topic });
    setActiveTab("suhbat");
  }

  function handleLogout() {
    window.localStorage.removeItem("ai_ustoz_token");
    window.localStorage.removeItem("ai_ustoz_subject");
    setAuthMode("login");
    setActiveTab("suhbat");
    setToken("");
  }

  function handleOnboarded(newToken: string, preferredSubject: Subject) {
    window.localStorage.setItem("ai_ustoz_token", newToken);
    window.localStorage.setItem("ai_ustoz_subject", preferredSubject);
    setSubject(preferredSubject);
    setToken(newToken);
  }

  const { isOnline, isSyncing } = useOnlineSync(token);

  if (!isTokenChecked) {
    return <main className="flex h-screen items-center justify-center text-gray-500">Yuklanmoqda...</main>;
  }

  if (!token) {
    return authMode === "login" ? (
      <LoginForm onLoggedIn={handleOnboarded} onSwitchToRegister={() => setAuthMode("register")} />
    ) : (
      <OnboardingWizard onComplete={handleOnboarded} onSwitchToLogin={() => setAuthMode("login")} />
    );
  }

  async function handleDownloadConspect() {
    setIsDownloadingPdf(true);
    try {
      await downloadLessonConspect(token, subject);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <VisualContext.Provider value={{ token, subject }}>
    <main className="mx-auto flex h-[100dvh] max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">
            AI <span className="text-neon-cyan">Ustoz</span>
          </h1>
          <StatsBadge token={token} refreshKey={activeTab} onClick={() => setActiveTab("reyting")} />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`}
            title={isOnline ? "Onlayn" : "Offlayn"}
          />
          <span className="text-gray-400">
            {isSyncing ? "Sinxronlanmoqda..." : isOnline ? "Onlayn" : "Offlayn — o'zgarishlar saqlanmoqda"}
          </span>
        </div>

        <div className="flex gap-2">
          {(["kimyo", "biologiya"] as Subject[]).map((s) => (
            <button
              key={s}
              onClick={() => selectSubject(s)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                subject === s ? "bg-neon-violet text-white" : "bg-surface text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            Chiqish
          </button>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto">
        {[...TABS, ...(textbookAccess?.is_admin ? [{ key: "darsliklar" as const, label: "Darsliklar" }] : [])].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeTab === tab.key ? "bg-neon-cyan text-black" : "bg-surface text-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={handleDownloadConspect}
          disabled={isDownloadingPdf}
          className="ml-auto shrink-0 rounded-full border border-neon-pink/50 px-4 py-1.5 text-sm text-neon-pink disabled:opacity-50"
        >
          {isDownloadingPdf ? "Tayyorlanmoqda..." : "PDF konspekt"}
        </button>
      </nav>

      {activeTab === "suhbat" && (
        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-3 md:overflow-hidden">
          {/* Telefonda yuzcha va suhbat ustma-ust: bo'lim o'zi suriladi, suhbat oynasi qirqilmaydi. */}
          <div className="flex items-center justify-center rounded-2xl border border-neon-violet/20 bg-surface/40 p-4 md:col-span-1">
            <VoiceSession token={token} subject={subject} />
          </div>
          <div className="h-[85dvh] min-h-[420px] rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4 md:col-span-2 md:h-auto md:min-h-0">
            <ChatWindow
              token={token}
              subject={subject}
              lessonRequest={lessonRequest}
              onLessonRequestHandled={() => setLessonRequest(null)}
              onRequestHomework={() => {
                setHomeworkRequest({ id: Date.now(), subject });
                setActiveTab("homework");
              }}
            />
          </div>
        </section>
      )}

      {activeTab === "reja" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4">
          <StudyPlanView
            token={token}
            onStartLesson={startLesson}
            onListenLecture={(lectureSubject, topic) => {
              selectSubject(lectureSubject);
              setLectureRequest({ id: Date.now(), subject: lectureSubject, topic });
              setActiveTab("audio");
            }}
            onOpenTests={() => setActiveTab("tests")}
          />
        </section>
      )}

      {activeTab === "homework" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-pink/20 bg-surface/40 p-4">
          <HomeworkCenter
            token={token}
            subject={subject}
            request={homeworkRequest}
            onRequestHandled={() => setHomeworkRequest(null)}
          />
        </section>
      )}

      {activeTab === "flashcards" && (
        <section className="flex-1 overflow-hidden rounded-2xl border border-neon-violet/20 bg-surface/40 p-4">
          <FlashcardDeck token={token} subject={subject} />
        </section>
      )}

      {activeTab === "radar" && (
        <section className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4">
          <WeaknessRadarChart token={token} subject={subject} />
          <TargetedDrill token={token} subject={subject} />
        </section>
      )}

      {activeTab === "tests" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4">
          <TestCenter token={token} subject={subject} />
        </section>
      )}

      {activeTab === "games" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-pink/20 bg-surface/40 p-4">
          <GameHub token={token} subject={subject} />
        </section>
      )}

      {activeTab === "reyting" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-violet/20 bg-surface/40 p-4">
          <LeaderboardView token={token} />
        </section>
      )}

      {activeTab === "darsliklar" && textbookAccess?.is_admin && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4">
          <TextbookManager token={token} access={textbookAccess} defaultSubject={subject} />
        </section>
      )}

      {activeTab === "audio" && (
        <section className="flex-1 overflow-y-auto rounded-2xl border border-neon-pink/20 bg-surface/40 p-4">
          <LecturesView
            token={token}
            subject={subject}
            request={lectureRequest}
            onRequestHandled={() => setLectureRequest(null)}
          />
        </section>
      )}
    </main>
    </VisualContext.Provider>
  );
}
