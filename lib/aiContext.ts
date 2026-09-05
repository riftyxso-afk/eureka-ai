/**
 * Konteks premium untuk pemilihan model AI (AsyncLocalStorage).
 *
 * Titik masuk request (chat, notes/process, regenerate, quiz, flashcards)
 * membungkus kerjanya dengan runWithPremium(isPremium, fn). getProviderChain
 * membaca konteks ini untuk memutuskan rantai model:
 * - Pro  → semua model katalog (model pintar di depan per tier)
 * - free → hanya model murah (premiumOnly dikecualikan)
 *
 * Tanpa konteks (job lama, skrip) dianggap FREE — aman untuk biaya; jalur
 * produksi selalu dibungkus eksplisit.
 */
import { AsyncLocalStorage } from "async_hooks";

const store = new AsyncLocalStorage<{ premium: boolean }>();

/** Jalankan fn dengan status premium yang terlihat oleh getProviderChain. */
export function runWithPremium<T>(premium: boolean, fn: () => T): T {
  return store.run({ premium }, fn);
}

/** Status premium konteks aktif (undefined bila di luar bungkus). */
export function getAiPremiumContext(): boolean | undefined {
  return store.getStore()?.premium;
}
