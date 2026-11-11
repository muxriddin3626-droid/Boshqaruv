"use client";

import type { Flashcard, PendingFlashcardReview, PendingTestResult } from "./types";

/**
 * MODUL 5: Offline Sync — IndexedDB ustidagi yengil wrapper.
 *
 * Uchta "jadval" (object store) saqlaydi:
 * - `due_flashcards`: oxirgi marta serverdan olingan kartalar keshi (offline'da ko'rsatish uchun).
 * - `pending_reviews`: internet yo'qligida bosilgan "Esladim/Eslayolmadim" natijalari.
 * - `pending_test_results`: internet yo'qligida yechilgan testlar natijalari.
 *
 * Internet tiklanganda `useOnlineSync` hook shu navbatlarni o'qib,
 * `POST /api/v1/sync/push`ga yuboradi va muvaffaqiyatli yuborilganlarni
 * navbatdan o'chiradi.
 */

const DB_NAME = "ai-ustoz-offline";
const DB_VERSION = 1;

const STORE_DUE_FLASHCARDS = "due_flashcards";
const STORE_PENDING_REVIEWS = "pending_reviews";
const STORE_PENDING_TEST_RESULTS = "pending_test_results";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB bu muhitda mavjud emas"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DUE_FLASHCARDS)) {
        db.createObjectStore(STORE_DUE_FLASHCARDS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_REVIEWS)) {
        db.createObjectStore(STORE_PENDING_REVIEWS, { keyPath: "client_action_id" });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_TEST_RESULTS)) {
        db.createObjectStore(STORE_PENDING_TEST_RESULTS, { keyPath: "client_action_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);

    tx.oncomplete = () => resolve(request ? (request.result as T) : (undefined as T));
    tx.onerror = () => reject(tx.error);
  });
}

function getAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll() as unknown as IDBRequest<T[]>);
}

// --- Due flashcards keshi -----------------------------------------------

export async function cacheDueFlashcards(cards: Flashcard[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DUE_FLASHCARDS, "readwrite");
    const store = tx.objectStore(STORE_DUE_FLASHCARDS);
    store.clear();
    cards.forEach((card) => store.put(card));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getCachedDueFlashcards(): Promise<Flashcard[]> {
  return getAll<Flashcard>(STORE_DUE_FLASHCARDS);
}

export async function removeCachedFlashcard(flashcardId: string): Promise<void> {
  await withStore(STORE_DUE_FLASHCARDS, "readwrite", (store) => store.delete(flashcardId));
}

// --- Navbatga qo'yilgan (pending) harakatlar ------------------------------

export async function queuePendingReview(review: PendingFlashcardReview): Promise<void> {
  await withStore(STORE_PENDING_REVIEWS, "readwrite", (store) => store.put(review));
}

export function getPendingReviews(): Promise<PendingFlashcardReview[]> {
  return getAll<PendingFlashcardReview>(STORE_PENDING_REVIEWS);
}

export async function clearPendingReviews(clientActionIds: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_REVIEWS, "readwrite");
    const store = tx.objectStore(STORE_PENDING_REVIEWS);
    clientActionIds.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queuePendingTestResult(result: PendingTestResult): Promise<void> {
  await withStore(STORE_PENDING_TEST_RESULTS, "readwrite", (store) => store.put(result));
}

export function getPendingTestResults(): Promise<PendingTestResult[]> {
  return getAll<PendingTestResult>(STORE_PENDING_TEST_RESULTS);
}

export async function clearPendingTestResults(clientActionIds: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_TEST_RESULTS, "readwrite");
    const store = tx.objectStore(STORE_PENDING_TEST_RESULTS);
    clientActionIds.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** UUID v4 generatori — `client_action_id` uchun (crypto.randomUUID mavjud bo'lmasa fallback). */
export function generateClientActionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
