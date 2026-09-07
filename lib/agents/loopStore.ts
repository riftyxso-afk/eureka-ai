/**
 * State machine loop "Eureka Multi Agent" — persisten di Supabase.
 *
 * Tabel: agent_loop_sessions + agent_loop_iterations
 * (supabase_patch_021_agent_system.sql).
 *
 * Siklus per turn (PRD §5.2):
 *   gather_context → act (Socra) → [tunggu jawaban siswa] →
 *   observe → reflect (Lensa) → decide (Kompas)
 *
 * Server stateless per request: setiap turn membaca fase dari DB, bekerja,
 * lalu menyimpan fase berikutnya — tahan refresh/reconnect.
 */
import { db } from "../supabase/admin";
import { ensureRateLimitPrune, checkRateLimit } from "../rateLimit";

// ─── Tipe ───────────────────────────────────────────────────────────────────

export type LoopPhase =
  | "gather_context"
  | "act"
  | "observe"
  | "reflect"
  | "decide"
  | "selesai";

export type LoopStatus =
  | "active"
  | "stopped"
  | "goal_reached"
  | "max_iterations"
  | "user_stopped"
  | "manual_exit";

export type LoopDecision =
  | "continue_loop"
  | "goal_reached"
  | "max_iterations"
  | "user_stopped"
  | "manual_exit";

export interface AgentLoopSession {
  id: string;
  userId: string;
  chatSessionId: string | null;
  topic: string;
  phase: LoopPhase;
  iteration: number;
  maxIterations: number;
  goal: string | null;
  mastery: number;
  status: LoopStatus;
  toggleOn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLoopIteration {
  id: string;
  sessionId: string;
  iteration: number;
  goal: string | null;
  question: string | null;
  answer: string | null;
  score: number | null;
  verdict: "salah" | "sebagian" | "benar" | null;
  masteryAfter: number | null;
  decision: LoopDecision | null;
  createdAt: string;
}

// ─── Config (env, bukan hardcode) ───────────────────────────────────────────

/** Max iterasi default per topik (PRD §5.3: 6–8). */
export function loopMaxIterations(): number {
  const v = Number(process.env.AGENT_LOOP_MAX_ITERATIONS);
  return Number.isFinite(v) && v >= 1 && v <= 20 ? Math.round(v) : 6;
}

/**
 * Ambang skor goal — mastery di atas nilai ini (atau verdict "benar"
 * berturut-turut) dianggap goal tercapai.
 */
export function loopGoalMastery(): number {
  const v = Number(process.env.AGENT_LOOP_GOAL_MASTERY);
  return Number.isFinite(v) && v >= 50 && v <= 100 ? Math.round(v) : 80;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

function mapSession(row: Record<string, unknown>): AgentLoopSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    chatSessionId: (row.chat_session_id as string | null) ?? null,
    topic: (row.topic as string) ?? "umum",
    phase: (row.phase as LoopPhase) ?? "gather_context",
    iteration: (row.iteration as number) ?? 0,
    maxIterations: (row.max_iterations as number) ?? loopMaxIterations(),
    goal: (row.goal as string | null) ?? null,
    mastery: (row.mastery as number) ?? 50,
    status: (row.status as LoopStatus) ?? "active",
    toggleOn: row.toggle_on !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Sesi loop aktif milik user untuk satu sesi chat (atau null). */
export async function getActiveLoopSession(
  userId: string,
  chatSessionId: string
): Promise<AgentLoopSession | null> {
  const { data, error } = await db()
    .from("agent_loop_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("chat_session_id", chatSessionId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

/** Buat sesi loop baru (dipanggil saat toggle ON dan belum ada sesi aktif). */
export async function createLoopSession(input: {
  userId: string;
  chatSessionId: string;
  topic?: string;
  goal?: string;
}): Promise<AgentLoopSession> {
  const { data, error } = await db()
    .from("agent_loop_sessions")
    .insert({
      user_id: input.userId,
      chat_session_id: input.chatSessionId,
      topic: input.topic ?? "umum",
      goal: input.goal ?? null,
      max_iterations: loopMaxIterations(),
      phase: "act",
      status: "active",
      toggle_on: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSession(data);
}

/** Update field sesi loop (fase, iterasi, mastery, status, dst.). */
export async function updateLoopSession(
  id: string,
  patch: Partial<{
    phase: LoopPhase;
    iteration: number;
    mastery: number;
    status: LoopStatus;
    toggleOn: boolean;
    goal: string;
    topic: string;
  }>
): Promise<AgentLoopSession | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.phase !== undefined) row.phase = patch.phase;
  if (patch.iteration !== undefined) row.iteration = patch.iteration;
  if (patch.mastery !== undefined) row.mastery = patch.mastery;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.toggleOn !== undefined) row.toggle_on = patch.toggleOn;
  if (patch.goal !== undefined) row.goal = patch.goal;
  if (patch.topic !== undefined) row.topic = patch.topic;
  const { data, error } = await db()
    .from("agent_loop_sessions")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

/** Matikan loop: toggle OFF → stop instan (dicek di awal tiap turn). */
export async function stopLoopSession(
  id: string,
  reason: Extract<LoopStatus, "user_stopped" | "manual_exit" | "stopped">
): Promise<void> {
  await updateLoopSession(id, { status: reason, phase: "selesai", toggleOn: false });
}

// ─── Iterasi ────────────────────────────────────────────────────────────────

function mapIteration(row: Record<string, unknown>): AgentLoopIteration {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    iteration: row.iteration as number,
    goal: (row.goal as string | null) ?? null,
    question: (row.question as string | null) ?? null,
    answer: (row.answer as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    verdict:
      (row.verdict as AgentLoopIteration["verdict"] | null) ?? null,
    masteryAfter: (row.mastery_after as number | null) ?? null,
    decision: (row.decision as AgentLoopIteration["decision"] | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Catat iterasi baru (saat Socra mengajukan pertanyaan). Return id-nya. */
export async function startIteration(input: {
  sessionId: string;
  iteration: number;
  goal: string | null;
  question: string;
}): Promise<string> {
  const { data, error } = await db()
    .from("agent_loop_iterations")
    .insert({
      session_id: input.sessionId,
      iteration: input.iteration,
      goal: input.goal,
      question: input.question,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Lengkapi iterasi (jawaban, skor, keputusan) setelah reflect & decide. */
export async function completeIteration(
  id: string,
  patch: {
    answer?: string;
    score?: number;
    verdict?: "salah" | "sebagian" | "benar";
    masteryAfter?: number;
    decision?: LoopDecision;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.answer !== undefined) row.answer = patch.answer;
  if (patch.score !== undefined) row.score = patch.score;
  if (patch.verdict !== undefined) row.verdict = patch.verdict;
  if (patch.masteryAfter !== undefined) row.mastery_after = patch.masteryAfter;
  if (patch.decision !== undefined) row.decision = patch.decision;
  const { error } = await db()
    .from("agent_loop_iterations")
    .update(row)
    .eq("id", id);
  if (error) throw error;
}

/** Iterasi terakhir yang belum berisi jawaban (fase observe). */
export async function getOpenIteration(
  sessionId: string
): Promise<AgentLoopIteration | null> {
  const { data, error } = await db()
    .from("agent_loop_iterations")
    .select("*")
    .eq("session_id", sessionId)
    .is("answer", null)
    .order("iteration", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapIteration(data) : null;
}

/** Perbarui teks pertanyaan iterasi (setelah streaming Socra selesai). */
export async function updateIterationQuestion(
  id: string,
  question: string
): Promise<void> {
  const { error } = await db()
    .from("agent_loop_iterations")
    .update({ question })
    .eq("id", id);
  if (error) throw error;
}

// ─── Cap biaya harian (bucket terpisah loop vs Astra) ───────────────────────

export type CostBucket = "loop" | "astra";

function dailyCapTokens(bucket: CostBucket): number {
  const raw =
    bucket === "loop"
      ? process.env.AGENT_LOOP_DAILY_TOKEN_CAP
      : process.env.AGENT_ASTRA_DAILY_TOKEN_CAP;
  const v = Number(raw);
  // Default: 500 ribu token loop, 100 ribu Astra (configurable).
  return Number.isFinite(v) && v > 0 ? v : bucket === "loop" ? 500 : 100;
}

export class DailyCostCapError extends Error {
  readonly bucket: CostBucket;
  constructor(bucket: CostBucket) {
    super(
      bucket === "astra"
        ? "Kuota harian Solve-then-Guide-mu sudah habis. Ayo lanjutkan besok — jawaban yang sudah didapat tetap bisa dibahas."
        : "Kuota harian mode Eureka Multi Agent-mu sudah habis. Istirahat sebentar, besok kita lanjutkan belajarnya ya!"
    );
    this.name = "DailyCostCapError";
    this.bucket = bucket;
  }
}

/**
 * Cek + catat pemakaian token harian per bucket. Melempar DailyCostCapError
 * bila cap terlampaui SEBELUM pemanggilan; catat estimasi token SETELAH.
 * Pengukuran dari agent_call_logs (agent, tokens_in/out, created_at ≥ 00:00
 * hari ini, user terkait) — reset otomatis saat tanggal berganti.
 */
export async function checkDailyCostCap(
  bucket: CostBucket,
  userId: string,
  estimatedTokens: number
): Promise<void> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from("agent_call_logs")
    .select("tokens_in, tokens_out")
    .eq("user_id", userId)
    .eq("source", bucket === "astra" ? "astra" : "loop")
    .gte("created_at", since.toISOString());
  if (error) {
    // DB gangguan → jangan blokir (fail-open untuk usability).
    console.warn("[loopStore] cek cap biaya dilewati:", error.message);
    return;
  }
  const used = (data ?? []).reduce(
    (acc, r) =>
      acc + Number((r.tokens_in as number | null) ?? 0) +
      Number((r.tokens_out as number | null) ?? 0),
    0
  );
  if (used + estimatedTokens > dailyCapTokens(bucket) * 1000) {
    throw new DailyCostCapError(bucket);
  }
}

/** Catat pemakaian token ke bucket (dipanggil setelah respons model). */
export async function recordTokenUsage(
  bucket: CostBucket,
  userId: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  try {
    await db().from("agent_call_logs").insert({
      agent_id: bucket === "astra" ? "socra" : "kompas",
      model: bucket === "astra" ? "astra" : "loop-aggregate",
      duration_ms: 0,
      source: bucket === "astra" ? "astra" : "loop",
      user_id: userId,
      ok: true,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    });
  } catch (e) {
    console.warn("[loopStore] catat token gagal:", e);
  }
}

/** Rate limit turn loop (selain rate limit per agent di callAgentModel). */
export function checkLoopTurnRate(userId: string): { ok: boolean; retryAfterMs: number } {
  ensureRateLimitPrune();
  return checkRateLimit(`loop-turn:${userId}`, 40, 60 * 60 * 1000);
}
