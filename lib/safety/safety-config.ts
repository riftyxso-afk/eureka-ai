/**
 * Konfigurasi AI guardrails (NVIDIA NIM + lapisan lokal).
 *
 * Env:
 * - NVIDIA_API_KEY       (awalan nvapi-…; kosong = guardrail NIM nonaktif, fallback lokal)
 * - NIM_ENDPOINT         (default https://integrate.api.nvidia.com/v1)
 * - NIM_SAFETY_MODEL     (default nvidia/llama-3.1-nemotron-safety-guard-8b-v3)
 * - NIM_MODERATION_MODEL (default meta/llama-guard-3-8b)
 * - SAFETY_BLOCK_THRESHOLD (default 0.7 — skor keyakinan minimum untuk memblokir)
 * - SAFETY_ADMIN_USER_IDS  (CSV user ID admin untuk dashboard keamanan)
 */

/** 23 kategori keamanan (taksonomi LlamaGuard/Nemotron, diringkas). */
export const SAFETY_CATEGORIES = [
  "violence",
  "hate",
  "sexual",
  "self-harm",
  "harassment",
  "threat",
  "weapons",
  "drugs",
  "crime",
  "fraud",
  "privacy",
  "pii",
  "jailbreak",
  "prompt-injection",
  "misinformation",
  "spam",
  "politics",
  "religion-extremism",
  "child-safety",
  "animal-abuse",
  "discrimination",
  "profanity",
  "off-topic",
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const NIM_ENDPOINT =
  process.env.NIM_ENDPOINT ?? "https://integrate.api.nvidia.com/v1";

export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";

export const NIM_SAFETY_MODEL =
  process.env.NIM_SAFETY_MODEL ??
  "nvidia/llama-3.1-nemotron-safety-guard-8b-v3";

export const NIM_MODERATION_MODEL =
  process.env.NIM_MODERATION_MODEL ??
  "nvidia/llama-3.1-nemotron-safety-guard-8b-v3";

/** Skor keyakinan minimum (0–1) agar konten diblokir. */
export const SAFETY_BLOCK_THRESHOLD = (() => {
  const v = Number(process.env.SAFETY_BLOCK_THRESHOLD ?? "0.7");
  if (!Number.isFinite(v)) return 0.7;
  return Math.min(1, Math.max(0, v));
})();

/** True bila guardrail NIM bisa dipakai (ada API key). */
export function isNvidiaNimConfigured(): boolean {
  const key = NVIDIA_API_KEY.trim();
  return key.length > 10 && !key.includes("xxx");
}

/** Daftar user ID admin (CSV env) untuk dashboard keamanan. */
export function getSafetyAdminIds(): string[] {
  return (process.env.SAFETY_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSafetyAdmin(userId: string): boolean {
  if (!userId) return false;
  return getSafetyAdminIds().includes(userId);
}

/** Topik edukasi yang diizinkan (whitelist kata kunci, ID + EN). */
export const TOPIC_WHITELIST = [
  "matematika", "fisika", "kimia", "biologi", "sains", "ipa",
  "sejarah", "geografi", "ekonomi", "bahasa", "english", "indonesia",
  "pelajaran", "sekolah", "kuliah", "ujian", "tugas", "materi", "bab",
  "rumus", "soal", "kuis", "catatan", "belajar", "memahami", "jelaskan",
  "math", "physics", "chemistry", "biology", "science", "history",
  "lesson", "study", "exam", "homework", "formula", "quiz", "notes",
];

/** Topik yang selalu ditolak (blacklist kata kunci, ID + EN). */
export const TOPIC_BLACKLIST = [
  "judi", "slot gacor", "togel", "narkoba", "ganja", "sabu",
  "porn", "bokep", "dewasa 18+", "situs dewasa",
  "bom rakitan", "cara merakit bom", "senjata api rakitan",
  "bunuh diri", "cara bunuh diri", "self-harm",
  "gambling", "pornography", "how to make a bomb",
  "suicide instructions",
];

/** Pesan penolakan sopan (ID) saat konten diblokir. */
export const SAFETY_REFUSAL_ID =
  "Maaf, aku tidak bisa membantu dengan permintaan itu. " +
  "Yuk kembali ke materi pelajaran — ada yang bisa aku jelaskan?";
