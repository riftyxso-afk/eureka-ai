import { NextRequest } from "next/server";

import { aiChatStream, hasAiKey, type AiSpeedMode } from "@/lib/ai";
import { cleanSearchQuery, firecrawlSearch } from "@/lib/firecrawl";
import { checkRateLimit as checkHourlyRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { extractTextFromFile } from "@/lib/rag/extract";
import {
  appendMessage,
  getMessages,
  getSession,
  lastUnansweredUserMessage,
  type AssistantSource,
} from "@/lib/assistant/store";
import {
  buildUserContext,
  getNotesByIds,
  searchUserNotes,
  toAssistantSources,
} from "@/lib/assistant/context";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type AttachedDocument,
  type WebSearchResult,
} from "@/lib/assistant/prompt";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import type { RagHit } from "@/lib/assistant/context";

/** Batas ukuran lampiran (dataUrl base64) — ~3MB file asli. */
const MAX_ATTACHMENT_BASE64 = 4_500_000;
const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp)$/;

/** Parse dataUrl `data:<mime>;base64,<data>` → { mime, base64 }. */
function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2] };
}

/** Ambil nama domain dari URL untuk favicon, mis. https://www.ruangguru.com/x → ruangguru.com. */
function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "").slice(0, 80) || url.slice(0, 80);
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0].slice(0, 80);
  }
}

/**
 * Susun query pencarian web dari pertanyaan + konteks percakapan terakhir.
 *
 * Masalah lama: saat user lagi membahas "dilatasi waktu" lalu bilang "cari
 * rumusnya", query yang dikirim hanya "cari rumusnya" — tanpa konteks topik,
 * Firecrawl malah mencari topik/rumus lain yang tidak relevan.
 *
 * Solusi: gabungkan pertanyaan saat ini dengan pesan user sebelumnya (topik
 * biasanya ada di sana) + baris pertama jawaban AI (sering memuat istilah
 * teknis/rumus yang relevan), lalu bersihkan kata-kata perintah.
 */
function buildWebSearchQuery(
  question: string,
  history: { role: string; content: string }[]
): string {
  // Kumpulkan konteks: maksimal 2 pesan user terakhir (topik terkini) +
  // baris pertama jawaban AI terakhir (istilah teknis yang relevan).
  const userMsgs: string[] = [];
  const aiFirstLines: string[] = [];
  for (const m of history) {
    const text = m.content.trim();
    if (!text) continue;
    if (m.role === "assistant") {
      aiFirstLines.push(text.split(/\r?\n/)[0].slice(0, 160));
    } else {
      userMsgs.push(text.slice(0, 240));
    }
  }
  const parts = [...userMsgs.slice(-2), ...aiFirstLines.slice(-1), question];
  const combined = parts.join(" ").slice(0, 500);
  const clean = cleanSearchQuery(combined);
  // Hasil bersih terlalu pendek/aneh → pakai pertanyaan saja (dibersihkan).
  if (clean.length < 8) return cleanSearchQuery(question);
  return clean;
}

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Rate limit ringan per user: 15 permintaan / menit (in-memory). */
const RATE_LIMITS = new Map<string, number[]>();
function checkRateLimit(userId: string, max = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (RATE_LIMITS.get(userId) ?? []).filter(
    (t) => now - t < windowMs
  );
  if (list.length >= max) {
    RATE_LIMITS.set(userId, list);
    return false;
  }
  list.push(now);
  RATE_LIMITS.set(userId, list);
  return true;
}

function sseEvent(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  payload: unknown
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const respondJson = (body: unknown, status: number = 400) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const raw = (await req.json().catch(() => null)) as {
    sessionId?: unknown;
    userId?: unknown;
    question?: unknown;
    mentions?: unknown;
    webSearch?: unknown;
    attachment?: unknown;
    speedMode?: unknown;
  } | null;

  const rawSessionId = String(raw?.sessionId ?? "").trim();
  const rawUserId = String(raw?.userId ?? "").trim();
  const question = String(raw?.question ?? "").trim().slice(0, 2000);
  const mentions = Array.isArray(raw?.mentions)
    ? [
        ...new Set(
          (raw.mentions as unknown[])
            .map((m) => String(m).trim())
            .filter(Boolean) as string[]
        ),
      ].slice(0, 5)
    : [];
  const webSearch = raw?.webSearch === true;

  // Kecepatan jawaban AI yang dipilih user (fast/normal/deep).
  const speedModeRaw = String(raw?.speedMode ?? "").trim();
  const speedMode: AiSpeedMode = ["fast", "normal", "deep"].includes(speedModeRaw)
    ? (speedModeRaw as AiSpeedMode)
    : "normal";

  // Lampiran (upload gambar/dokumen) — validasi & batasi ukuran.
  const rawAttach = (raw?.attachment ?? null) as
    | { filename?: unknown; mimeType?: unknown; dataUrl?: unknown }
    | null;
  let attachment: {
    filename: string;
    mimeType: string;
    dataUrl: string;
  } | null = null;
  if (rawAttach && typeof rawAttach === "object") {
    const filename = String(rawAttach.filename ?? "").trim().slice(0, 200);
    const mimeType = String(rawAttach.mimeType ?? "").trim().toLowerCase().slice(0, 100);
    const dataUrl = String(rawAttach.dataUrl ?? "");
    if (filename && dataUrl && dataUrl.length <= MAX_ATTACHMENT_BASE64) {
      attachment = { filename, mimeType, dataUrl };
    }
  }

  if (!rawSessionId || !rawUserId || !question) {
    return respondJson(
      { error: "sessionId, userId, dan question diperlukan." },
      400
    );
  }

  // Verifikasi sesi: token Supabase wajib & harus cocok dengan userId param.
  const auth = await authorizeAssistantUser(
    req.headers.get("authorization"),
    rawUserId
  );
  if (!auth.userId) {
    return respondJson({ error: auth.error }, auth.status ?? 401);
  }
  const sessionId = rawSessionId;
  const userId = auth.userId;

  if (!checkRateLimit(userId)) {
    return respondJson(
      { error: "Terlalu banyak permintaan. Tunggu sebentar ya 🙏" },
      429
    );
  }

  // Proteksi token AI: batas per jam (40 pesan/user/jam) — di samping
  // limit per menit di atas.
  ensureRateLimitPrune();
  const hourly = checkHourlyRateLimit(`chat-hour:${userId}`, 40, 60 * 60 * 1000);
  if (!hourly.ok) {
    return respondJson(
      {
        error:
          "Kamu sudah mengirim banyak pesan dalam 1 jam. Tunggu sebentar lalu lanjutkan ya 🙏",
      },
      429
    );
  }

  if (!hasAiKey()) {
    return respondJson(
      { error: "API key AI belum diatur di .env.local." },
      400
    );
  }

  // Bangun aliran SSE
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => sseEvent(encoder, controller, payload);
      let answer = "";
      let modelUsed = "";
      let sources: AssistantSource[] = [];

      try {
        // Sesi harus milik user ini
        const session = await getSession(sessionId, userId);
        if (!session) {
          emit({ type: "error", message: "Sesi tidak ditemukan." });
          controller.close();
          return;
        }

        // Konteks user (profil, progres, subjek, catatan) + riwayat
        const prior = (await getMessages(sessionId, userId))
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content }));

        // Simpan pesan user (idempotent: retry dari pertanyaan yang sama
        // tidak menggandakan pesan; riwayat terakhir yang sama juga dibuang).
        const pending = await lastUnansweredUserMessage(sessionId);
        const isRetry = pending !== null && pending.content === question;
        const history = isRetry && prior.length > 0 ? prior.slice(0, -1) : prior;

        if (!isRetry) {
          await appendMessage({
            sessionId,
            role: "user",
            content: question,
            mentions,
          });
        }

        // 1) Konteks user (profil, progres, subjek, catatan)
        const context = await buildUserContext(userId);

        // 2) Meta catatan yang disebut user
        const mentionedNotesMeta =
          mentions.length > 0 ? await getNotesByIds(userId, mentions) : [];
        const noteTitleById = new Map(
          context.notes.map((n) => [n.id, n.title] as [string, string])
        );

        // 3) RAG: cari materi relevan (di-scope ke mention bila ada)
        let ragHits: RagHit[] = [];
        let ragError = "";
        try {
          ragHits = await searchUserNotes(userId, question, mentions);
        } catch (e) {
          ragError = e instanceof Error ? e.message : "RAG gagal";
          console.warn("[api/assistant/chat] RAG:", ragError);
        }
        sources = toAssistantSources(ragHits);

        // 4a) Tool web search: hasil Firecrawl jadi konteks tambahan.
        //     Hasilnya dikirim juga ke UI (event "web") untuk ditampilkan
        //     dengan logo situs — plus event "pipeline" untuk loading bertahap.
        let webResults: WebSearchResult[] = [];
        if (webSearch) {
          emit({ type: "pipeline", stage: "searching" });
          try {
            const searchQuery = buildWebSearchQuery(question, prior);
            webResults = (await firecrawlSearch(searchQuery, 10)).map((r) => ({
              url: r.url,
              title: r.title,
              description: r.description,
            }));
          } catch (e) {
            console.warn("[api/assistant/chat] Web search:", e);
          }
          // Maks 10 hasil, dengan domain untuk favicon di UI.
          emit({
            type: "web",
            results: webResults.slice(0, 10).map((r) => ({
              url: r.url,
              title: r.title,
              description: r.description,
              domain: extractDomain(r.url),
            })),
          });
        }

        // 4b) Tool lampiran: gambar → vision; dokumen → ekstrak teks.
        let attachedDocument: AttachedDocument | null = null;
        let visionImage: { dataUrl: string; filename: string } | null = null;
        if (attachment) {
          const parsed = parseDataUrl(attachment.dataUrl);
          if (parsed && IMAGE_MIME_RE.test(parsed.mime)) {
            // Gambar → kirim langsung sebagai image_url (model vision).
            visionImage = {
              dataUrl: attachment.dataUrl,
              filename: attachment.filename,
            };
          } else if (parsed) {
            // Dokumen → ekstrak teksnya untuk jadi konteks.
            try {
              const extracted = await extractTextFromFile(
                Buffer.from(parsed.base64, "base64"),
                attachment.filename
              );
              attachedDocument = {
                filename: attachment.filename,
                text: extracted.text.slice(0, 15000),
              };
            } catch (e) {
              console.warn("[api/assistant/chat] Extract dokumen:", e);
            }
          }
        }

        // 5) System prompt + riwayat + pertanyaan
        const system = buildSystemPrompt({
          context,
          ragHits,
          mentionedNotes: mentionedNotesMeta,
          ragSkipped: ragHits.length === 0 && ragError !== "",
          webResults,
          attachedDocument,
        });
        const userPrompt = buildUserPrompt({
          question,
          mentions,
          noteTitleById,
        });

        // 6) Stream dari AI
        emit({ type: "meta", mode: "assistant", model: "" });
        try {
          const result = await aiChatStream(
            {
              system,
              user: userPrompt,
              history,
              maxTokens: 1600,
              temperature: 0.7,
              visionImage,
              speedMode,
            },
            (ev) => {
              if (ev.type === "token") {
                answer += ev.text;
                emit({ type: "token", text: ev.text });
              } else if (ev.type === "meta") {
                modelUsed = ev.model;
              }
            }
          );
          if (!answer) answer = result.content;
          modelUsed = modelUsed || result.model;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "AI gagal.";
          // Pesan user sudah tersimpan; tampilkan error agar UI bisa retry.
          console.error("[api/assistant/chat] AI:", e);
          emit({ type: "error", message: msg });
          controller.close();
          return;
        }

        // Simpan jawaban asisten
        await appendMessage({
          sessionId,
          role: "assistant",
          content: answer,
          sources,
          model: modelUsed || null,
        });

        // Model asli yang dipakai (fallback chain) dikirim setelah selesai.
        emit({ type: "meta", mode: "assistant", model: modelUsed });
        emit({ type: "sources", sources });
        emit({ type: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
        console.error("[api/assistant/chat] handler:", e);
        emit({ type: "error", message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      }
    },
    cancel() {
      // Klien berhenti (mis. Stop) — biarkan provider fetch di-cancel browser.
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