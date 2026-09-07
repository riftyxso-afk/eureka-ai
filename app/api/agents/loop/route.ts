/**
 * POST /api/agents/loop — turn chat dalam mode "Eureka Multi Agent".
 *
 * Satu request = satu fase loop (serverless-friendly, state di Supabase):
 *
 * - Toggle ON + belum ada sesi aktif  → buat sesi, Kompas klasifikasi intent,
 *   Socra ajukan pertanyaan pertama (fase act).
 * - Loop aktif + siswa mengirim jawaban → reflect (Lensa) + decide (Kompas);
 *   bila continue → Socra ajukan pertanyaan berikutnya, bila selesai →
 *   kirim pesan penutup dan status loop terakhir.
 * - Toggle OFF di tengah loop → stop instan (status user_stopped), respons
 *   berikutnya kembali ke chat biasa.
 *
 * Event SSE (pola sama dengan /api/assistant/chat):
 *   { type: "loop_state", iteration, maxIterations, phase, status, decision }
 *   { type: "token" | "thinking" | "meta" | "error" | "done" }
 */
import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getProfileMd } from "@/lib/profile";

import {
  beginActPhase,
  reflectAndDecide,
} from "@/lib/agents/loop";
import {
  DailyCostCapError,
  checkLoopTurnRate,
  createLoopSession,
  getActiveLoopSession,
  stopLoopSession,
  updateLoopSession,
} from "@/lib/agents/loopStore";
import {
  AgentRateLimitError,
  kompasClassify,
  socraStream,
  socraStreamWithSolution,
} from "@/lib/agents";
import { AGENT_CATALOG } from "@/lib/agents/catalog";
import { checkDailyCostCap, estimateTokens } from "@/lib/agents/costCap";

export const runtime = "nodejs";

// ─── Helpers ────────────────────────────────────────────────────────────────

function sseEvent(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  payload: unknown
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

/** Sambutan penutup loop, sesuai keputusan exit. */
function closingMessage(decision: string, topic: string): string {
  switch (decision) {
    case "goal_reached":
      return `🎉 EUREKA! Kamu sudah menguasai **${topic}** — mantap! Kalau mau lanjut ke topik lain atau butuh catatan rangkuman sesi ini, tinggal bilang ya.`;
    case "max_iterations":
      return `Kita sudah berdiskusi ${topic} cukup lama hari ini — progresmu bagus! Nanti lanjutkan lagi supaya materinya makin melekat. Mau kubuatkan catatan rangkuman dulu?`;
    default:
      return `Oke, kita berhenti dulu ya. Progres belajar ${topic} tadi tersimpan — kapan pun siap melanjutkan, panggil saja!`;
  }
}

/**
 * Deteksi cepat soal "berat numerik" — sinyal butuh verifikasi sandbox
 * (PRD §6.2 otomatis). Heuristik murah: angka desimal/persamaan/π/akar/
 * kata kunci hitungan. Klasifikasi mendalam tetap milik Kompas.
 */
function looksNumericHeavy(text: string): boolean {
  const t = text.toLowerCase();
  const signals = [
    /\d+\s*[\^√]\s*\d/,
    /\b(akar|integral|turunan|limit|trigonometri|persamaan kuadrat|sin|cos|tan|log)\b/,
    /[∫∑π]/,
    /\d+\/\d+/,
    /\b(hitung|hitunglah|berapa|kalkulasi|verifikasi)\b/,
    /\d{2,}\s*[x×*+\-]\s*\d{2,}/,
  ];
  return signals.some((p) => p.test(t));
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const respondJson = (body: unknown, status = 400) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const raw = (await req.json().catch(() => null)) as {
    sessionId?: unknown;
    userId?: unknown;
    message?: unknown;
    history?: unknown;
    toggleOn?: unknown;
    topic?: unknown;
    solveThenGuide?: unknown;
  } | null;

  const chatSessionId = typeof raw?.sessionId === "string" ? raw.sessionId : "";
  const message = typeof raw?.message === "string" ? raw.message.trim() : "";
  const toggleOn = raw?.toggleOn === true;
  const manualStg = raw?.solveThenGuide === true;
  const topicHint = typeof raw?.topic === "string" ? raw.topic.slice(0, 200) : "";
  const bodyUserId = typeof raw?.userId === "string" ? raw.userId.trim() : "";
  const history = Array.isArray(raw?.history)
    ? (raw!.history as unknown[])
        .filter(
          (m): m is { role: "user" | "assistant"; content: string } =>
            !!m &&
            typeof (m as { role?: unknown }).role === "string" &&
            typeof (m as { content?: unknown }).content === "string"
        )
        .filter((m) => m.content.trim().length > 0)
        .slice(-12)
    : [];

  if (!chatSessionId || !message || !bodyUserId) {
    return respondJson(
      { error: "sessionId, message, dan userId diperlukan." },
      400
    );
  }

  // Verifikasi token wajib & cocok dengan userId body (pola requireAuth existing).
  const auth = await requireAuth(req.headers.get("authorization"), bodyUserId);
  if (auth.error || !auth.userId) {
    return respondJson({ error: auth.error ?? "Tidak terautentikasi." }, auth.status ?? 401);
  }
  const userId = auth.userId;

  // Rate limit turn loop (di samping rate limit per agent di callAgentModel).
  const turnRl = checkLoopTurnRate(userId);
  if (!turnRl.ok) {
    return respondJson(
      { error: "Mode Multi Agent baru saja dipakai berturut-turut. Tunggu sebentar ya." },
      429
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (payload: unknown) => sseEvent(encoder, controller, payload);

      /** Tambah pesan asisten ke sesi chat existing (store asisten). */
      const appendAssistant = async (content: string, model: string) => {
        try {
          const { appendMessage } = await import("@/lib/assistant/store");
          await appendMessage({
            sessionId: chatSessionId,
            role: "assistant",
            content,
            sources: [],
            model,
          });
        } catch (e) {
          console.warn("[api/agents/loop] simpan pesan gagal:", e);
        }
      };

      try {
        // ── Toggle dimatikan di tengah loop → stop instan ────────────────
        const existing = await getActiveLoopSession(userId, chatSessionId);
        if (existing && !toggleOn) {
          await stopLoopSession(existing.id, "user_stopped");
          emit({
            type: "loop_state",
            iteration: existing.iteration,
            maxIterations: existing.maxIterations,
            phase: "selesai",
            status: "user_stopped",
          });
          emit({ type: "done" });
          controller.close();
          return;
        }

        // Profil siswa untuk konteks Socra.
        let profileMd = "";
        try {
          const { db } = await import("@/lib/supabase/admin");
          const { data: prof } = await db()
            .from("users")
            .select("name, username, profile_data, profile_md")
            .eq("id", userId)
            .maybeSingle();
          if (prof) {
            profileMd = getProfileMd(prof) ?? "";
          }
        } catch {
          // profil opsional
        }
        const profileBlock = profileMd
          ? `\n\nPROFIL SISWA (sesuaikan bahasa, tingkat, contoh):\n${profileMd.slice(0, 4000)}`
          : "";

        // ── Belum ada loop aktif → mulai sesi baru ───────────────────────
        if (!existing) {
          if (!toggleOn) {
            // Toggle OFF & memang tidak ada loop: bukan domain route ini.
            emit({ type: "error", message: "Mode Multi Agent tidak aktif." });
            controller.close();
            return;
          }

          // Kompas: klasifikasi intent & topik.
          let intent: { intent: "tutoring" | "note" | "draw" | "chat"; topic: string; difficulty: "mudah" | "sedang" | "sulit"; reason: string } = {
            intent: "tutoring",
            topic: topicHint || "umum",
            difficulty: "sedang",
            reason: "",
          };
          try {
            intent = await kompasClassify(message, {
              userId,
              source: "loop",
              loopSessionId: null,
            });
          } catch (e) {
            // Kompas gagal → fallback: anggap tutoring dengan topik hint.
            console.warn("[api/agents/loop] kompas gagal, fallback tutoring:", e);
          }

          const session = await createLoopSession({
            userId,
            chatSessionId,
            topic: intent.topic,
          });
          emit({
            type: "loop_state",
            iteration: 0,
            maxIterations: session.maxIterations,
            phase: "act",
            status: "active",
          });

          // Cap biaya harian bucket loop (estimasi kasar token turn ini).
          await checkDailyCostCap("loop", userId, estimateTokens(message + profileMd, 1200));

          // Intent "note" → Jejak membuat catatan langsung sebagai artifact
          // markdown (PRD §7.1 — output Jejak dirender di canvas, bukan bubble).
          if (intent.intent === "note") {
            const { callAgentModelStream } = await import("@/lib/agents/callAgentModel");
            const noteTitle = intent.topic === "umum" ? "Catatan Sesi" : intent.topic;
            emit({
              type: "token",
              text: `<artifact type="markdown" title="${noteTitle.replace(/"/g, "'")}" agent="jejak">`,
            });
            let noteContent = "";
            const { done } = await callAgentModelStream(
              "jejak",
              {
                user:
                  `Buat catatan dari sesi/percakapan berikut.\n\n` +
                  history
                    .map((m) => `${m.role === "user" ? "Siswa" : "Asisten"}: ${m.content}`)
                    .join("\n") +
                  `\n\nPermintaan siswa: ${message}`,
              },
              (ev) => {
                if (ev.type === "token") {
                  noteContent += ev.text;
                  emit(ev);
                } else if (ev.type !== "meta") {
                  emit(ev);
                }
              },
              { userId, source: "loop" },
              { premium: true }
            );
            const jejakMeta = await done;
            emit({ type: "token", text: "</artifact>" });
            const closing = `Catatan "${noteTitle}" sudah kubuat di panel Artifact Canvas — cek di sebelah ya. Mau kusesuaikan isinya?`;
            emit({ type: "meta", mode: "multi-agent", model: jejakMeta.model || "jejak" });
            emit({ type: "done", reply: closing });
            // Simpan ke DB dengan tag artifact agar tersimpan permanen di riwayat
            const savedWithArtifact = `${closing}\n\n<artifact type="markdown" title="${noteTitle.replace(/"/g, "'")}" agent="jejak">\n${noteContent}\n</artifact>`;
            await appendAssistant(savedWithArtifact, jejakMeta.model || "jejak");
            controller.close();
            return;
          }

          // Intent "draw" → Palet menyusun prompt, image-gen existing
          // menghasilkan gambar → artifact `image` di canvas (PRD §7.2/§7.5).
          if (intent.intent === "draw") {
            try {
              const { paletPrompt } = await import("@/lib/agents");
              const { generateImageViaOpenAgentic } = await import("@/lib/image-gen");
              const { generateAiIllustration } = await import("@/lib/cloudflareImages");
              const promptEn = await paletPrompt(
                message,
                { userId, source: "loop" },
                { premium: true }
              );
              // OpenAgentic utama → Cloudflare FLUX fallback (pola route image).
              const dataUrl =
                (await generateImageViaOpenAgentic(promptEn)) ??
                (await generateAiIllustration(promptEn));
              if (!dataUrl) throw new Error("image provider gagal");
              // content = dataUrl gambar — dirender canvas sebagai image.
              const drawTitle = (intent.topic === "umum" ? "Gambar" : intent.topic).replace(/"/g, "'");
              emit({
                type: "token",
                text: `<artifact type="image" title="${drawTitle}" agent="palet">${dataUrl}</artifact>`,
              });
              const closing = `Gambarnya sudah jadi di panel Artifact Canvas — semoga membantu membayangkan materinya!`;
              emit({ type: "meta", mode: "multi-agent", model: "palet" });
              emit({ type: "done", reply: closing });
              await appendAssistant(closing, "palet");
            } catch (e) {
              console.warn("[api/agents/loop] draw gagal:", e);
              const fallback =
                "Waduh, gambarnya gagal dibuat. Coba lagi sebentar lagi ya!";
              emit({ type: "token", text: fallback });
              emit({ type: "error", message: fallback });
              emit({ type: "done", reply: fallback });
              await appendAssistant(fallback, "palet");
            }
            controller.close();
            return;
          }

          // Socra: pertanyaan pembuka.
          let answer = "";
          let modelUsed = "";
          let streamError: string | null = null;
          const { done } = await socraStream(
            {
              system: profileBlock
                ? `${profileBlock}\n\nGunakan konteks profil di atas untuk menyesuaikan bahasa & contoh.`
                : undefined,
              user:
                `Siswa memulai sesi belajar tentang "${intent.topic}".\n` +
                `Pesan siswa: ${message}\n` +
                `Susun SATU pertanyaan pembuka Socratic yang membingkai tujuan sesi.`,
              history,
            },
            (ev) => {
              if (ev.type === "token") answer += ev.text;
              else if (ev.type === "error") streamError = ev.message;
              else emit(ev);
            },
            { userId, source: "loop", loopSessionId: session.id, iteration: 1 },
            { premium: true }
          );
          const meta = await done;
          modelUsed = meta.model;

          if (streamError && !answer) throw new Error(streamError);

          await beginActPhase({
            session,
            question: answer.slice(0, 4000),
          });
          await updateLoopSession(session.id, {
            goal: intent.topic,
            phase: "observe",
          });

          emit({ type: "meta", mode: "multi-agent", model: modelUsed });
          emit({ type: "done", reply: answer });
          await appendAssistant(answer, modelUsed);
          controller.close();
          return;
        }

        // ── Loop aktif → reflect (Lensa) + decide (Kompas) ───────────────
        // Pertanyaan terakhir dari history (yang dijawab siswa).
        const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
        const tutorQuestion = lastAssistant?.content ?? "";

        const result = await reflectAndDecide({
          session: existing,
          studentAnswer: message,
          tutorQuestion,
          ctx: { userId, source: "loop", loopSessionId: existing.id, iteration: existing.iteration + 1 },
        });

        emit({
          type: "loop_state",
          iteration: result.session.iteration,
          maxIterations: result.session.maxIterations,
          phase: result.session.phase,
          status: result.session.status,
          decision: result.decision,
          mastery: result.newMastery,
        });

        if (result.decision !== "continue_loop") {
          // Loop selesai — kirim pesan penutup.
          const closing = closingMessage(result.decision, existing.topic);
          emit({ type: "token", text: closing });
          emit({ type: "meta", mode: "multi-agent", model: AGENT_CATALOG.kompas.name });
          emit({ type: "done", reply: closing });
          await appendAssistant(closing, "kompas");
          controller.close();
          return;
        }

        // ── Continue: Socra ajukan pertanyaan berikutnya ─────────────────
        await checkDailyCostCap("loop", userId, estimateTokens(message + tutorQuestion, 1200));

        // ── Trigger otomatis Solve-then-Guide (PRD §6.2) ─────────────────
        // Soal sulit terdeteksi (butuh verifikasi numerik) + user Pro +
        // flag aktif → escalate ke Astra+sandbox, lalu balik ke loop normal.
        const stgAvailable =
          process.env.FEATURE_SOLVE_THEN_GUIDE === "1" &&
          (process.env.AGENT_ASTRA_MODEL ?? "").length > 0;
        if (stgAvailable && (manualStg || looksNumericHeavy(message))) {
          try {
            // Entitlement Pro via sistem existing.
            const { enforcePremium } = await import("@/lib/premium");
            const gate = await enforcePremium(userId, "solve-then-guide");
            if (gate.ok) {
              const { solveThenGuide } = await import("@/lib/agents/solveThenGuide");
              const stg = await solveThenGuide({
                problem: message,
                userId,
                loopSessionId: existing.id,
                emit: (ev) => emit(ev),
              });

              // Artifact terminal dengan stdout/stderr ASLI (PRD §7.4).
              if (stg.terminalOutput) {
                const termTitle = `Verifikasi — ${existing.topic}`.replace(/"/g, "'");
                emit({
                  type: "token",
                  text: `<artifact type="terminal" title="${termTitle}" agent="socra">${stg.terminalOutput}</artifact>`,
                });
              }

              // Socra lanjut dialog DENGAN solusi terverifikasi sebagai
              // ground truth (pertanyaan Socratic mundur — PRD §6.1).
              let guideAnswer = "";
              const guideModel = stg.model;
              let streamError: string | null = null;
              const { done } = await socraStreamWithSolution(
                stg.solution,
                {
                  user:
                    `STATE LOOP: iterasi ${result.session.iteration + 1}/${result.session.maxIterations}, mastery ${result.newMastery}/100.\n` +
                    `Soal siswa: ${message}\n\nAjukan pertanyaan Socratic SATU langkah berikutnya mundur dari solusi terverifikasi.`,
                  history,
                },
                (ev) => {
                  if (ev.type === "token") guideAnswer += ev.text;
                  else if (ev.type === "error") streamError = ev.message;
                  else emit(ev);
                },
                {
                  userId,
                  source: "loop",
                  loopSessionId: existing.id,
                  iteration: result.session.iteration + 1,
                },
                { premium: true }
              );
              await done;
              if (streamError && !guideAnswer) throw new Error(streamError);

              await beginActPhase({
                session: result.session,
                question: guideAnswer.slice(0, 4000),
              });
              await updateLoopSession(existing.id, { phase: "observe" });

              emit({ type: "meta", mode: "multi-agent", model: guideModel });
              emit({ type: "done", reply: guideAnswer });
              await appendAssistant(guideAnswer, guideModel);
              controller.close();
              return;
            }
            // Non-Pro: diam-diam lanjut loop normal (UI tidak menawarkan StG).
          } catch (stgErr) {
            // Cap Astra → pesan ramah & stop alur StG (loop tetap aman).
            if (
              stgErr instanceof DailyCostCapError ||
              stgErr instanceof AgentRateLimitError
            ) {
              emit({ type: "token", text: stgErr.message });
              emit({ type: "error", message: stgErr.message, kind: "quota" });
              emit({ type: "done", reply: stgErr.message });
              await appendAssistant(stgErr.message, "kompas");
              controller.close();
              return;
            }
            // Sandbox/provider error lain → jujur, lalu lanjut loop normal.
            console.warn("[api/agents/loop] Solve-then-Guide gagal, lanjut normal:", stgErr);
            emit({
              type: "token",
              text: "Verifikasi sandbox sedang tidak tersedia — kita lanjutkan pembahasannya biasa dulu ya.",
            });
          }
        }

        // Konteks mastery + feedback Lensa membantu Socra menyesuaikan.
        const coachingNote =
          `STATE LOOP (rahasia untukmu): iterasi ${result.session.iteration + 1}/${result.session.maxIterations}, ` +
          `mastery siswa ${result.newMastery}/100. Penilaian Lensa: ${result.verdict.verdict} ` +
          `(skor ${result.verdict.score}).` +
          (result.verdict.misconception
            ? ` Miskonsepsi terdeteksi: ${result.verdict.misconception}.`
            : "") +
          ` Langkah berikutnya yang disarankan: ${result.verdict.feedback}`;

        let answer = "";
        let modelUsed = "";
        let streamError: string | null = null;
        const { done } = await socraStream(
          {
            user:
              `${coachingNote}\n\nRiwayat:\n` +
              history
                .map((m) => `${m.role === "user" ? "Siswa" : "Kamu (Socra)"}: ${m.content}`)
                .join("\n") +
              `\n\nJawaban terbaru siswa: ${message}\n\nAjukan pertanyaan Socratic SATU langkah berikutnya.`,
            history,
          },
          (ev) => {
            if (ev.type === "token") answer += ev.text;
            else if (ev.type === "error") streamError = ev.message;
            else emit(ev);
          },
          {
            userId,
            source: "loop",
            loopSessionId: existing.id,
            iteration: result.session.iteration + 1,
          },
          { premium: true }
        );
        const meta = await done;
        modelUsed = meta.model;

        if (streamError && !answer) throw new Error(streamError);

        // Simpan pertanyaan ke iterasi terbuka (open iteration = reflect-nya
        // sudah diisi di reflectAndDecide; iterasi baru dibuat via beginActPhase).
        await beginActPhase({
          session: result.session,
          question: answer.slice(0, 4000),
        });
        await updateLoopSession(existing.id, { phase: "observe" });

        emit({ type: "meta", mode: "multi-agent", model: modelUsed });
        emit({ type: "done", reply: answer });
        await appendAssistant(answer, modelUsed);
        controller.close();
      } catch (e) {
        // Guardrail: cap biaya & rate limit → pesan ramah.
        if (e instanceof DailyCostCapError || e instanceof AgentRateLimitError) {
          const msg = e.message;
          emit({ type: "token", text: msg });
          emit({ type: "error", message: msg, kind: "quota" });
          emit({ type: "done", reply: msg });
          await appendAssistant(msg, "kompas");
        } else {
          console.error("[api/agents/loop]", e);
          // Isolasi kegagalan: fallback pesan Kompas yang wajar.
          const fallback =
            "Waduh, ada bagian dari sistem kami yang lagi Bermasalah sebentar. Coba kirim ulang pesanmu ya — belajarmu tidak hilang kok. 🙏";
          emit({ type: "token", text: fallback });
          emit({ type: "error", message: fallback });
          emit({ type: "done", reply: fallback });
          await appendAssistant(fallback, "kompas").catch(() => {});
        }
      } finally {
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      }
    },
    cancel() {
      // Klien putus — streaming Socra dibatalkan otomatis (AbortSignal klien).
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
