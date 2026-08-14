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
import { apiUrl } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/supabase/client";
import type {
  AssistantSource,
  ChatAttachment,
  ChatToolOptions,
  WebSearchItem,
  WebSearchStage,
} from "@/lib/assistant/types";

export type AssistantStreamEvent =
  | { type: "meta"; mode?: string; model?: string }
  | { type: "token"; text: string }
  | { type: "sources"; sources: AssistantSource[] }
  | { type: "pipeline"; stage: WebSearchStage }
  | { type: "web"; results: WebSearchItem[] }
  | { type: "done" }
  | { type: "error"; message: string; upgradeUrl?: string };

export interface AssistantChatInput extends ChatToolOptions {
  sessionId: string;
  userId: string;
  question: string;
  mentions?: string[];
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
          onEvent(JSON.parse(payload) as AssistantStreamEvent);
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