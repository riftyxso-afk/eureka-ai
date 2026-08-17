/**
 * POST /api/notes/process — MEMBUAT JOB BACKGROUND.
 *
 * Validasi cepat lalu balas 202 { jobId } seketika; pekerjaan berat (ekstraksi,
 * bab AI, enrichment, RAG, kuis) berjalan di latar belakang via lib/jobQueue.
 * User bebas pindah halaman — progres & notifikasi selesai dikirim otomatis.
 *
 * - Progress realtime saat modal terbuka: SSE /api/notes/process-progress/[sessionId]
 * - Status job untuk polling: GET /api/notes/jobs/[jobId]
 * - Notifikasi selesai: lonceng (pushNotification) + toast/notifikasi browser.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { runAfter } from "@/lib/after";
import { requireAuth } from "@/lib/assistant/auth";
import { enforcePremium } from "@/lib/premium";
import {
  canStartGeneration,
  createJob,
  executeJob,
  updateJob,
  isJobCancelled,
  JobCancelledError,
} from "@/lib/jobQueue";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { ProgressTracker, phaseToPercent } from "@/lib/progressTracker";
import {
  processNoteForBackground,
  SOURCE_LABEL,
  type NoteSource,
  type NotesProcessorProgress,
  type NotePrefs,
} from "@/lib/notesProcessor";
import { pushNotification } from "@/lib/notifications-store";
import { sendPushToUser } from "@/lib/push-send";
import { recordActivity } from "@/lib/progress-store";
import { clampChapterCount } from "@/lib/prompts/noteGeneration";
import { languageFromRequest } from "@/lib/locale";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOTE_TYPES = ["rangkuman", "makalah", "laporan", "poin"] as const;

/** Validasi jenis rangkuman dari FormData (default: rangkuman). */
function validateNoteType(value: FormDataEntryValue | null): NotePrefs["noteType"] {
  const raw = String(value ?? "").trim().toLowerCase();
  return (NOTE_TYPES as readonly string[]).includes(raw)
    ? (raw as NotePrefs["noteType"])
    : "rangkuman";
}

/** Maksimal sumber per catatan. */
const MAX_SOURCES = 5;

/**
 * Baca & validasi daftar sumber dari FormData.
 * - `sources`: JSON array metadata `[{ type, url?, soalText?, fileName? }]`
 * - File dikirim sebagai `file0`, `file1`, … sesuai indeks sumber.
 * Mengembalikan daftar sumber siap proses, atau `{ error, status }`.
 */
async function parseSources(form: FormData): Promise<
  | { ok: true; sources: NoteSource[] }
  | { ok: false; error: string; status: number }
> {
  const raw = String(form.get("sources") ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      error: "Minimal satu sumber diperlukan.",
      status: 400,
    };
  }

  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "Data sumber tidak valid.",
      status: 400,
    };
  }
  if (!Array.isArray(list) || list.length === 0) {
    return {
      ok: false,
      error: "Minimal satu sumber diperlukan.",
      status: 400,
    };
  }
  if (list.length > MAX_SOURCES) {
    return {
      ok: false,
      error: `Maksimal ${MAX_SOURCES} sumber per catatan.`,
      status: 400,
    };
  }

  const sources: NoteSource[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = (list[i] ?? {}) as Record<string, unknown>;
    const type = String(item.type ?? "").trim();
    if (!(type in SOURCE_LABEL)) {
      return {
        ok: false,
        error: `Jenis sumber #${i + 1} tidak valid.`,
        status: 400,
      };
    }

    const src: NoteSource = { type: type as NoteSource["type"] };
    if (type === "youtube" || type === "web") {
      const url = String(item.url ?? "").trim();
      if (!url) {
        return {
          ok: false,
          error: `Masukkan link untuk sumber #${i + 1} (${SOURCE_LABEL[type as keyof typeof SOURCE_LABEL]}).`,
          status: 400,
        };
      }
      src.url = url;
    } else if (type === "soal") {
      const soalText = String(item.soalText ?? "").trim();
      if (soalText.length < 10) {
        return {
          ok: false,
          error: `Tempel soal/tugas sumber #${i + 1} dulu (minimal 10 karakter).`,
          status: 400,
        };
      }
      src.soalText = soalText.slice(0, 60000);
    } else {
      // dokumen/audio/video → wajib file yang dikirim sebagai file<i>.
      const file = form.get(`file${i}`);
      if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
        return {
          ok: false,
          error: `Unggah file untuk sumber #${i + 1} (${SOURCE_LABEL[type as keyof typeof SOURCE_LABEL]}).`,
          status: 400,
        };
      }
      const upload = file as File;
      if (upload.size > 4 * 1024 * 1024) {
        return {
          ok: false,
          error: `File #${i + 1} terlalu besar (maksimal 4 MB). Unggah versi ringkas atau gunakan link YouTube/Web.`,
          status: 413,
        };
      }
      const buffer = Buffer.from(await upload.arrayBuffer());
      if (!buffer.length) {
        return {
          ok: false,
          error: `File #${i + 1} yang diunggah kosong.`,
          status: 400,
        };
      }
      src.fileBuffer = buffer;
      src.fileName = upload.name;
    }
    sources.push(src);
  }
  return { ok: true, sources };
}

export async function POST(req: NextRequest) {
  const sessionId = String(req.headers.get("x-session-id") ?? "")
    .trim()
    .slice(0, 80);
  const tracker = new ProgressTracker(sessionId || randomUUID());

  try {
    const form = await req.formData();
    const userId = String(form.get("userId") ?? "").trim().slice(0, 80);

    // Validasi cepat sumber (hanya yang bisa dicek sebelum kerja berat).
    const parsed = await parseSources(form);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status }
      );
    }
    const sources = parsed.sources;

    // ── Keamanan: userId wajib cocok dengan token sesi (apiFetch melampirkan Bearer). ──
    const auth = await requireAuth(
      req.headers.get("authorization"),
      userId
    );
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // ── Gating premium: kuota generate catatan bulanan untuk free. ──
    const premiumNote = await enforcePremium(userId, "note-generate");
    if (!premiumNote.ok) {
      return NextResponse.json(
        { error: premiumNote.error, upgradeUrl: premiumNote.upgradeUrl },
        { status: premiumNote.status ?? 402 }
      );
    }

    // ── Rate limit per user (proteksi token AI): maks 3 generate/jam. ──
    ensureRateLimitPrune();
    const rl = checkRateLimit(`note-process:${userId}`, 3, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error:
            "Kamu sudah membuat 3 catatan dalam 1 jam. Tunggu sebentar lalu coba lagi ya.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    // ── Kapasitas generate serentak (lintas server): global 5 / per-user 1. ──
    const cap = await canStartGeneration(userId);
    if (!cap.ok) {
      const busy =
        cap.reason === "global"
          ? "Server sedang sibuk. Coba lagi dalam beberapa menit ya."
          : "Kamu masih punya catatan yang sedang diproses. Tunggu sampai selesai ya.";
      return NextResponse.json({ error: busy }, { status: 429 });
    }

    const prefs: NotePrefs = {
      studyMode: String(form.get("studyMode") ?? "standar") as NotePrefs["studyMode"],
      gayaPenulisan: String(form.get("gayaPenulisan") ?? "Ramah & Santai"),
      // Bahasa AI mengikuti locale user (header x-locale dari geo IP /
      // pemilih bahasa), kecuali wizard mengirim preferensi eksplisit.
      bahasa: String(form.get("bahasa")?.toString().trim() || languageFromRequest(req)),
      chapterCount: clampChapterCount(form.get("chapterCount") ?? undefined),
      generationMode: String(form.get("generationMode") ?? "lengkap") as NotePrefs["generationMode"],
      assignment: form.get("assignment") === "1" || form.get("assignment") === "true",
      translate: form.get("translate") === "1" || form.get("translate") === "true",
      noteType: validateNoteType(form.get("noteType")),
    };

    // Progress bawaan: tracker (SSE) + update status job.
    const jobProgress: NotesProcessorProgress = {
      report: (phase, percent, message) => {
        tracker.emit(phase, percent, message);
        updateJob(jobIdRef.current, { percent, message });
      },
      advance: (phase, fraction, message) => {
        tracker.advance(phase, fraction, message);
        updateJob(jobIdRef.current, {
          percent: phaseToPercent(phase, fraction),
          message,
        });
      },
      done: (phase, message) => {
        tracker.done(phase, message);
        updateJob(jobIdRef.current, {
          percent: phaseToPercent(phase, 1),
          message,
        });
      },
    };

    const jobIdRef: { current: string } = { current: "" };
    const jobId = createJob({
      sessionId: sessionId || "anonymous",
      userId,
      run: async (id) => {
        try {
          const { note, warnings } = await processNoteForBackground(
            {
              sources,
              prefs,
              jobId: id,
              userId,
            },
            jobProgress
          );
          updateJob(id, {
            status: "done",
            percent: 100,
            message: "Selesai!",
            noteId: note.id,
            noteTitle: note.title,
          });
          tracker.emit("study_tools", 100, "Selesai!");
          console.info(`[api/notes/process] Selesai: ${note.id} (${note.title})`);

          // Notifikasi in-app (lonceng) + XP, hanya bila user diketahui.
          if (userId) {
            try {
              await pushNotification(userId, {
                type: "note_ready",
                title: "Catatan selesai dibuat!",
                message:
                  warnings && warnings.length > 0
                    ? `“${note.title}” sudah siap, tapi ${warnings.length} sumber gagal diproses.`
                    : `“${note.title}” sudah siap dipelajari.`,
                link: `/dashboard/note/${note.id}`,
              });
            } catch (e) {
              console.warn("[api/notes/process] Notifikasi dilewati:", e);
            }
            // Web Push ke HP (butuh VAPID keys + subscription aktif di browser).
            try {
              await sendPushToUser(userId, {
                title: "Catatan selesai dibuat!",
                body: `“${note.title}” sudah siap dipelajari.`,
                url: `/dashboard/note/${note.id}`,
                tag: `note-ready-${note.id}`,
              });
            } catch (e) {
              console.warn("[api/notes/process] Web push dilewati:", e);
            }
            try {
              await recordActivity(userId, 30, "Catatan baru selesai dibuat");
            } catch (e) {
              console.warn("[api/notes/process] XP dilewati:", e);
            }
          }
        } catch (e) {
          if (e instanceof JobCancelledError || (await isJobCancelled(id))) {
            tracker.emit("extract", jobProgress ? 100 : 100, "Proses dibatalkan.");
            return;
          }
          const msg = "Terjadi kesalahan saat memproses materi.";
          console.error("[api/notes/process] Job gagal:", e);
          updateJob(id, {
            status: "error",
            error: msg,
            message: "Proses gagal.",
            percent: 100,
          });
          tracker.emit("extract", 100, "Proses gagal.");
        }
      },
    });
    jobIdRef.current = jobId;

    // Eksekusi setelah respons HTTP (Vercel & self-hosted) — bukan setImmediate
    // yang mati saat fungsi dibekukan di serverless.
    runAfter(() => {
      void executeJob(jobId);
    });

    return NextResponse.json(
      { jobId, status: "queued", message: "Proses berjalan di latar belakang." },
      { status: 202 }
    );
  } catch (e) {
    const msg = "Terjadi kesalahan saat memproses materi.";
    console.error("[api/notes/process]", e);
    tracker.emit("extract", 100, "Proses gagal.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
