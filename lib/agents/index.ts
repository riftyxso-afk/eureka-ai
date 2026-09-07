/**
 * Enam agent Eureka Multi Agent — satu file per persona digabung di sini
 * sebagai modul tipis: tiap agent hanya memanggil callAgentModel dengan
 * agentId-nya + prompt persona dari lib/prompts/agents.ts. Logika bisnis
 * (loop, solve-then-guide) ada di modul masing-masing, bukan di sini.
 *
 * Isolasi kegagalan (PRD §4): pemanggil bungkus try/catch sendiri; helper
 * denganFallback di bawah menyediakan pola fallback Kompas yang wajar.
 */
import { callAgentModel, callAgentModelStream } from "./callAgentModel";
import type { AgentModelContext, AgentModelOverrides } from "./callAgentModel";
import {
  KOMPAS_SYSTEM,
  LENSA_SYSTEM,
  PALET_SYSTEM,
  SOCRA_SYSTEM,
  JEJAK_SYSTEM,
  KILAU_SYSTEM,
  socraSystemWithSolution,
} from "../prompts/agents";

export type { AgentModelContext, AgentModelOverrides } from "./callAgentModel";
export { AgentRateLimitError } from "./callAgentModel";
export type { AgentId } from "./catalog";

// ─── Kompas (Orchestrator) ──────────────────────────────────────────────────

export interface KompasIntent {
  intent: "tutoring" | "note" | "draw" | "chat";
  topic: string;
  difficulty: "mudah" | "sedang" | "sulit";
  reason: string;
}

/** Klasifikasi intent siswa → menentukan agent tujuan. */
export async function kompasClassify(
  message: string,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<KompasIntent> {
  // Isolasi kegagalan: provider mati / JSON rusak → default aman "chat",
  // KOMPAS tidak pernah menjatuhkan turn karena klasifikasi.
  const neutral: KompasIntent = {
    intent: "chat",
    topic: "umum",
    difficulty: "sedang",
    reason: "",
  };
  let res;
  try {
    res = await callAgentModel(
      "kompas",
      { system: KOMPAS_SYSTEM, user: message, json: true },
      ctx,
      overrides
    );
  } catch (e) {
    console.warn("[kompas] klasifikasi gagal, fallback chat:", e);
    return neutral;
  }
  try {
    const raw = res.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<KompasIntent>;
    const intents: KompasIntent["intent"][] = ["tutoring", "note", "draw", "chat"];
    const difficulties: KompasIntent["difficulty"][] = ["mudah", "sedang", "sulit"];
    return {
      intent: intents.includes(parsed.intent as KompasIntent["intent"])
        ? (parsed.intent as KompasIntent["intent"])
        : "chat",
      topic: typeof parsed.topic === "string" && parsed.topic ? parsed.topic : "umum",
      difficulty: difficulties.includes(parsed.difficulty as KompasIntent["difficulty"])
        ? (parsed.difficulty as KompasIntent["difficulty"])
        : "sedang",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return { intent: "chat", topic: "umum", difficulty: "sedang", reason: "" };
  }
}

// ─── Socra (Tutor) ──────────────────────────────────────────────────────────

export interface SocraPrompt {
  system?: string;
  user: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

/** Panggilan streaming Socra. Events diteruskan ke onEvent. */
export function socraStream(
  prompt: SocraPrompt,
  onEvent: Parameters<typeof callAgentModelStream>[2],
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
) {
  return callAgentModelStream(
    "socra",
    { system: prompt.system ?? SOCRA_SYSTEM, user: prompt.user, history: prompt.history },
    onEvent,
    ctx,
    overrides
  );
}

/** Varian Socra dengan solusi terverifikasi (Solve-then-Guide) tersedia. */
export function socraStreamWithSolution(
  solution: string,
  prompt: SocraPrompt,
  onEvent: Parameters<typeof callAgentModelStream>[2],
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
) {
  return callAgentModelStream(
    "socra",
    {
      system: socraSystemWithSolution(solution),
      user: prompt.user,
      history: prompt.history,
    },
    onEvent,
    ctx,
    overrides
  );
}

// ─── Lensa (Assessment) ─────────────────────────────────────────────────────

export interface LensaVerdict {
  score: number;
  verdict: "salah" | "sebagian" | "benar";
  masteryDelta: number;
  feedback: string;
  misconception: string | null;
}

export interface LensaInput {
  topic: string;
  tutorQuestion: string;
  studentAnswer: string;
  previousMastery: number;
}

/** Nilai jawaban siswa → JSON terstruktur untuk mesin (bukan untuk siswa). */
export async function lensaAssess(
  input: LensaInput,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<LensaVerdict> {
  const neutral: LensaVerdict = {
    score: 50,
    verdict: "sebagian",
    masteryDelta: 0,
    feedback: "Penilaian tidak tersedia — anggap netral.",
    misconception: null,
  };
  try {
    const res = await callAgentModel(
      "lensa",
      {
        system: LENSA_SYSTEM,
        user: `Topik: ${input.topic}
Mastery sebelumnya: ${input.previousMastery}/100
Pertanyaan tutor: ${input.tutorQuestion}
Jawaban siswa: ${input.studentAnswer}`,
        json: true,
      },
      ctx,
      overrides
    );
    const raw = res.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return neutral;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<LensaVerdict>;
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Math.round(v)));
    const verdicts: LensaVerdict["verdict"][] = ["salah", "sebagian", "benar"];
    return {
      score: clamp(Number(parsed.score) || 0, 0, 100),
      verdict: verdicts.includes(parsed.verdict as LensaVerdict["verdict"])
        ? (parsed.verdict as LensaVerdict["verdict"])
        : "sebagian",
      masteryDelta: clamp(Number(parsed.masteryDelta) || 0, -10, 10),
      feedback:
        typeof parsed.feedback === "string" && parsed.feedback
          ? parsed.feedback
          : neutral.feedback,
      misconception:
        typeof parsed.misconception === "string" && parsed.misconception
          ? parsed.misconception
          : null,
    };
  } catch (e) {
    // Isolasi kegagalan: Lensa gagal → skor netral, loop tetap jalan.
    console.warn("[lensa] penilaian gagal, pakai netral:", e);
    return neutral;
  }
}

// ─── Jejak (Note/Summarizer) ────────────────────────────────────────────────

/** Ringkas materi/percakapan → markdown catatan (diawali "# judul"). */
export async function jejakSummarize(
  source: string,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<string> {
  const res = await callAgentModel(
    "jejak",
    { system: JEJAK_SYSTEM, user: source },
    ctx,
    overrides
  );
  return res.text;
}

// ─── Palet (Draw) ───────────────────────────────────────────────────────────

/** Susun prompt gambar bahasa Inggris dari permintaan siswa. */
export async function paletPrompt(
  request: string,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<string> {
  const res = await callAgentModel(
    "palet",
    { system: PALET_SYSTEM, user: request },
    ctx,
    overrides
  );
  return res.text;
}

// ─── Kilau (Proactive) ──────────────────────────────────────────────────────

export interface KilauContextInput {
  trigger: "streak_risk" | "idle" | "confusion_pattern";
  detail: string;
}

/** Pesan nyapa proaktif (job background). */
export async function kilauGreet(
  input: KilauContextInput,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<string> {
  const res = await callAgentModel(
    "kilau",
    {
      system: KILAU_SYSTEM,
      user: `Pemicu: ${input.trigger}
Konteks: ${input.detail}`,
    },
    ctx,
    overrides
  );
  return res.text;
}
