/**
 * GET /api/notes/:id/pdf/stream — Generate PDF dengan ALUR KERJA realtime (SSE).
 *
 * Alur:
 *  1. Node membaca catatan + menyusun struktur dokumen.
 *  2. AI MERAPIKAN konten (lib/pdfEnrich.ts) — markdown mentah diubah menjadi
 *     paragraf dokumen rapi (tanpa emoji/gambar/tabel mentah).
 *  3. (opsional) Bila ?images=1 — kumpulkan gambar (embedded + Firecrawl dari
 *     halaman sumber), pilih gambar relevan per bab (lib/pdfImages.ts).
 *  4. Node spawn Python (backend/scripts/generate_pdf.py, reportlab) — skrip
 *     mencetak PROGRESS|<pct>|<pesan> per langkah → diteruskan ke SSE.
 *  5. Skrip mengirim DONE|<base64-pdf> → dikirim ke klien sebagai event done.
 *  6. Fallback: bila Python/reportlab tidak tersedia, pakai pdfkit (Node)
 *     dengan progress bertahap, lalu kirim base64 yang sama.
 *
 * Protokol SSE (data JSON):
 *  data: { phase, percent, message, step }     → progress
 *  event: done  data: { base64, filename }     → PDF selesai
 */
import { NextRequest } from "next/server";
import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";

import { getNoteWithChunks } from "@/lib/rag/store";
import { buildNotePdfBuffer } from "@/lib/notePdf";
import { enrichNoteForPdf } from "@/lib/pdfEnrich";
import {
  collectImagesForPdf,
  assignImagesToChapters,
  type ChapterImageMap,
} from "@/lib/pdfImages";
import { recordActivity } from "@/lib/progress-store";
import { acquirePdfSlot, releasePdfSlot } from "@/lib/jobQueue";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Enrich AI bertahap + scrape gambar + render Python: beri ruang cukup.
export const maxDuration = 240;

const encoder = new TextEncoder();

// Cache hasil pencarian (biner & skrip tidak berubah antar request).
let pythonCache: string | null | undefined;
let pythonScriptCache: string | null | undefined;

/** Cari biner Python: python3 (Linux) → python (Windows). Hasil di-cache. */
function findPython(): string | null {
  if (pythonCache !== undefined) return pythonCache;
  const candidates =
    process.platform === "win32" ? ["python"] : ["python3", "python"];
  for (const bin of candidates) {
    try {
      const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
      if (r.status === 0) {
        pythonCache = bin;
        return bin;
      }
    } catch {
      // coba biner berikutnya
    }
  }
  pythonCache = null;
  return null;
}

/** Lokasi skrip generate_pdf.py — dicari dari beberapa kemungkinan root, di-cache. */
function findPythonScript(): string | null {
  if (pythonScriptCache !== undefined) return pythonScriptCache;
  const candidates = [
    path.join(process.cwd(), "backend", "scripts", "generate_pdf.py"),
    path.join(process.cwd(), "scripts", "generate_pdf.py"),
    path.join(process.cwd(), "..", "scripts", "generate_pdf.py"),
  ];
  pythonScriptCache = candidates.find((p) => fs.existsSync(p)) ?? null;
  return pythonScriptCache;
}

/**
 * Hitung tahap alur kerja dari persen (0-100).
 * 1 membaca · 2 AI menyusun · 3 mengumpulkan gambar · 4 Python ·
 * 5 menulis BAB · 6 merender · 7 selesai.
 */
function stepForPercent(percent: number): number {
  if (percent < 8) return 1;
  if (percent < 30) return 2;
  if (percent < 40) return 3; // mengumpulkan gambar (dilewati bila ?images=0)
  if (percent < 56) return 4; // Python berjalan
  if (percent < 93) return 5; // menulis BAB
  if (percent < 100) return 6; // merender & finalisasi
  return 7; // selesai
}

/** Kirim event progress SSE. */
function emitProgress(
  controller: ReadableStreamDefaultController<Uint8Array>,
  percent: number,
  message: string
) {
  const payload = JSON.stringify({
    phase: "progress",
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    message,
    step: stepForPercent(percent),
    timestamp: Date.now(),
  });
  try {
    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
  } catch {
    // stream sudah tertutup
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
  const includeImages = req.nextUrl.searchParams.get("images") === "1";

  // Pramuat data catatan di luar stream supaya error 404/500 bisa
  // langsung dibalas sebagai JSON biasa.
  const found = await getNoteWithChunks(id).catch(() => null);
  if (!found) {
    return Response.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
  }
  const note = found.note;
  const title = (note.title || "Rangkuman Materi")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 40) || "rangkuman";
  const filename = `${title}.pdf`;

  // Slot generate (dibebaskan di finally/cancel) — ikut hitung kapasitas
  // serentak global & per-user (proteksi overload, sama seperti generate catatan).
  let slotId: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Ditandai true hanya bila PDF benar-benar berhasil dibuat (untuk XP).
      let success = false;
      try {
        // ── Proteksi overload: rate limit per user + kapasitas serentak. ──
        ensureRateLimitPrune();
        const rl = checkRateLimit(`pdf:${userId}`, 5, 60 * 60 * 1000);
        if (!rl.ok) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error:
                  "Kamu sudah membuat 5 dokumen dalam 1 jam. Tunggu sebentar lalu coba lagi ya 🙏",
              })}\n\n`
            )
          );
          controller.close();
          return;
        }
        slotId = await acquirePdfSlot(userId);
        if (!slotId) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error:
                  "Server sedang sibuk. Coba lagi dalam beberapa menit ya 🙏",
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        // ── Tahap 1: menyusun struktur ──
        emitProgress(controller, 3, "Membaca catatan...");
        emitProgress(controller, 6, "Menyusun struktur dokumen (sampul, pengantar, BAB)...");

        // ── Tahap 2: AI merapikan konten (bukan markdown mentah) ──
        const enriched = await enrichNoteForPdf(note, (pct, msg) =>
          emitProgress(controller, 8 + pct * 0.22, msg)
        );
        emitProgress(controller, 29, "Konten siap — menyusun dokumen...");

        // ── Tahap 2b (opsional): kumpulkan & pilih gambar ──
        let chapterImages: ChapterImageMap[] = [];
        if (includeImages) {
          try {
            emitProgress(controller, 31, "Mengumpulkan gambar ilustrasi...");
            const images = await collectImagesForPdf(note, (pct, msg) =>
              emitProgress(controller, 31 + pct * 0.07, msg)
            );
            if (images.length > 0) {
              emitProgress(controller, 36, "Memilih gambar untuk tiap bab...");
              chapterImages = assignImagesToChapters(
                enriched.chapters,
                images,
                (pct, msg) => emitProgress(controller, 36 + pct * 0.03, msg)
              );
            }
            emitProgress(
              controller,
              39,
              chapterImages.length > 0
                ? `Gambar siap (${chapterImages.length} bab) — mulai mencetak...`
                : "Tanpa gambar tersedia — melanjutkan mencetak..."
            );
          } catch (e) {
            console.warn("[pdf/stream] Tahap gambar dilewati:", e);
            emitProgress(controller, 40, "Gambar dilewati — melanjutkan mencetak...");
          }
        }

        // Payload akhir: konten dokumen + gambar pilihan per bab.
        const payload = { ...enriched, images: chapterImages };

        // ── Tahap 3: Python (reportlab) ──
        const pyBin = findPython();
        const pyScript = findPythonScript();

        if (pyBin && pyScript) {
          emitProgress(controller, 42, "Menjalankan mesin Python (reportlab)...");
          const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const child = spawn(pyBin, [pyScript], {
              stdio: ["pipe", "pipe", "pipe"],
              windowsHide: true,
            });
            let out = "";
            let errOut = "";
            let resolved = false;

            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                child.kill();
                reject(new Error("Waktu tunggu Python habis."));
              }
            }, 60_000);

            child.stdout.on("data", (chunk: Buffer) => {
              const text = chunk.toString("utf8");
              out += text;
              // Proses baris per baris (progress / done)
              const lines = out.split("\n");
              out = lines.pop() ?? "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith("PROGRESS|")) {
                  const [, pct, ...msgParts] = trimmed.split("|");
                  const p = Number(pct);
                  if (Number.isFinite(p)) {
                    // Peta progress python (0-100) ke rentang 42-98 global
                    // (setelah tahap AI + gambar).
                    emitProgress(
                      controller,
                      42 + p * 0.56,
                      msgParts.join("|") || "Menulis..."
                    );
                  }
                } else if (trimmed.startsWith("DONE|")) {
                  resolved = true;
                  clearTimeout(timeout);
                  resolve(trimmed.slice(5));
                }
              }
            });
            child.stderr.on("data", (chunk: Buffer) => {
              errOut += chunk.toString("utf8");
            });
            child.on("error", (e) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(e);
              }
            });
            child.on("close", (code) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(
                  new Error(errOut.trim() || `Python keluar dengan kode ${code}.`)
                );
              }
            });

            child.stdin.write(JSON.stringify(payload));
            child.stdin.end();
          });

          emitProgress(controller, 98, "PDF selesai — menyiapkan unduhan...");
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ base64: pdfBase64, filename })}\n\n`
            )
          );
          controller.close();
          success = true;
          return;
        }

        // ── Fallback: pdfkit (Node) tanpa Python ──
        if (!pyBin) {
          emitProgress(controller, 44, "Python tidak ditemukan — memakai mesin Node (pdfkit)...");
        } else {
          emitProgress(controller, 44, "Skrip Python tidak ditemukan — memakai mesin Node (pdfkit)...");
        }
        const stages: [number, string][] = [
          [50, "Menyusun halaman sampul..."],
          [58, "Menulis kata pengantar..."],
          [64, "Menyusun daftar isi..."],
          [74, "Menulis BAB..."],
          [90, "Merender dokumen..."],
        ];
        for (const [pct, msg] of stages) {
          emitProgress(controller, pct, msg);
          // Jeda singkat agar alur terasa bertahap.
          await new Promise((r) => setTimeout(r, 250));
        }
        const pdfBuffer = await buildNotePdfBuffer(payload);
        emitProgress(controller, 98, "PDF selesai — menyiapkan unduhan...");
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              base64: pdfBuffer.toString("base64"),
              filename,
            })}\n\n`
          )
        );
        controller.close();
        success = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal membuat PDF.";
        try {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`)
          );
        } catch {
          // abaikan
        }
        controller.close();
        // Jangan catat XP bila gagal (success sudah false di sini).
      } finally {
        // Lepas slot generate (ikut hitung kapasitas global/per-user).
        if (slotId) {
          void releasePdfSlot(slotId, success).catch(() => {});
          slotId = null;
        }
        // Catat aktivitas (XP kecil) hanya bila PDF berhasil dibuat.
        if (success && userId) {
          void recordActivity(userId, 5, "Mengunduh dokumen PDF catatan").catch(() => {});
        }
      }
    },
    cancel() {
      // klien menutup stream di tengah jalan → bebas slot agar tidak macet.
      if (slotId) {
        void releasePdfSlot(slotId, false).catch(() => {});
        slotId = null;
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
