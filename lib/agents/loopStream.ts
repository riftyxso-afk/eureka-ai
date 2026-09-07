/**
 * Klien SSE untuk Mode "Eureka Multi Agent" (POST /api/agents/loop).
 *
 * Pola sama dengan assistant-stream.ts: fetch + ReadableStream reader,
 * parse baris "data: {...}". Events:
 *   { type: "loop_state", iteration, maxIterations, phase, status, decision?, mastery? }
 *   { type: "step", label, status }        ← step-log Solve-then-Guide (asli)
 *   { type: "terminal_output", line }      ← stdout/stderr asli sandbox
 *   { type: "token" | "thinking" | "meta" | "error" | "done" }
 */
import { apiUrl } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/supabase/client";

export type LoopPhase = "act" | "observe" | "reflect" | "decide" | "selesai";
export type LoopDecision =
  | "continue_loop"
  | "goal_reached"
  | "max_iterations"
  | "user_stopped"
  | "manual_exit";

/** Satu baris step-log Solve-then-Guide (PRD §8.4) — dari backend, bukan animasi. */
export interface StepLogEntry {
  label: string;
  status: "running" | "done" | "failed";
}

export interface LoopStreamEvent {
  type:
    | "token"
    | "thinking"
    | "meta"
    | "loop_state"
    | "step"
    | "terminal_output"
    | "done"
    | "error";
  text?: string;
  message?: string;
  model?: string;
  mode?: string;
  iteration?: number;
  maxIterations?: number;
  phase?: LoopPhase;
  status?: string;
  decision?: LoopDecision;
  mastery?: number;
  upgradeUrl?: string;
  /** event step */
  label?: string;
  /** event terminal_output */
  line?: string;
}

export interface LoopChatInput {
  sessionId: string;
  userId: string;
  message: string;
  /** State toggle di composer — false = minta stop instan. */
  toggleOn: boolean;
  history?: { role: "user" | "assistant"; content: string }[];
  topic?: string;
  /** Trigger manual Solve-then-Guide (user Pro). */
  solveThenGuide?: boolean;
}

export async function streamAgentLoop(
  input: LoopChatInput,
  onEvent: (event: LoopStreamEvent) => void
): Promise<{ abort: () => void; completed: Promise<void> }> {
  const controller = new AbortController();

  const completed = (async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(apiUrl("/api/agents/loop"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId: input.sessionId,
        userId: input.userId,
        message: input.message,
        toggleOn: input.toggleOn,
        history: input.history ?? [],
        topic: input.topic ?? null,
        solveThenGuide: input.solveThenGuide === true,
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      let message = `Server error ${res.status}`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // body bukan JSON
      }
      onEvent({ type: "error", message });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload) as LoopStreamEvent);
        } catch {
          // data malformed — abaikan
        }
      }
    }
  })();

  return {
    abort: () => controller.abort(),
    completed,
  };
}
