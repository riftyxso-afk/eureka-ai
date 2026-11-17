/**
 * Klien SSE untuk chat asisten (POST /api/assistant/chat).
 *
 * Service worker tidak terlibat — stream dibaca lewat fetch biasa dengan
 * ReadableStream reader, lalu di-parse per baris "data: {...}".
 *
 * Events dari server:
 *   { type: "meta", mode, model }
 *   { type: "token", text }
 *   { type: "sources", sources: [{noteId, noteTitle, chapterId, similarity}] }
 *   { type: "pipeline", stage: "searching" | "analyzing" | "writing" }
 *   { type: "web", results: [{url, title, description, domain}] }
 *   { type: "done" }
 *   { type: "error", message, upgradeUrl? }
 */
import { readSseData } from "@/lib/assistant/sse";
import { apiUrl } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/supabase/client";
import type { LoadingStage } from "@/lib/loading-stage";
import type {
  AssistantSource,
  ChatToolOptions,
  WebSearchItem,
  WebSearchStage,
} from "@/lib/assistant/types";

/** Pertanyaan klarifikasi pilihan ganda dari server (prompt ambigu). */
export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
}

export type AssistantStreamEvent =
  | { type: "tool_call"; call: import("@/lib/connectors/events").ConnectorCall }
  | { type: "reset" }
  | { type: "activity"; stage: LoadingStage }
  | { type: "meta"; mode?: string; model?: string; skill?: string }
  | { type: "token"; text: string }
  | { type: "thinking"; text: string }
  | { type: "sources"; sources: AssistantSource[] }
  | { type: "pipeline"; stage: WebSearchStage; query?: string; message?: string }
  | { type: "web"; results: WebSearchItem[] }
  | { type: "clarification"; questions: ClarificationQuestion[] }
  | { type: "done" }
  | { type: "error"; message: string; upgradeUrl?: string };

export interface AssistantChatInput extends ChatToolOptions {
  sessionId: string;
  userId: string;
  question: string;
  mentions?: string[];
  /**
   * Link YouTube pada pesan user — server memakainya sebagai video aktif
   * dan menyuntikkan transkrip sebagai konteks jawaban AI.
   */
  videoUrl?: string | null;
  /** Jawaban klarifikasi dari pengguna — disuntikkan server ke konteks. */
  clarifications?: { id: string; question?: string; answer: string }[];
  /**
   * User memilih "Langsung jawab saja" — server TIDAK menilai ulang
   * prompt untuk klarifikasi (cegah loop klarifikasi berulang).
   */
  clarificationsSkipped?: boolean;
  reasoning?: boolean;
  /**
   * Model spesifik pilihan user (Model Store) — server memvalidasi terhadap
   * katalog; id asing diabaikan (mode tier normal).
   */
  model?: string;
}

/**
 * Persiapkan payload body untuk POST /api/assistant/chat.
 * Dipisahkan agar hook & auto-send memakai format yang sama.
 */
export function buildAssistantChatBody(
  input: AssistantChatInput
): Record<string, unknown> {
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    question: input.question,
    mentions: input.mentions ?? [],
    webSearch: input.webSearch === true,
    attachment: input.attachment ?? null,
    speedMode: input.speedMode ?? "normal",
    videoUrl: input.videoUrl ?? null,
    clarifications: input.clarifications ?? [],
    clarificationsSkipped: input.clarificationsSkipped === true,
    reasoning: input.reasoning ?? true,
    model: input.model ?? null,
  };
}

/**
 * Kirim pertanyaan ke asisten & stream jawaban.
 * Mengembalikan { abort } untuk menghentikan aliran (tombol Stop).
 */
export async function streamAssistantChat(
  input: AssistantChatInput,
  onEvent: (event: AssistantStreamEvent) => void
): Promise<{ abort: () => void; completed: Promise<void> }> {
  const controller = new AbortController();

  const completed = (async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(apiUrl("/api/assistant/chat"), {
      method: "POST",
      headers,
      body: JSON.stringify(buildAssistantChatBody(input)),
      signal: controller.signal,
    });

    // Prompt ambigu → server membalas JSON { clarification } (bukan SSE).
    // Pesan user TIDAK disimpan; klien menampilkan kartu pertanyaan.
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") && res.ok) {
      const data = (await res.json().catch(() => null)) as {
        clarification?: ClarificationQuestion[];
      } | null;
      if (data?.clarification && Array.isArray(data.clarification)) {
        onEvent({ type: "clarification", questions: data.clarification });
        return;
      }
    }

    if (!res.ok || !res.body) {
      let message = `Server error ${res.status}`;
      let upgradeUrl: string | undefined;
      try {
        const data = (await res.json()) as { error?: string; upgradeUrl?: string };
        if (data.error) message = data.error;
        if (data.upgradeUrl) upgradeUrl = data.upgradeUrl;
      } catch {
        // body bukan JSON — biarkan pesan default
      }
      onEvent({ type: "error", message, ...(upgradeUrl ? { upgradeUrl } : {}) });
      return;
    }

    if (!contentType.includes("text/event-stream")) {
      onEvent({ type: "error", message: "Server belum mengirim aliran jawaban. Silakan coba lagi." });
      return;
    }

    for await (const payload of readSseData(res.body)) {
      if (!payload || payload === "[DONE]") continue;
      let parsed: unknown;
      try { parsed = JSON.parse(payload); } catch { continue; }
      if (!parsed || typeof parsed !== "object" || !("type" in parsed)) continue;
      const ev = parsed as AssistantStreamEvent;
      onEvent(ev);
      if (ev.type === "done") {
        void import("@/lib/sound/cuelume").then(({ playCompletionSound }) => playCompletionSound()).catch(() => {});
        return;
      }
      if (ev.type === "error") return;
    }
    if (!controller.signal.aborted) {
      onEvent({ type: "error", message: "Koneksi terputus sebelum jawaban selesai. Coba lagi ya." });
    }
  })();

  return {
    abort: () => controller.abort(),
    completed,
  };
}
