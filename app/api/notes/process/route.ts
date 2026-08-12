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
import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "crypto";

import {
  createJob,
  executeJob,
  updateJob,
  isJobCancelled,
  JobCancelledError,
} from "@/lib/jobQueue";
import { ProgressTracker, phaseToPercent } from "@/lib/progressTracker";
import {
  processNoteForBackground,
  type NotesProcessorProgress,
  type NotePrefs,
} from "@/lib/notesProcessor";
import { pushNotification } from "@/lib/notifications-store";
import { recordActivity } from "@/lib/progress-store";
import { clampChapterCount } from "@/lib/prompts/noteGeneration";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUBJECT_BY_SOURCE: Record<string, string> = {
  dokumen: "Dokumen",
  youtube: "YouTube",
  audio: "Audio",
  video: "Video",
  web: "Web",
};

export async function POST(req: NextRequest) {
  const sessionId = String(req.headers.get("x-session-id") ?? "")
    .trim()
    .slice(0, 80);
  const tracker = new ProgressTracker(sessionId || randomUUID());

  try {
    const form = await req.formData();
    const sourceType = String(form.get("sourceType") ?? "");
    const url = String(form.get("url") ?? "").trim();
    const file = form.get("file");
    const userId = String(form.get("userId") ?? "").trim().slice(0, 80);

    // Validasi cepat (hanya yang bisa dicek sebelum kerja berat).
    if (!(sourceType in SUBJECT_BY_SOURCE)) {
      return NextResponse.json(
        { error: "Jenis sumber tidak valid." },
        { status: 400 }
      );
    }
    const isLinkSource = sourceType === "youtube" || sourceType === "web";
    if (isLinkSource && !url) {
      return NextResponse.json(
        { error: "Masukkan link dulu." },
        { status: 400 }
      );
    }

    const prefs: NotePrefs = {
      studyMode: String(form.get("studyMode") ?? "standar") as NotePrefs["studyMode"],
      gayaPenulisan: String(form.get("gayaPenulisan") ?? "Ramah & Santai"),
      bahasa: String(form.get("bahasa") ?? "Bahasa Indonesia"),
      chapterCount: clampChapterCount(form.get("chapterCount") ?? undefined),
    };

    // Baca file ke Buffer SEKARANG (FormData tidak bisa dibaca lagi nanti).
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const upload = file as File;
      if (upload.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          {
            error:
              "File terlalu besar (maksimal 4 MB). Unggah versi ringkas atau gunakan link YouTube/Web.",
          },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await upload.arrayBuffer());
      if (!buffer.length) {
        return NextResponse.json(
          { error: "File yang diunggah kosong." },
          { status: 400 }
        );
      }
      fileBuffer = buffer;
      fileName = upload.name;
    } else if (!isLinkSource) {
      return NextResponse.json(
        { error: "Unggah file dulu." },
        { status: 400 }
      );
    }

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
          const { note } = await processNoteForBackground(
            {
              sourceType,
              url,
              fileBuffer,
              fileName,
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
                title: "Catatan selesai dibuat! 🎉",
                message: `“${note.title}” sudah siap dipelajari.`,
                link: `/dashboard/note/${note.id}`,
              });
            } catch (e) {
              console.warn("[api/notes/process] Notifikasi dilewati:", e);
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
          const msg =
            e instanceof Error
              ? e.message
              : "Terjadi kesalahan saat memproses materi.";
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
    after(() => {
      void executeJob(jobId);
    });

    return NextResponse.json(
      { jobId, status: "queued", message: "Proses berjalan di latar belakang." },
      { status: 202 }
    );
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Terjadi kesalahan saat memproses materi.";
    console.error("[api/notes/process]", e);
    tracker.emit("extract", 100, "Proses gagal.");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
