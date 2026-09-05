import { NextRequest } from "next/server";

import {
  aiChatJson,
  aiChatStream,
  extractJsonObject,
  hasAiKey,
  MODEL_CATALOG,
  MODEL_CATALOG_IDS,
  type AiSpeedMode,
} from "@/lib/ai";
import { cleanSearchQuery, searchWeb } from "@/lib/firecrawl";
import { checkRateLimit as checkHourlyRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { extractTextFromFile, scrapeYoutubeTranscript } from "@/lib/rag/extract";
import { findLatestYoutubeInUserMessages } from "@/lib/assistant/videoUrl";
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
  getNotesContentByIds,
  listNotesMeta,
  searchUserNotes,
  toAssistantSources,
} from "@/lib/assistant/context";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type AttachedDocument,
  type WebSearchResult,
} from "@/lib/assistant/prompt";
import {
  authorizeAssistantUser,
  isBetaTester,
} from "@/lib/assistant/auth";
import { enforcePremium, getPremiumStatus, UPGRADE_URL } from "@/lib/premium";
import {
  SAFETY_REFUSAL_ID,
  guardInput,
  guardOutput,
} from "@/lib/safety/guardrails";
import { languageFromRequest } from "@/lib/locale";
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
    clarifications?: unknown;
    /** User memilih "Langsung jawab saja" — lewati klarifikasi tanpa menilai ulang. */
    clarificationsSkipped?: unknown;
    /** Link YouTube pada pesan user — video aktif sesi (konteks transkrip). */
    videoUrl?: unknown;
    reasoning?: unknown;
    /** Model spesifik pilihan user (Model Store) — divalidasi allowlist. */
    model?: unknown;
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

  // Jawaban klarifikasi dari pengguna (maks 3, tiap pasangan pertanyaan+jawaban).
  // Setiap item membawa teks pertanyaan (`question`) agar bisa disuntikkan
  // ke prompt dalam format Q/A yang natural.
  const clarifications = Array.isArray(raw?.clarifications)
    ? (raw.clarifications as {
        id?: unknown;
        question?: unknown;
        answer?: unknown;
      }[])
        .map((c) => ({
          id: String(c?.id ?? "").trim().slice(0, 60),
          question: String(c?.question ?? "").trim().slice(0, 300),
          answer: String(c?.answer ?? "").trim().slice(0, 200),
        }))
        .filter((c) => c.id && c.answer)
        .slice(0, 3)
    : [];
  const hasClarifications = clarifications.length > 0;
  // User menekan "Langsung jawab saja" — jangan tanya klarifikasi lagi
  // (kalau tidak, AI menilai ulang prompt yang sama → loop klarifikasi).
  const clarificationsSkipped = raw?.clarificationsSkipped === true;
  // Pertanyaan efektif: prompt asli + jawaban klarifikasi sebagai konteks,
  // dalam format Q/A agar AI menjawab sesuai pilihan user.
  const effectiveQuestion = hasClarifications
    ? `${question}\n\nKonteks tambahan dari jawaban pengguna (jadikan jawaban sesuai informasi ini):\n${clarifications
        .map(
          (c) => `Q: ${c.question || c.id}\nA: ${c.answer}`
        )
        .join("\n")}`
    : question;

  // Konten pesan user yang disimpan ke riwayat: pakai prompt efektif (prompt
  // asli + jawaban QnA) bila ada klarifikasi, agar bubble/riwayat menampilkan
  // Q/A yang dijawab user — bukan hanya prompt polos.
  const storedUserContent = hasClarifications
    ? effectiveQuestion
    : question;

  // Kecepatan jawaban AI yang dipilih user (fast/normal/deep).
  const speedModeRaw = String(raw?.speedMode ?? "").trim();
  const speedMode: AiSpeedMode = ["fast", "normal", "deep"].includes(speedModeRaw)
    ? (speedModeRaw as AiSpeedMode)
    : "normal";

  // Model spesifik pilihan user (Model Store) — allowlist katalog; id asing
  // diabaikan (mode tier normal) tanpa menolak permintaan.
  const modelRaw = String(raw?.model ?? "").trim();
  const preferredModel = MODEL_CATALOG_IDS.has(modelRaw) ? modelRaw : undefined;

  // Toggle reasoning dari composer (default ON = thinking real, OFF = model biasa + loading pixel-grid).
  const reasoning = raw?.reasoning !== false;

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

  // ── Gating premium: kuota chat harian untuk free; web search wajib Pro. ──
  const premiumChat = await enforcePremium(userId, "assistant-chat");
  if (!premiumChat.ok) {
    return respondJson(
      { error: premiumChat.error, upgradeUrl: premiumChat.upgradeUrl },
      premiumChat.status ?? 402
    );
  }
  // Status premium → rantai model (Pro = model pintar di depan, free = model
  // murah) + gerbang model premiumOnly.
  const isPremiumUser = (await getPremiumStatus(userId)).isPremium;
  // Model premiumOnly (mis. GPT-6 Astra) — khusus pengguna Pro. Free user yang
  // mengirimnya (UI lama/klien iseng) ditolak dengan pesan upgrade yang jelas.
  if (preferredModel) {
    const entry = MODEL_CATALOG.find((m) => m.id === preferredModel);
    if (entry?.premiumOnly && !isPremiumUser) {
      return respondJson(
        {
          error: `Model ${entry.name} khusus pengguna Pro.`,
          upgradeUrl: UPGRADE_URL,
        },
        402
      );
    }
  }
  if (webSearch) {
    const premiumWeb = await enforcePremium(userId, "web-search");
    if (!premiumWeb.ok) {
      return respondJson(
        { error: premiumWeb.error, upgradeUrl: premiumWeb.upgradeUrl },
        premiumWeb.status ?? 402
      );
    }
  }

  if (!checkRateLimit(userId)) {
    return respondJson(
      { error: "Terlalu banyak permintaan. Tunggu sebentar ya." },
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
          "Kamu sudah mengirim banyak pesan dalam 1 jam. Tunggu sebentar lalu lanjutkan ya.",
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

  // ── Guardrails keamanan AI (NVIDIA NIM + heuristik lokal) ──────────
  // Input diblokir SEBELUM LLM dipanggil. Redirect topik juga ditolak
  // di sini dengan pesan sopan (klien menampilkannya sebagai error toast).
  try {
    const inputVerdict = await guardInput(question);
    if (!inputVerdict.allowed || inputVerdict.topicRedirect) {
      return respondJson({ error: SAFETY_REFUSAL_ID }, 400);
    }
  } catch (e) {
    // Guardrail tidak boleh memutus chat bila ia sendiri error.
    console.error("[api/assistant/chat] guardInput:", e);
  }

  // ── Klarifikasi prompt ambigu ────────────────────────────────────────
  // Sebelum streaming, nilai prompt dengan panggilan AI ringan. Bila prompt
  // kurang informasi inti, balas JSON pertanyaan pilihan ganda (maks 3) dan
  // JANGAN simpan pesan ke riwayat — jawaban user dikirim ulang sebagai
  // `clarifications` pada request berikutnya.
  //
  // Anti-loop: klarifikasi boleh muncul SETIAP prompt ambigu, tapi dibatasi
  // agar tidak berulang selamanya — (1) maksimal 2× per sesi, (2) pertanyaan
  // yang SUDAH pernah ditanyakan di sesi ini TIDAK diulang (filter hasil AI),
  // (3) jawaban user (`clarifications`) & tombol skip membuat server langsung
  // menjawab tanpa menilai ulang (lihat hasClarifications/clarificationsSkipped).
  const MAX_CLARIFICATIONS_PER_SESSION = 2;
  if (!hasClarifications && !clarificationsSkipped && !webSearch && !attachment) {
    try {
      // Konteks percakapan terakhir + jumlah klarifikasi yang sudah terjadi
      // di sesi ini (dari pesan user yang berisi Q/A) + daftar pertanyaan
      // yang sudah pernah ditanyakan (agar tidak diulang).
      let recentHistory: string[] = [];
      let priorClarificationCount = 0;
      const askedQuestions: string[] = [];
      try {
        const history = await getMessages(sessionId, userId);
        recentHistory = history
          .slice(-8)
          .map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content}`)
          .map((s) => s.slice(0, 300));
        // Pesan user yang pernah menjawab klarifikasi berformat
        // "Q: ...\nA: ..." — hitung jumlahnya & kumpulkan pertanyaannya.
        for (const m of history) {
          if (m.role !== "user") continue;
          if (m.content.includes("Q:") && m.content.includes("A:")) {
            priorClarificationCount++;
            const qa = m.content.split(/\n/);
            for (const line of qa) {
              const mm = /^Q:\s*(.+)$/.exec(line.trim());
              if (mm && mm[1].trim()) {
                askedQuestions.push(mm[1].trim().slice(0, 120));
              }
            }
          }
        }
      } catch {
        // abaikan — klarifikasi tetap jalan tanpa konteks
      }

      if (priorClarificationCount >= MAX_CLARIFICATIONS_PER_SESSION) {
        // Sudah cukup sering klarifikasi di sesi ini — langsung jawab saja
        // (prompt ambigu berikutnya tetap dijawab dengan konteks yang ada).
      } else {
      // Konteks CATATAN user — agar penilai paham isi/topik catatan dan
      // TIDAK bertanya hal di luar materi. Misal prompt "ringkas semua
      // catatan saya" sudah jelas → needs=false (jangan tanya yang lain).
      let notesContext = "(user belum punya catatan)";
      try {
        const metas = await listNotesMeta(userId);
        if (metas.length > 0) {
          notesContext = metas
            .slice(0, 20)
            .map(
              (n) =>
                `- "${n.title}"${n.subject ? ` (${n.subject})` : ""}${
                  n.chapterTitles.length > 0
                    ? ` — bab: ${n.chapterTitles.slice(0, 8).join("; ")}`
                    : ""
                }${n.summary ? `\n  Ringkasan: ${n.summary.slice(0, 200)}` : ""}`
            )
            .join("\n");
        }
      } catch {
        // abaikan — klarifikasi tetap jalan tanpa konteks catatan
      }

      const judged = await aiChatJson<{
        needs: boolean;
        questions?: { q?: unknown; options?: unknown[] }[];
      }>(
        {
          system:
            "Kamu menilai apakah prompt pengguna ambigu sehingga butuh klarifikasi singkat sebelum dijawab. Jawab HANYA JSON, tanpa teks lain.",
          user: `Percakapan terakhir (konteks topik yang sedang dibahas):\n${recentHistory.length > 0 ? recentHistory.join("\n") : "(belum ada — ini pesan pertama)"}\n\n=== CATATAN MILIK USER (topik materi yang bisa dibahas) ===\n${notesContext}\n\nPrompt pengguna saat ini: "${question.slice(0, 800)}"\r\n\r\nNilai apakah prompt kurang informasi inti sehingga jawabanmu berisiko meleset. Bila YA, buat 1-3 pertanyaan klarifikasi pilihan ganda dalam bahasa Indonesia yang singkat dan RELEVAN dengan TOPIK yang sedang dibahas (tiap pertanyaan 2-4 opsi). Bila TIDAK (sudah jelas), needs=false dan questions kosong.\r\n\r\nATURAN PENTING:\r\n- Pertanyaan WAJIB berkaitan dengan TOPIK MATERI/CATATAN user yang sedang dibahas — JANGAN tanya hal generik di luar materi (mis. jangan tanya "jenjang sekolah apa?", "mapel favorit apa?", atau "kamu suka belajar apa?").\r\n- Prompt seperti "ringkas semua catatan saya", "buat kuis dari catatan", "jelaskan bab yang sulit" SUDAH JELAS → needs=false, jangan tanya apa pun (AI bisa memilih catatan/bab sendiri dari daftar di atas).\r\n- Hanya tanyakan informasi yang benar-benar hilang dan diperlukan untuk menjawab prompt spesifik ini (mis. jumlah soal, format jawaban, atau pilihan catatan bila benar-benar ambigu dan tidak bisa diputuskan dari daftar).\r\n- MAKSIMAL 3 pertanyaan; kalau bisa 1 saja, lebih baik.\r\n\r\nOutput JSON: {"needs": true/false, "questions": [{"q": "...", "options": ["A", "B", "C"]}]}`,
          json: true,
          maxTokens: 400,
          temperature: 0.2,
          forChat: true,
          premium: isPremiumUser,
        },
        (raw) =>
          extractJsonObject<{
            needs: boolean;
            questions?: { q?: unknown; options?: unknown[] }[];
          }>(raw)
      );
      const questions = (
        Array.isArray(judged?.questions) ? judged.questions : []
      )
        .filter(
          (x): x is { q: unknown; options: unknown[] } =>
            !!x &&
            typeof x.q === "string" &&
            Array.isArray(x.options) &&
            x.options.length >= 2
        )
        .map((x, i) => ({
          id: `q${i + 1}`,
          question: String(x.q).trim().slice(0, 300),
          options: x.options
            .slice(0, 4)
            .map((o) => String(o).trim().slice(0, 120)),
        }))
        // Jangan ulangi pertanyaan yang sudah pernah ditanyakan di sesi ini
        // (hasil AI sering mengulang pertanyaan yang sama untuk prompt mirip).
        .filter((q) => !askedQuestions.includes(q.question))
        .slice(0, 3);
      if (judged?.needs === true && questions.length > 0) {
        return respondJson({ clarification: questions }, 200);
      }
      }
    } catch (e) {
      console.warn("[api/assistant/chat] klarifikasi gagal, lanjut normal:", e);
    }
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
        const isRetry =
          pending !== null &&
          (pending.content === question ||
            pending.content === effectiveQuestion);
        const history = isRetry && prior.length > 0 ? prior.slice(0, -1) : prior;

        if (!isRetry) {
          await appendMessage({
            sessionId,
            role: "user",
            content: storedUserContent,
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
            webResults = (await searchWeb(searchQuery, 10)).map((r) => ({
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

        // 4c) Tool video: link YouTube pada pesan (atau video aktif terbaru di
        //     riwayat) → ekstrak transkrip sebagai konteks jawaban AI. Gagal
        //     (video tanpa subtitle / timeout) TIDAK memblokir jawaban.
        let activeVideoUrl =
          typeof raw?.videoUrl === "string" && raw.videoUrl.trim()
            ? raw.videoUrl.trim().slice(0, 500)
            : "";
        if (!activeVideoUrl) {
          const fromHistory = findLatestYoutubeInUserMessages(prior);
          if (fromHistory) activeVideoUrl = fromHistory;
        }
        // Fitur video (embed + diskusi dari transkrip) hanya untuk beta tester
        // (akses lewat /join) — cek hanya saat ada video agar tanpa video tidak
        // ada query tambahan ke DB.
        const videoAllowed =
          !!activeVideoUrl && (await isBetaTester(userId));
        let videoContextMd = "";
        if (videoAllowed) {
          try {
            const extracted = await scrapeYoutubeTranscript(activeVideoUrl);
            videoContextMd = `JUDUL: ${extracted.title}\n\nTRANSCRIPT:\n${extracted.text.slice(
              0,
              20000
            )}`;
          } catch (e) {
            console.warn(
              "[api/assistant/chat] transkrip video tidak tersedia, lanjut tanpa konteks video:",
              e
            );
            videoContextMd = "(transkrip video tidak tersedia)";
          }
        }

        // 5) System prompt + riwayat + pertanyaan
        let system = buildSystemPrompt({
          context,
          ragHits,
          mentionedNotes: mentionedNotesMeta,
          ragSkipped: ragHits.length === 0 && ragError !== "",
          webResults,
          attachedDocument,
          language: languageFromRequest(req),
        });
        if (videoContextMd) {
          system += `\n\nMODE "DISKUSI VIDEO":\nPengguna sedang berdiskusi tentang video YouTube (${activeVideoUrl}). Jawab pertanyaan BERDASARKAN transkrip video berikut bila tersedia. Bila transkrip tidak tersedia, akui dengan jujur bahwa kamu tidak bisa membaca isi video, dan JANGAN mengarang kutipan atau klaim dari isi video.\n\n${videoContextMd}`;
        }
        // Isi lengkap catatan yang disebut (@) — disuntikkan ke prompt user
        // agar AI selalu membacanya (tidak bergantung pada hasil RAG).
        const mentionedNoteContents =
          mentions.length > 0
            ? await getNotesContentByIds(userId, mentions).catch(() => [])
            : [];
        const userPrompt = buildUserPrompt({
          question: effectiveQuestion,
          mentions,
          noteTitleById,
          mentionedNoteContents,
          attachedDocument,
        });

        // 6) Stream dari AI — maxTokens dinaikkan biar jawaban web search tidak kepotong (deepseek terpotong di 1400)
        emit({ type: "meta", mode: "assistant", model: "" });
        try {
          const maxTokensBySpeed: Record<AiSpeedMode, number> = {
            fast: 1800,
            normal: 3200,
            deep: 5000,
          };
          const result = await aiChatStream(
            {
              system,
              user: userPrompt,
              history,
              maxTokens: maxTokensBySpeed[speedMode] ?? 3200,
              temperature: speedMode === "fast" ? 0.4 : 0.7,
              visionImage,
              speedMode,
              forChat: true,
              reasoning,
              model: preferredModel,
              premium: isPremiumUser,
            },
            (ev) => {
              if (ev.type === "token") {
                answer += ev.text;
                emit({ type: "token", text: ev.text });
              } else if (ev.type === "thinking") {
                emit({ type: "thinking", text: ev.text });
              } else if (ev.type === "meta") {
                modelUsed = ev.model;
              }
            }
          );
          if (!answer) answer = result.content;
          modelUsed = modelUsed || result.model;
        } catch (e) {
          const msg = "AI gagal.";
          // Pesan user sudah tersimpan; tampilkan error agar UI bisa retry.
          console.error("[api/assistant/chat] AI:", e);
          emit({ type: "error", message: msg });
          controller.close();
          return;
        }

        // Guard output: audit + scrub salinan tersimpan. Batasan:
        // stream sudah terkirim ke klien (SSE tak bisa ditarik), jadi
        // penegakan utama ada di guardInput; di sini yang diamankan
        // adalah riwayat tersimpan + pencatatan event.
        let storedAnswer = answer;
        try {
          const outVerdict = await guardOutput(answer);
          storedAnswer = outVerdict.allowed ? outVerdict.text : SAFETY_REFUSAL_ID;
        } catch (e) {
          console.error("[api/assistant/chat] guardOutput:", e);
        }

        // Simpan jawaban asisten
        await appendMessage({
          sessionId,
          role: "assistant",
          content: storedAnswer,
          sources,
          model: modelUsed || null,
        });

        // Model asli yang dipakai (fallback chain) dikirim setelah selesai.
        emit({ type: "meta", mode: "assistant", model: modelUsed });
        emit({ type: "sources", sources });
        emit({ type: "done" });
      } catch (e) {
        const msg = "Terjadi kesalahan.";
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