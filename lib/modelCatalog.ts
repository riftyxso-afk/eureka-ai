/**
 * Katalog model AI — modul DATA MURNI (tanpa env/SDK) sehingga aman
 * diimpor komponen client maupun server (rantai provider
 * di lib/ai.ts). SUMBER TUNGGAL daftar tier + metadata tampilan.
 *
 * smartness: 1 = sedikit pintar … 5 = terpintar (badge UI Model Store).
 * available: false = belum ada channel di Juan Router (gagal cepat 503/400,
 * rantai lanjut otomatis ke model berikutnya) — ditandai "segera tersedia".
 */

/** Kecepatan jawaban AI yang bisa dipilih user (Kilat/Seimbang/Mendalam). */
export type AiSpeedMode = "fast" | "normal" | "deep";

export interface ModelCatalogEntry {
  id: string;
  /** Nama tampilan rapi untuk UI (bukan id teknis). */
  name: string;
  brand: string;
  /** Path logo di public/images/ai-models/ (fallback ikon tier di UI). */
  logo: string;
  tier: AiSpeedMode;
  smartness: number;
  desc: string;
  available: boolean;
  /** true = hanya bisa dipakai pengguna Pro (ditandai & dikunci di UI). */
  premiumOnly?: boolean;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", brand: "DeepSeek", logo: "/images/ai-models/deepseek-official.svg", tier: "fast", smartness: 4, desc: "Respons cepat untuk belajar dan percakapan.", available: true },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash", brand: "Google", logo: "/images/ai-models/gemini-color.svg", tier: "normal", smartness: 4, desc: "Penjelasan dan pemahaman materi.", available: true },
  { id: "glm-5.3-flash", name: "GLM 5.3 Flash", brand: "Z.ai", logo: "/images/ai-models/zhipu-color.svg", tier: "deep", smartness: 4, desc: "Analisis dan latihan terstruktur.", available: true },
];

/** Nama tampilan rapi untuk id model apa pun (fallback: id mentah). */
export function modelDisplayName(id: string | null | undefined): string {
  if (!id) return "";
  return MODEL_CATALOG.find((m) => m.id === id)?.name ?? id;
}

/** Set id model untuk cek allowlist API. */
export const MODEL_CATALOG_IDS = new Set(MODEL_CATALOG.map((m) => m.id));

/** Prioritas otomatis per effort. Semua entri tetap menjadi fallback. */
export const SPEED_MODEL_LISTS: Record<AiSpeedMode, string[]> = {
  fast: ["deepseek-v4.1-flash", "glm-5.3-flash", "gemini-3.8-flash-high"],
  normal: ["gemini-3.8-flash-high", "deepseek-v4.1-flash", "glm-5.3-flash"],
  deep: ["glm-5.3-flash", "gemini-3.8-flash-high", "deepseek-v4.1-flash"],
};

/** Kompatibilitas pemanggil lama; akses paket diperiksa di route. */
export const SPEED_MODEL_LISTS_PRO: Record<AiSpeedMode, string[]> = {
  fast: [...SPEED_MODEL_LISTS.fast],
  normal: [...SPEED_MODEL_LISTS.normal],
  deep: [...SPEED_MODEL_LISTS.deep],
};
