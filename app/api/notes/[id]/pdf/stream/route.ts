/**
 * GET /api/notes/:id/pdf/stream — Generate PDF dengan ALUR KERJA realtime (SSE).
 *
 * Alur:
 *  1. Node membaca catatan + menyusun struktur dokumen.
 *  2. AI MERAPIKAN konten (lib/pdfEnrich.ts) — markdown mentah diubah menjadi
 *     paragraf dokumen rapi (tanpa emoji/gambar/tabel mentah).
 *  3. Node spawn Python (backend/scripts/generate_pdf.py, reportlab) —
 *     skrip mencetak PROGRESS|<pct>|<pesan> per langkah → diteruskan ke SSE.
 *  4. Skrip mengirim DONE|<base64-pdf> → dikirim ke klien sebagai event done.
 *  5. Fallback: bila Python/reportlab tidak tersedia, pakai pdfkit (Node)
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
import { recordActivity } from "@/lib/progress-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Enrich AI bertahap + render Python: beri ruang cukup (bisa > 60s untuk
// catatan dengan banyak bab).
export const maxDuration = 180;

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

/** Hitung tahap alur kerja dari persen (0-100). */
function stepForPercent(percent: number): number {
  if (percent < 8) return 1; // membaca & menyusun struktur
  if (percent < 30) return 2; // AI merapikan konten
  if (percent < 36) return 3; // python berjalan
  if (percent < 92) return 4; // menulis BAB
  if (percent < 100) return 5; // merender & finalisasi
  return 6; // selesai
}

/** Kirim event progress SSE. */
function emitProgress(controller: ReadableStreamDefaultController<Uint8Array>, percent: number, message: string) {
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

  // Pramuat data catatan di luar stream supaya error 404/500 bisa
  // langsung dibalas sebagai JSON biasa.
  const found = await getNoteWithChunks(id).catch(() => null);
  if (!found) {
    return Response.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
  }
  const note = found.note;
  const title = (note.title || "Rangkuman Materi").replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "rangkuman";
  const filename = `${title}.pdf`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Ditandai true hanya bila PDF benar-benar berhasil dibuat (untuk XP).
      let success = false;
      try {
        // ── Tahap 1: menyusun struktur ──
        emitProgress(controller, 3, "Membaca catatan...");
        emitProgress(controller, 6, "Menyusun struktur dokumen (sampul, pengantar, BAB)...");

        // ── Tahap 2: AI merapikan konten (bukan markdown mentah) ──
        // Mulai di 8% agar pesan "Merapikan konten dengan AI..." muncul di
        // step 2 (bukan tersamar di step 1).
        const enriched = await enrichNoteForPdf(note, (pct, msg) =>
          emitProgress(controller, 8 + pct * 0.22, msg)
        );
        emitProgress(controller, 30, "Konten siap — menyusun dokumen...");

        // ── Tahap 3: Python (reportlab) ──
        const pyBin = findPython();
        const pyScript = findPythonScript();

        if (pyBin && pyScript) {
          emitProgress(controller, 32, "Menjalankan mesin Python (reportlab)...");
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
            }, 45_000);

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
                    // Peta progress python (0-100) ke rentang 32-92 global
                    // (setelah tahap AI merapikan konten).
                    emitProgress(controller, 32 + p * 0.6, msgParts.join("|") || "Menulis...");
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
                reject(new Error(errOut.trim() || `Python keluar dengan kode ${code}.`));
              }
            });

            child.stdin.write(JSON.stringify(enriched));
            child.stdin.end();
          });

          emitProgress(controller, 98, "PDF selesai — menyiapkan unduhan...");
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ base64: pdfBase64, filename })}\n\n`)
          );
          controller.close();
          success = true;
          return;
        }

        // ── Fallback: pdfkit (Node) tanpa Python ──
        if (!pyBin) {
          emitProgress(controller, 34, "Python tidak ditemukan — memakai mesin Node (pdfkit)...");
        } else {
          emitProgress(controller, 34, "Skrip Python tidak ditemukan — memakai mesin Node (pdfkit)...");
        }
        const stages: [number, string][] = [
          [40, "Menyusun halaman sampul..."],
          [50, "Menulis kata pengantar..."],
          [60, "Menyusun daftar isi..."],
          [80, "Menulis BAB..."],
          [92, "Merender dokumen..."],
        ];
        for (const [pct, msg] of stages) {
          emitProgress(controller, pct, msg);
          // Jeda singkat agar alur terasa bertahap.
          await new Promise((r) => setTimeout(r, 250));
        }
        const pdfBuffer = await buildNotePdfBuffer(enriched);
        emitProgress(controller, 98, "PDF selesai — menyiapkan unduhan...");
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ base64: pdfBuffer.toString("base64"), filename })}\n\n`
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
        // Catat aktivitas (XP kecil) hanya bila PDF berhasil dibuat.
        if (success && userId) {
          void recordActivity(userId, 5, "Mengunduh dokumen PDF catatan").catch(() => {});
        }
      }
    },
    cancel() {
      // klien menutup stream
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
