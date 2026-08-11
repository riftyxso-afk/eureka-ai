/**
 * SSE endpoint untuk progress realtime pembuatan catatan.
 * Klien membuka GET /api/notes/process-progress/<sessionId> lalu menerima
 * event `data: {phase, percent, message, timestamp}` setiap ada kemajuan.
 * Stream ditutup otomatis saat percent mencapai 100.
 */
import { NextRequest } from "next/server";
import { getProgressEvents, closeSession } from "@/lib/progressTracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 400;
const MAX_STREAM_MS = 9 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const encoder = new TextEncoder();

  let cursor = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        if (closed) return;
        const events = getProgressEvents(sessionId);
        for (; cursor < events.length; cursor++) {
          const event = events[cursor];
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            closed = true;
            if (timer) clearInterval(timer);
            closeSession(sessionId);
            return;
          }
          if (event.percent >= 100) {
            closed = true;
            if (timer) clearInterval(timer);
            try {
              controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
              controller.close();
            } catch {
              // sudah tertutup — abaikan
            }
            closeSession(sessionId);
            return;
          }
        }
      };

      // Kirim event yang sudah ada, lalu poll setiap 400 ms
      send();
      timer = setInterval(send, POLL_INTERVAL_MS);
      if (typeof (timer as NodeJS.Timeout).unref === "function") {
        (timer as NodeJS.Timeout).unref();
      }

      // Pengaman: tutup stream bila terlalu lama (maks 9 menit)
      const safety = setTimeout(() => {
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
          controller.close();
        } catch {
          // abaikan
        }
        closeSession(sessionId);
      }, MAX_STREAM_MS);
      if (typeof (safety as NodeJS.Timeout).unref === "function") {
        (safety as NodeJS.Timeout).unref();
      }
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
      closeSession(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
