/**
 * Klien SSE untuk pembuatan soal Uji Pemahaman (POST /api/notes/[id]/comprehension/stream).
 *
 * Pola sama seperti lib/assistant-stream.ts: fetch + ReadableStream reader,
 * lalu parse per baris "data: {...}".
 *
 * Events dari server:
 *   { type: "token", text }                 → teks AI yang sedang ditulis
 *   { type: "done", questions: [...] }      → soal selesai & ter-parse
 *   { type: "error", message, upgradeUrl? } → kegagalan
 */
import { apiUrl } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/supabase/client";
import type { ComprehensionQuestion } from "@/lib/studyTools";

export type ComprehensionStreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; questions: ComprehensionQuestion[] }
  | { type: "error"; message: string; upgradeUrl?: string };

export interface ComprehensionStreamInput {
  noteId: string;
  userId: string;
  count: number;
  difficulty: "mudah" | "sedang" | "sulit";
  types: ("abc" | "essay")[];
}

/**
 * Kirim permintaan generate soal & stream respons AI.
 * Mengembalikan { abort } untuk menghentikan aliran (tombol batal).
 */
export async function streamComprehension(
  input: ComprehensionStreamInput,
  onEvent: (event: ComprehensionStreamEvent) => void
): Promise<{ abort: () => void; completed: Promise<void> }> {
  const controller = new AbortController();

  const completed = (async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(apiUrl(`/api/notes/${input.noteId}/comprehension/stream`), {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId: input.userId,
        count: input.count,
        difficulty: input.difficulty,
        types: input.types,
      }),
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
          onEvent(JSON.parse(payload) as ComprehensionStreamEvent);
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
