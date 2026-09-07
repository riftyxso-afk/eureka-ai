/**
 * Logging pemanggilan agent — observability biaya & latency per peran.
 *
 * Tabel: agent_call_logs (supabase_patch_021_agent_system.sql).
 * Gagal menulis log TIDAK boleh menggagalkan pemanggilan agent — log
 * dicatat best-effort (void + console.warn).
 */
import { db } from "../supabase/admin";
import type { AgentId } from "./catalog";

export interface AgentCallLogInput {
  model: string;
  durationMs: number;
  source?: string;
  userId: string | null;
  loopSessionId: string | null;
  iteration: number | null;
  ok: boolean;
  error?: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

export async function logAgentCall(
  agentId: AgentId,
  input: AgentCallLogInput
): Promise<void> {
  try {
    await db().from("agent_call_logs").insert({
      agent_id: agentId,
      model: input.model,
      duration_ms: input.durationMs,
      source: input.source ?? null,
      user_id: input.userId,
      loop_session_id: input.loopSessionId,
      iteration: input.iteration,
      ok: input.ok,
      error: input.error ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
    });
  } catch (e) {
    // Dev tanpa DB / Supabase gangguan — jangan jatuhkan chat.
    console.warn("[agentLog] gagal mencatat panggilan agent:", e);
  }
}
