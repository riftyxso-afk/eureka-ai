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
  // ── Kilat — cepat & ringan ──────────────────────────────────────────
  { id: "glm-5.3-flash", name: "GLM 5.3 Flash", brand: "Zhipu AI", logo: "/images/ai-models/zhipu-color.svg", tier: "fast", smartness: 2, desc: "Ringkas dan gesit untuk pertanyaan sehari-hari.", available: true },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash", brand: "Google", logo: "/images/ai-models/gemini-color.svg", tier: "fast", smartness: 3, desc: "Generasi flash terbaru — cepat dengan penalaran lebih baik.", available: true },
  { id: "gemini-3.7-flash-low", name: "Gemini 3.7 Flash", brand: "Google", logo: "/images/ai-models/gemini-color.svg", tier: "fast", smartness: 2, desc: "Paling ngebut di kelas Kilat, pas untuk cek cepat.", available: true },
  { id: "nemotron-3.5-lightning", name: "Nemotron 3.5 Lightning", brand: "NVIDIA", logo: "/images/ai-models/nvidia-color.svg", tier: "fast", smartness: 2, desc: "Model kilat NVIDIA — segera tersedia.", available: false },
  // ── Seimbang — cepat & akurat ───────────────────────────────────────
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "normal", smartness: 4, desc: "Keseimbangan terbaik antara kecepatan dan kedalaman.", available: true, premiumOnly: true },
  { id: "minimax-m3", name: "MiniMax M3", brand: "MiniMax", logo: "/images/ai-models/minimax-color.svg", tier: "normal", smartness: 3, desc: "Jawaban terstruktur, kuat untuk materi pelajaran.", available: true },
  { id: "hy-4-preview", name: "Hunyuan 4 Preview", brand: "Tencent", logo: "/images/ai-models/tencent-color.svg", tier: "normal", smartness: 3, desc: "Preview Hunyuan — penalaran solid berbahasa Indonesia.", available: true },
  { id: "grok-4.5-high", name: "Grok 4.5 High", brand: "xAI", logo: "/images/ai-models/xai-color.svg", tier: "normal", smartness: 4, desc: "Grok effort tinggi — akurat tanpa terlalu lambat.", available: true, premiumOnly: true },
  // ── Mendalam — terpintar untuk materi kompleks ──────────────────────
  { id: "gpt-6-astra", name: "GPT-6 Astra", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "deep", smartness: 5, desc: "Model terdalam terbaru — khusus pengguna Pro.", available: true, premiumOnly: true },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "deep", smartness: 5, desc: "Penalaran terdalam OpenAI — segera stabil kembali.", available: false, premiumOnly: true },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", brand: "OpenAI", logo: "/images/ai-models/openai-color.svg", tier: "deep", smartness: 5, desc: "Andalan untuk analisis panjang & soal kompleks.", available: true, premiumOnly: true },
  { id: "claude-opus-5", name: "Claude Opus 5", brand: "Anthropic", logo: "/images/ai-models/claude-color.svg", tier: "deep", smartness: 5, desc: "Claude Opus — penalaran paling halus. Segera tersedia.", available: false, premiumOnly: true },
  { id: "qwen3.8-max", name: "Qwen 3.8 Max", brand: "Alibaba", logo: "/images/ai-models/qwen-color.svg", tier: "deep", smartness: 4, desc: "Qwen flagship — kuat untuk sains & matematika. Segera tersedia.", available: false, premiumOnly: true },
  { id: "grok-4.6-xhigh", name: "Grok 4.6 XHigh", brand: "xAI", logo: "/images/ai-models/xai-color.svg", tier: "deep", smartness: 5, desc: "Grok effort ekstra-tinggi — paling teliti di kelasnya.", available: true, premiumOnly: true },
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
  fast: MODEL_CATALOG.filter((m) => m.tier === "fast" && !m.premiumOnly).map((m) => m.id),
  normal: MODEL_CATALOG.filter((m) => m.tier === "normal" && !m.premiumOnly).map((m) => m.id),
  deep: MODEL_CATALOG.filter((m) => m.tier === "deep" && !m.premiumOnly).map((m) => m.id),
};

/**
 * Daftar model per mode untuk pengguna PRO — SEMUA model, model pintar
 * (`premiumOnly`) di depan tiap tier karena Pro membayar untuk kualitas
 * terbaik; model murah tetap ikut sebagai cadangan bila yang pintar gagal.
 */
export const SPEED_MODEL_LISTS_PRO: Record<AiSpeedMode, string[]> = {
  fast: [
    ...MODEL_CATALOG.filter((m) => m.tier === "fast" && m.premiumOnly).map((m) => m.id),
    ...MODEL_CATALOG.filter((m) => m.tier === "fast" && !m.premiumOnly).map((m) => m.id),
  ],
  normal: [
    ...MODEL_CATALOG.filter((m) => m.tier === "normal" && m.premiumOnly).map((m) => m.id),
    ...MODEL_CATALOG.filter((m) => m.tier === "normal" && !m.premiumOnly).map((m) => m.id),
  ],
  deep: [
    ...MODEL_CATALOG.filter((m) => m.tier === "deep" && m.premiumOnly).map((m) => m.id),
    ...MODEL_CATALOG.filter((m) => m.tier === "deep" && !m.premiumOnly).map((m) => m.id),
  ],
};
