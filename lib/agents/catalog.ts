/**
 * Katalog agent Eureka Multi Agent — konfigurasi model per agent, terpusat.
 *
 * Enam persona (PRD Master §4):
 * - Kompas (Orchestrator) — baca intent, arahkan ke agent, pegang state loop
 * - Socra (Tutor)         — inti Socratic tutoring, ajukan pertanyaan pemandu
 * - Lensa (Assessment)    — nilai jawaban siswa, update mastery model
 * - Jejak (Note)          — ekstrak & ringkas konten jadi catatan
 * - Palet (Draw)          — susun prompt gambar (image-gen tetap via lib/image-gen.ts)
 * - Kilau (Proactive)     — job background: streak, idle, pola bingung
 *
 * SEMUA pemanggilan model dari agent melewati callAgentModel() yang
 * men-resolve config dari katalog ini — jangan hardcode model di agent.
 * Model per agent bisa dioverride via env AGENT_<NAMA>_MODEL.
 *
 * Model kondisional Socra (Astra, untuk Solve-then-Guide) juga configurable:
 * lihat AGENT_ASTRA_MODEL — di-resolve saat runtime, bukan digabung di sini,
 * agar katalog tetap valid bila model belum tersedia di provider.
 */

export type AgentId =
  | "kompas"
  | "socra"
  | "lensa"
  | "jejak"
  | "palet"
  | "kilau";

/** Kecepatan dasar yang dipakai agent untuk memilih rantai model (lib/ai.ts). */
export type AgentSpeedTier = "fast" | "normal" | "deep";

export interface AgentConfig {
  /** Nama persona yang tampil di log/UI. */
  name: string;
  /** Peran singkat (documentasi). */
  role: string;
  /** Tier kecepatan default → menentukan rantai fallback model di lib/ai.ts. */
  tier: AgentSpeedTier;
  /** Model spesifik yang dicoba PERTAMA (di depan rantai tier). Nullable = ikut tier. */
  model: string | null;
  /** Override model via env, mis. AGENT_SOCRA_MODEL. */
  envModelKey: string;
  /** Batas pemanggilan per user per jendela (rate limit per agent). */
  rateLimit: { max: number; windowMs: number };
  /** Batas token output per pemanggilan. */
  maxTokens: number;
  /** Suhu default (persona tutor lebih hangat, assessor lebih deterministik). */
  temperature: number;
}

const HOUR_MS = 60 * 60 * 1000;

function envModel(key: string): string | null {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : null;
}

export const AGENT_CATALOG: Record<AgentId, AgentConfig> = {
  kompas: {
    name: "Kompas",
    role: "Orchestrator — baca intent, arahkan ke agent tepat, pegang state loop",
    tier: "fast",
    model: envModel("AGENT_KOMPAS_MODEL") ?? "glm-5.3-flash",
    envModelKey: "AGENT_KOMPAS_MODEL",
    rateLimit: { max: 120, windowMs: HOUR_MS },
    maxTokens: 512,
    temperature: 0.3,
  },
  socra: {
    name: "Socra",
    role: "Tutor — inti Socratic tutoring, ajukan pertanyaan pemandu",
    tier: "deep",
    model: envModel("AGENT_SOCRA_MODEL") ?? "claude-opus-5",
    envModelKey: "AGENT_SOCRA_MODEL",
    rateLimit: { max: 60, windowMs: HOUR_MS },
    maxTokens: 2048,
    temperature: 0.7,
  },
  lensa: {
    name: "Lensa",
    role: "Assessment — nilai jawaban siswa, update mastery model",
    tier: "normal",
    model: envModel("AGENT_LENSA_MODEL") ?? null,
    envModelKey: "AGENT_LENSA_MODEL",
    rateLimit: { max: 90, windowMs: HOUR_MS },
    maxTokens: 512,
    temperature: 0.2,
  },
  jejak: {
    name: "Jejak",
    role: "Note/Summarizer — ekstrak & ringkas konten jadi catatan",
    tier: "normal",
    model: envModel("AGENT_JEJAK_MODEL") ?? null,
    envModelKey: "AGENT_JEJAK_MODEL",
    rateLimit: { max: 60, windowMs: HOUR_MS },
    maxTokens: 3072,
    temperature: 0.5,
  },
  palet: {
    name: "Palet",
    role: "Draw — susun prompt gambar; output akhir via model image-gen terpisah",
    tier: "normal",
    model: envModel("AGENT_PALET_MODEL") ?? null,
    envModelKey: "AGENT_PALET_MODEL",
    rateLimit: { max: 30, windowMs: HOUR_MS },
    maxTokens: 512,
    temperature: 0.8,
  },
  kilau: {
    name: "Kilau",
    role: "Proactive — job background: streak, idle, pola bingung → inisiatif",
    tier: "fast",
    model: envModel("AGENT_KILAU_MODEL") ?? "glm-5.3-flash",
    envModelKey: "AGENT_KILAU_MODEL",
    rateLimit: { max: 200, windowMs: HOUR_MS },
    maxTokens: 256,
    temperature: 0.6,
  },
};

/** Agent id valid dari string eksternal (query param, payload). */
export function isAgentId(v: string): v is AgentId {
  return v in AGENT_CATALOG;
}

/** Model efektif agent: env > katalog. Dipanggil saat runtime, bukan saat import. */
export function resolveAgentModel(id: AgentId): string | null {
  const cfg = AGENT_CATALOG[id];
  return envModel(cfg.envModelKey) ?? cfg.model;
}

// ─── Model kondisional Astra (Solve-then-Guide) ─────────────────────────────

/** Id model Astra — configurable, TIDAK default ON (cek AGENT_ASTRA_MODEL). */
export function resolveAstraModel(): string | null {
  return envModel("AGENT_ASTRA_MODEL");
}
