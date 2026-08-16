import { NextRequest } from "next/server";
import { TextEncoder } from "util";

import { getNoteWithChunks } from "@/lib/rag/store";
import { requireAuth } from "@/lib/assistant/auth";
import { aiChatStream, extractJsonObject, hasAiKey } from "@/lib/ai";
import {
  buildComprehensionPrompt,
  buildContext,
  normalizeComprehensionQuestions,
  type ComprehensionConfig,
} from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DIFFICULTIES = ["mudah", "sedang", "sulit"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      const fail = (message: string, upgradeUrl?: string) => {
        emit({ type: "error", message, ...(upgradeUrl ? { upgradeUrl } : {}) });
        controller.close();
      };

      try {
        const { id } = await params;

        // ── Auth & otorisasi ──
        const body = (await req.json().catch(() => null)) as {
          count?: unknown;
          difficulty?: unknown;
          types?: unknown;
          userId?: unknown;
        } | null;
        const userId = String(body?.userId ?? "").trim().slice(0, 80);
        const auth = await requireAuth(
          req.headers.get("authorization"),
          userId
        );
        if ("error" in auth) {
          fail(auth.error ?? "Autentikasi diperlukan.");
          return;
        }

        // ── Validasi konfigurasi ──
        const count = Math.min(Math.max(Number(body?.count) || 5, 3), 15);
        const difficulty = DIFFICULTIES.includes(body?.difficulty as never)
          ? (body!.difficulty as ComprehensionConfig["difficulty"])
          : "sedang";
        const rawTypes = Array.isArray(body?.types) ? body!.types : ["abc", "essay"];
        const types = rawTypes.filter((t) => t === "abc" || t === "essay");
        if (types.length === 0) {
          fail("Pilih minimal satu tipe soal (pilihan ganda atau essay).");
          return;
        }

        // ── Catatan & bab ──
        const found = await getNoteWithChunks(id);
        if (!found) {
          fail("Catatan tidak ditemukan.");
          return;
        }
        if (found.note.user_id !== auth.userId) {
          fail("Akses ditolak. Kamu bukan pemilik catatan ini.");
          return;
        }
        const chapters = found.note.chapters ?? [];
        if (chapters.length === 0) {
          fail(
            "Catatan belum punya materi. Buat catatan ulang agar bisa dibuatkan soal uji pemahaman."
          );
          return;
        }
        if (!hasAiKey()) {
          fail("API key AI belum diatur di .env.local.");
          return;
        }

        // ── Streaming token AI realtime ──
        const context = buildContext(found.note.title, chapters).slice(0, 20000);
        const { system, user } = buildComprehensionPrompt(
          count,
          types as ComprehensionConfig["types"],
          difficulty,
          context
        );

        let raw = "";
        try {
          const result = await aiChatStream(
            {
              system,
              user,
              maxTokens: 10000,
              temperature: 0.4,
            },
            (ev) => {
              if (ev.type === "token") {
                raw += ev.text;
                emit({ type: "token", text: ev.text });
              }
            }
          );
          if (!raw) raw = result.content;
        } catch (e) {
          const msg = "AI gagal menjawab.";
          console.error("[api/notes/[id]/comprehension/stream] AI:", e);
          fail(msg);
          return;
        }

        // ── Parse JSON final → soal terstruktur ──
        try {
          const parsed = extractJsonObject<{ questions?: unknown[] }>(raw);
          const questions = normalizeComprehensionQuestions(parsed, count);
          if (questions.length === 0) {
            fail("AI tidak menghasilkan soal yang valid. Coba lagi.");
          } else {
            emit({ type: "done", questions });
          }
        } catch (e) {
          console.error("[api/notes/[id]/comprehension/stream] Parse:", e);
          fail("Respons AI tidak valid. Coba lagi.");
        }
        controller.close();
      } catch (e) {
        const msg = "Gagal membuat soal uji pemahaman.";
        console.error("[api/notes/[id]/comprehension/stream]", e);
        try {
          emit({ type: "error", message: msg });
          controller.close();
        } catch {
          // stream sudah tertutup — abaikan
        }
      }
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
