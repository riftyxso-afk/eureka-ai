import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import {
  generateHighlightsForChapters,
  type AiHighlightEvent,
} from "@/lib/ai-highlights";
import { getNoteWithChunks } from "@/lib/rag/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

function sse(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Generate (atau regenerasi) stabilo AI untuk sebuah catatan.
 *
 * SSE stream — klien menerima event realtime:
 *   - { type: "status", message }        → progres (menganalisis / per bab)
 *   - { type: "highlight", chapterId, text, color } → satu stabilo tersimpan
 *   - { type: "done", count }            → selesai
 *   - { type: "error", error }           → gagal
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: unknown) => {
        try {
          controller.enqueue(sse(ev));
        } catch {
          // klien menutup koneksi — hentikan
        }
      };

      try {
        const auth = await requireAuth(req.headers.get("authorization"));
        if ("error" in auth) {
          send({ type: "error", error: auth.error });
          controller.close();
          return;
        }
        const { id } = await params;
        const data = await getNoteWithChunks(id);
        if (!data) {
          send({ type: "error", error: "Catatan tidak ditemukan." });
          controller.close();
          return;
        }
        if (data.note.user_id !== auth.userId) {
          send({
            type: "error",
            error: "Akses ditolak. Kamu bukan pemilik catatan ini.",
          });
          controller.close();
          return;
        }
        const chapters = data.note.chapters ?? [];
        if (chapters.length === 0) {
          send({ type: "error", error: "Catatan belum memiliki bab." });
          controller.close();
          return;
        }
        const count = await generateHighlightsForChapters(
          id,
          chapters,
          (ev: AiHighlightEvent) => send(ev)
        );
        send({ type: "done", count });
      } catch (e) {
        const msg = "Gagal membuat stabilo AI.";
        console.error("[api/notes/[id]/highlights/generate]", e);
        send({ type: "error", error: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
