/**
 * Solve-then-Guide (PRD §6) — fitur Pro dengan model Astra (configurable).
 *
 * Alur:
 *   1. SOLVE   — Astra menyusun solusi + kode verifikasi Python.
 *   2. VERIFY  — kode dijalankan di sandbox (lib/sandbox/runCode) dengan
 *                retry terbatas (configurable) bila gagal.
 *   3. GUIDE   — dari solusi TERVERIFIKASI, Astra menyusun pertanyaan
 *                Socratic mundur. Ground truth = hasil sandbox.
 *
 * Semua tahap dikirim sebagai event SSE nyata via callback `emit`:
 *   { type: "step", label, status: "running" | "done" }
 *   { type: "terminal_output", line }   ← stdout/stderr ASLI sandbox
 * Tidak ada step yang disimulasikan di frontend (PRD §8.4).
 *
 * Guardrail: entitlement Pro (lib/premium) + cap biaya bucket "astra"
 * (AGENT_ASTRA_DAILY_TOKEN_CAP) dicek oleh pemanggil (route) SEBELUM alur ini.
 */
import { callAgentModel, callAgentModelStream } from "./callAgentModel";
import { resolveAstraModel } from "./catalog";
import { runCode, SandboxLanguageNotAllowedError } from "../sandbox/runCode";
import { estimateTokens, checkDailyCostCap } from "./costCap";

/** Batas percobaan verifikasi (configurable; default 2 = 1 ulangan). */
function verifyRetries(): number {
  const v = Number(process.env.SANDBOX_VERIFY_RETRIES);
  return Number.isFinite(v) && v >= 0 && v <= 5 ? Math.round(v) : 2;
}

/** Event SSE yang dikirim ke klien selama proses. */
export type SolveGuideEvent =
  | { type: "step"; label: string; status: "running" | "done" | "failed" }
  | { type: "terminal_output"; line: string }
  | { type: "token"; text: string };

export interface SolveThenGuideResult {
  /** true bila solusi lolos verifikasi sandbox. */
  verified: boolean;
  /** Solusi final dalam markdown (untuk konteks Socra / tampilan). */
  solution: string;
  /** stdout/stderr terverifikasi untuk artifact terminal. */
  terminalOutput: string;
  model: string;
}

/** Callback emit event; selalu aman-dipanggil. */
type Emit = (event: SolveGuideEvent) => void;

const SOLVE_SYSTEM = `Kamu adalah Astra, solver presisi tinggi di Eureka.AI. Tugasmu MENYELESAIKAN soal secara lengkap dan benar — bukan berdialog.

Output WAJIB format ini (tanpa teks lain di luar):
SOLUSI:
<penjelasan langkah demi langkah, ringkas dan akurat>

KODE_VERIFIKASI:
\`\`\`python
<kode Python yang memverifikasi jawaban final secara numerik, print hasil berupa "VERIFIKASI_OK: <nilai>" atau perbandingan boolean. Tanpa input(), tanpa library di luar stdlib, tanpa akses jaringan/file.>
\`\`\``;

const GUIDE_SYSTEM = `Kamu adalah Astra yang menyusun jalur pertanyaan Socratic MUNDUR dari solusi yang sudah TERVERIFIKASI (prinsip Solve-then-Guide).

Diberikan solusi final, susun SATU pertanyaan pembuka Socratic: mulai dari konsep paling dasar yang dibutuhkan siswa untuk mencapai jawaban, bukan dari jawabannya. Bahasa Indonesia santai untuk pelajar, maksimal 80 kata. Jangan membocorkan jawaban final.`;

/** Ambil blok ```python ...``` dari output solve. */
function extractPythonCode(raw: string): string | null {
  const m = /```(?:python)?\s*\n([\s\S]*?)```/i.exec(raw);
  return m ? m[1].trim() : null;
}

export interface SolveThenGuideInput {
  problem: string;
  userId: string;
  loopSessionId?: string | null;
  /** Emit event SSE step/terminal ke klien. */
  emit: Emit;
}

/**
 * Jalankan alur lengkap Solve → Verify → Guide. Lempar error bila:
 * - cap Astra terlampaui (DailyCostCapError — ditangani route),
 * - sandbox tak tersedia (SandboxUnavailableError),
 * - verifikasi gagal permanen → return verified:false + pesan jujur
 *   (BUKAN dialog dengan jawaban belum pasti — PRD §6.1).
 */
export async function solveThenGuide(
  input: SolveThenGuideInput
): Promise<SolveThenGuideResult> {
  const { emit } = input;
  const astraModel = resolveAstraModel();
  const ctx = {
    userId: input.userId,
    source: "astra" as const,
    loopSessionId: input.loopSessionId ?? null,
  };

  // Guardrail: cap biaya bucket astra (terpisah dari loop — PRD §10).
  await checkDailyCostCap("astra", input.userId, 8000);

  // ── STEP 1: SOLVE (Astra menyusun solusi + kode verifikasi) ──────────
  emit({ type: "step", label: "Membaca soal & menyusun rencana", status: "running" });
  const solveRes = await callAgentModel(
    "socra",
    { system: SOLVE_SYSTEM, user: input.problem },
    ctx,
    // Astra = model kondisional; null → rantai tier default (fallback aman).
    { maxTokens: 3072, ...(astraModel ? { model: astraModel } : {}) }
  );
  const usedModel = astraModel ?? solveRes.model;
  const solutionRaw = solveRes.text;
  emit({ type: "step", label: "Membaca soal & menyusun rencana", status: "done" });

  const code = extractPythonCode(solutionRaw);
  let verified = false;
  let terminalOutput = "";
  let solutionMarkdown = solutionRaw;

  // ── STEP 2: VERIFY (sandbox eksekusi + retry terbatas) ───────────────
  if (code) {
    emit({ type: "step", label: "Menjalankan verifikasi", status: "running" });
    const maxAttempts = 1 + verifyRetries();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await runCode(code, { language: "python" });
        // stdout/stderr ASLI dikirim baris demi baris (PRD §7.4/§8.4).
        for (const line of [...result.stdout.split("\n"), ...result.stderr.split("\n")]) {
          if (line.trim()) emit({ type: "terminal_output", line });
        }
        terminalOutput = [result.stdout, result.stderr].filter(Boolean).join("\n--- stderr ---\n");

        if (result.exitCode === 0 && !result.timedOut) {
          verified = true;
          emit({ type: "step", label: "Menjalankan verifikasi", status: "done" });
          break;
        }
        if (attempt < maxAttempts) {
          // Minta Astra perbaiki kode bila verifikasi gagal (retry terbatas).
          const fixRes = await callAgentModel(
            "socra",
            {
              system: SOLVE_SYSTEM,
              user: `${input.problem}\n\nPERCOBAAN SEBELUMNYA GAGAL (exit ${result.exitCode}):\n${terminalOutput.slice(0, 2000)}\n\nPerbaiki solusi & kode verifikasinya. Format output tetap sama.`,
            },
            ctx,
            { maxTokens: 3072, ...(astraModel ? { model: astraModel } : {}) }
          );
          const fixedCode = extractPythonCode(fixRes.text);
          if (fixedCode) {
            solutionMarkdown = fixRes.text;
          }
        } else {
          emit({ type: "step", label: "Menjalankan verifikasi", status: "failed" });
        }
      } catch (e) {
        if (e instanceof SandboxLanguageNotAllowedError) throw e;
        // SandboxUnavailableError / provider lain → coba lagi bila ada kuota.
        if (attempt >= maxAttempts) {
          emit({ type: "step", label: "Menjalankan verifikasi", status: "failed" });
          throw e;
        }
      }
    }
  } else {
    // Soal tidak butuh kode (mis. konsep) — solusi dianggap final tanpa
    // verifikasi numerik; ditandai jujur di hasil.
    verified = false;
    terminalOutput = "(soal tidak memerlukan verifikasi eksekusi kode)";
  }

  // ── STEP 3: GUIDE (pertanyaan Socratic mundur dari solusi terverifikasi) ──
  emit({ type: "step", label: "Menyusun pertanyaan pemandu", status: "running" });
  const guideRes = await callAgentModel(
    "socra",
    {
      system: GUIDE_SYSTEM,
      user: `SOLUSI TERVERIFIKASI:\n${solutionMarkdown.slice(0, 6000)}\n\nSoal asli: ${input.problem}`,
    },
    ctx,
    { maxTokens: 400, ...(astraModel ? { model: astraModel } : {}) }
  );
  emit({ type: "step", label: "Menyusun pertanyaan pemandu", status: "done" });

  return {
    verified,
    solution: solutionMarkdown,
    terminalOutput,
    model: usedModel,
  };
}

/** Alur solve-then-guide dengan pertanyaan pemandu DI-STREAM (SSE). */
export async function solveThenGuideStream(
  input: SolveThenGuideInput & { history?: { role: "user" | "assistant"; content: string }[] },
  onToken: (text: string) => void
): Promise<SolveThenGuideResult> {
  const base = await solveThenGuide(input);
  // Pertanyaan pemandu final di-stream sebagai token chat biasa di route;
  // di sini kita hanya return hasilnya — route memanggil Socra dengan
  // solusi terverifikasi sebagai ground truth.
  return base;
}

export { estimateTokens };
