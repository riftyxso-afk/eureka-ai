/**
 * Katalog model AI — modul DATA MURNI (tanpa env/SDK) sehingga aman
 * diimpor komponen client (Model Store UI) maupun server (rantai provider
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
  { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", brand: "DeepSeek", logo: "/images/ai-models/deepseek-official.svg", tier: "fast", smartness: 3, desc: "Model cepat untuk percakapan dan rangkuman.", available: true },
  { id: "gpt-4o", name: "GPT-4o", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "fast", smartness: 4, desc: "Model serbaguna untuk belajar dan percakapan.", available: true },
  { id: "qwen3.8-max-0902", name: "Qwen 3.8 Max", brand: "Qwen", logo: "/images/ai-models/qwen-official.jpg", tier: "normal", smartness: 4, desc: "Model untuk penjelasan dan analisis.", available: true },
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "deep", smartness: 5, desc: "Model untuk tugas yang lebih mendalam.", available: true },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", brand: "Anthropic", logo: "/images/ai-models/claude-color.svg", tier: "normal", smartness: 4, desc: "Belum tersedia untuk key Juan Router saat ini.", available: false },
  // ── Kilat — cepat & ringan ──────────────────────────────────────────
  // ── Seimbang — cepat & akurat ───────────────────────────────────────
  // ── Mendalam — terpintar untuk materi kompleks ──────────────────────
];

/** Nama tampilan rapi untuk id model apa pun (fallback: id mentah). */
export function modelDisplayName(id: string | null | undefined): string {
  if (!id) return "";
  return MODEL_CATALOG.find((m) => m.id === id)?.name ?? id;
}

/** Set id model untuk cek allowlist API. */
export const MODEL_CATALOG_IDS = new Set(MODEL_CATALOG.map((m) => m.id));

/**
 * Daftar model per mode untuk pengguna FREE — hanya model murah
 * (`premiumOnly` dikecualikan). Urutan katalog = prioritas coba.
 */
export const SPEED_MODEL_LISTS: Record<AiSpeedMode, string[]> = {
  fast: ["deepseek-v4.1-flash", "gpt-4o"],
  normal: ["qwen3.8-max-0902", "gpt-4o", "deepseek-v4.1-flash"],
  deep: ["gpt-6.1-terra", "qwen3.8-max-0902", "gpt-4o"],
};

/**
 * Daftar model per mode untuk pengguna PRO — SEMUA model, model pintar
 * (`premiumOnly`) di depan tiap tier karena Pro membayar untuk kualitas
 * terbaik; model murah tetap ikut sebagai cadangan bila yang pintar gagal.
 */
export const SPEED_MODEL_LISTS_PRO: Record<AiSpeedMode, string[]> = {
  fast: [...SPEED_MODEL_LISTS.fast],
  normal: [...SPEED_MODEL_LISTS.normal],
  deep: [...SPEED_MODEL_LISTS.deep],
};
