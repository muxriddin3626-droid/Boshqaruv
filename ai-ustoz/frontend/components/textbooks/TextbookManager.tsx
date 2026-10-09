"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { deleteTextbook, fetchTextbooks, importBundledTextbooks, retryTextbook, uploadTextbook } from "@/lib/api";
import type { Subject, Textbook, TextbookAccess } from "@/lib/types";

const POLL_MS = 3000;
const GRADES = [5, 6, 7, 8, 9, 10, 11];
const STAGES: Record<string, string> = { matn: "Matn ajratilmoqda", ocr: "Skaner sahifalar o'qilmoqda (OCR)", embedding: "Bilim bazasiga yozilmoqda" };

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function StatusLine({ book }: { book: Textbook }) {
  if (book.status === "ready")
    return (
      <p className="text-xs text-emerald-300">
        ✓ Tayyor — {book.chunks_count} bo&apos;lak; {book.pages_text} bet matn
        {book.pages_ocr ? `, ${book.pages_ocr} bet OCR` : ""}
        {book.pages_skipped ? `, ${book.pages_skipped} bet o'tkazib yuborildi (matnsiz)` : ""}
      </p>
    );
  if (book.status === "failed") return <p className="text-xs text-red-300">✗ {book.error ?? "Xato"}</p>;
  if (book.status === "queued") return <p className="text-xs text-gray-400">Navbatda...</p>;
  const fraction = book.progress_total ? book.progress_done / book.progress_total : 0;
  return (
    <div className="space-y-1">
      <p className="text-xs text-neon-cyan">
        {STAGES[book.stage ?? ""] ?? "Qayta ishlanmoqda"}
        {book.progress_total ? ` — ${book.progress_done}/${book.progress_total}` : "..."}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-neon-cyan transition-all" style={{ width: `${Math.max(4, fraction * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Darsliklar (faqat admin): PDF yuklanadi, server fonda matnini ajratadi (skaner sahifalarni
 * OCR qiladi) va bilim bazasiga yozadi — AI Ustoz shu sinf o'quvchilariga darsda undan foydalanadi.
 */
export default function TextbookManager({ token, access, defaultSubject }: { token: string; access: TextbookAccess; defaultSubject: Subject }) {
  const [books, setBooks] = useState<Textbook[]>([]);
  const [subject, setSubject] = useState<Subject>(defaultSubject);
  const [grade, setGrade] = useState(7);
  const [title, setTitle] = useState("");
  const [useOcr, setUseOcr] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [bundled, setBundled] = useState<string[]>(access.bundled_pending ?? []);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setBooks(await fetchTextbooks(token));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Ro'yxatni olib bo'lmadi" });
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const busy = books.some((book) => book.status === "queued" || book.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  const tooBig = file !== null && file.size > access.max_mb * 1024 * 1024;

  const submit = async () => {
    if (!file || tooBig) return;
    setMessage(null);
    setUploadProgress(0);
    try {
      const book = await uploadTextbook(token, { file, subject, grade, title, useOcr }, setUploadProgress);
      setBooks((current) => [book, ...current]);
      setMessage({ tone: "ok", text: `"${book.title}" yuklandi (${book.pages_total} bet) — endi fonda qayta ishlanadi.` });
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Yuklab bo'lmadi" });
    } finally {
      setUploadProgress(null);
    }
  };

  const act = async (action: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Xato" });
    }
    await refresh();
  };

  const importBundled = async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      const { queued } = await importBundledTextbooks(token, useOcr);
      setBundled([]);
      setMessage({ tone: "ok", text: `${queued.length} ta darslik navbatga qo'yildi — bittadan qayta ishlanadi. Bu sahifani yopsangiz ham davom etadi.` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Xato" });
    } finally {
      setIsImporting(false);
      await refresh();
    }
  };

  return (
    <div className="space-y-4" data-testid="textbooks">
      {bundled.length > 0 && (
        <div className="rounded-2xl border border-neon-cyan/40 bg-neon-cyan/5 p-4" data-testid="textbook-bundled">
          <h2 className="text-base font-semibold text-white">Ilova ichida {bundled.length} ta darslik tayyor turibdi</h2>
          <p className="mt-1 text-xs text-gray-300">{bundled.join(", ")}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            Bir bosishda hammasi AI Ustoz bilim bazasiga qo&apos;shiladi. Skanerlangan kitoblarni o&apos;qish (OCR) pullik — pastdagi belgi bilan boshqariladi.
          </p>
          <button
            type="button"
            disabled={isImporting}
            onClick={() => void importBundled()}
            className="mt-3 w-full rounded-xl bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            data-testid="textbook-import-bundled"
          >
            {isImporting ? "Qo'shilmoqda..." : "Hammasini bilim bazasiga qo'shish"}
          </button>
        </div>
      )}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-base font-semibold text-white">Darslik yuklash</h2>
        <p className="mt-1 text-xs text-gray-400">
          PDF darslikni yuklang — AI Ustoz uni o&apos;qib chiqadi va shu sinf o&apos;quvchilariga darsda undan foydalanadi. Fayl {access.max_mb} MB gacha.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block rounded-xl border border-dashed border-white/20 px-3 py-4 text-center text-sm text-gray-300 hover:border-neon-cyan/60">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              data-testid="textbook-file"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !title) setTitle(picked.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
              }}
            />
            {file ? (
              <span>
                📄 {file.name} <span className="text-gray-500">({megabytes(file.size)})</span>
              </span>
            ) : (
              <span>📄 PDF faylni tanlang</span>
            )}
          </label>
          {tooBig && <p className="text-xs text-red-300">Fayl {access.max_mb} MB dan katta — PDF ni siqib (compress) qayta yuklang.</p>}
          <div className="grid grid-cols-2 gap-2">
            <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white" data-testid="textbook-subject">
              <option value="kimyo">Kimyo</option>
              <option value="biologiya">Biologiya</option>
            </select>
            <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white" data-testid="textbook-grade">
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}-sinf
                </option>
              ))}
            </select>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Nomi (masalan: Zoologiya 7-sinf)"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500"
            data-testid="textbook-title"
          />
          <label className="flex items-start gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} className="mt-0.5" />
            <span>
              Skanerlangan (rasm ko&apos;rinishidagi) sahifalarni ham o&apos;qish (OCR). Pullik: ~1 sahifa ≈ 1 sent, bitta darslikda ko&apos;pi bilan {access.ocr_max_pages} sahifa.
            </span>
          </label>
          {uploadProgress !== null ? (
            <div className="space-y-1">
              <p className="text-xs text-neon-cyan">Yuklanmoqda... {Math.round(uploadProgress * 100)}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-neon-cyan transition-all" style={{ width: `${uploadProgress * 100}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!file || tooBig}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
              data-testid="textbook-upload"
            >
              Yuklash
            </button>
          )}
          {message && (
            <p className={`text-xs ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`} data-testid="textbook-message">
              {message.text}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2" data-testid="textbook-list">
        <h3 className="text-sm font-semibold text-gray-200">Yuklangan darsliklar ({books.length})</h3>
        {books.length === 0 && <p className="text-xs text-gray-500">Hali darslik yuklanmagan.</p>}
        {books.map((book) => (
          <div key={book.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3" data-testid="textbook-item">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{book.title}</p>
                <p className="text-[11px] text-gray-500">
                  {book.subject === "kimyo" ? "Kimyo" : "Biologiya"}, {book.grade}-sinf · {book.pages_total} bet · {megabytes(book.size_bytes)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {book.status === "failed" && (
                  <button type="button" onClick={() => void act(() => retryTextbook(token, book.id))} className="rounded-lg border border-neon-cyan/40 px-2 py-1 text-[11px] text-neon-cyan">
                    Qayta urinish
                  </button>
                )}
                {book.status !== "processing" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`"${book.title}" o'chirilsinmi? AI Ustoz bu darslikdan foydalanmay qo'yadi.`)) void act(() => deleteTextbook(token, book.id));
                    }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-gray-400 hover:text-red-300"
                    aria-label="O'chirish"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2">
              <StatusLine book={book} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
