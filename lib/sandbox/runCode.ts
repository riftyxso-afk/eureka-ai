/**
 * Sandbox eksekusi kode (PRD §8) — interface `runCode` dengan adaptor E2B.
 *
 * Requirement (PRD §8.1):
 * - Isolasi: container/microVM terpisah per eksekusi (E2B Firecracker),
 *   tidak berbagi filesystem/network dengan service utama.
 * - Network: E2B sandbox default TANPA akses jaringan kecuali diizinkan
 *   eksplisit di template — kita tidak mengizinkan.
 * - Resource limit: timeout & memory configurable via env
 *   (SANDBOX_TIMEOUT_SECONDS default 10, SANDBOX_MEMORY_MB default 256).
 * - Ephemeral: sandbox DIHANCURKAN di `finally` setiap eksekusi.
 * - Whitelist bahasa: SANDBOX_LANGUAGES (default "python").
 *
 * SDK `e2b` diimpor secara dinamis: bila belum terpasang / key kosong,
 * pemanggil menerima SandboxUnavailableError (terstruktur, bukan hang).
 */

export interface RunCodeOptions {
  language?: string;
  timeoutSeconds?: number;
  /** Override memory MB (configurable; dipetakan ke E2B template limit). */
  memoryMb?: number;
}

export interface RunCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** true bila eksekusi dihentikan karena melewati batas timeout. */
  timedOut: boolean;
  durationMs: number;
}

/** Error terstruktur bila sandbox tidak tersedia (key/SDK/kuota). */
export class SandboxUnavailableError extends Error {
  readonly reason: "no_api_key" | "sdk_missing" | "provider_error";
  constructor(reason: "no_api_key" | "sdk_missing" | "provider_error", detail?: string) {
    super(
      reason === "no_api_key"
        ? "Sandbox eksekusi kode belum dikonfigurasi (E2B_API_KEY kosong)."
        : reason === "sdk_missing"
          ? "SDK sandbox (e2b) belum terpasang di server."
          : `Sandbox tidak tersedia: ${detail ?? "provider error"}`
    );
    this.name = "SandboxUnavailableError";
    this.reason = reason;
  }
}

/** Error bahasa di luar whitelist (PRD §8.1 — whitelist configurable). */
export class SandboxLanguageNotAllowedError extends Error {
  readonly language: string;
  readonly allowed: string[];
  constructor(language: string, allowed: string[]) {
    super(
      `Bahasa "${language}" tidak tersedia di sandbox. Yang tersedia: ${allowed.join(", ")}.`
    );
    this.name = "SandboxLanguageNotAllowedError";
    this.language = language;
    this.allowed = allowed;
  }
}

/** Whitelist bahasa dari env (default Python saja — PRD §8.1). */
export function sandboxLanguages(): string[] {
  return (process.env.SANDBOX_LANGUAGES ?? "python")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function sandboxTimeoutSeconds(): number {
  const v = Number(process.env.SANDBOX_TIMEOUT_SECONDS);
  return Number.isFinite(v) && v >= 1 && v <= 60 ? Math.round(v) : 10;
}

export function sandboxMemoryMb(): number {
  const v = Number(process.env.SANDBOX_MEMORY_MB);
  return Number.isFinite(v) && v >= 128 && v <= 4096 ? Math.round(v) : 256;
}

/**
 * Jalankan kode di sandbox ephemeral. SATU panggilan = SATU sandbox yang
 * dihancurkan setelah selesai — tidak ada state antar eksekusi.
 */
export async function runCode(
  code: string,
  opts: RunCodeOptions = {}
): Promise<RunCodeResult> {
  const language = (opts.language ?? "python").toLowerCase();
  const allowed = sandboxLanguages();
  if (!allowed.includes(language)) {
    throw new SandboxLanguageNotAllowedError(language, allowed);
  }

  if (!process.env.E2B_API_KEY) {
    throw new SandboxUnavailableError("no_api_key");
  }

  // Dynamic import: build tetap sehat bila SDK belum di-install.
  let Sandbox: new (opts: Record<string, unknown>) => {
    runCode: (code: string, opts: Record<string, unknown>) => Promise<{
      text?: string;
      results?: { text?: string; stdout?: string }[];
      logs?: { stdout: string[]; stderr: string[] };
      error?: { name?: string; value?: string; traceback?: string } | null;
      executionCount?: number;
    }>;
    kill: () => Promise<void>;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await (import(/* webpackIgnore: true */ "e2b" as string) as Promise<any>);
    Sandbox = mod.Sandbox ?? mod.default?.Sandbox;
    if (!Sandbox) throw new Error("Sandbox class tidak ditemukan di paket e2b");
  } catch {
    throw new SandboxUnavailableError("sdk_missing");
  }

  const timeoutSec = opts.timeoutSeconds ?? sandboxTimeoutSeconds();
  const memoryMb = opts.memoryMb ?? sandboxMemoryMb();
  const started = Date.now();

  const sandbox = new Sandbox({
    // E2B: timeout dalam MS; memory MB diteruskan bila template mendukung.
    timeoutMs: timeoutSec * 1000,
    memoryLimitMb: memoryMb,
  });

  try {
    const exec = await sandbox.runCode(code, { language, timeoutMs: timeoutSec * 1000 });
    const logs = exec.logs ?? { stdout: [], stderr: [] };
    const resultText =
      exec.text ??
      exec.results?.map((r: { text?: string; stdout?: string }) => r.text ?? r.stdout ?? "").join("\n") ??
      "";
    const stdout = [...logs.stdout, resultText].filter(Boolean).join("\n");
    const stderr = [...logs.stderr].join("\n");
    const err = exec.error;
    const stderrFull = err?.traceback
      ? `${stderr}\n${err.name ?? "Error"}: ${err.value ?? ""}\n${err.traceback}`
      : stderr;

    return {
      stdout,
      stderr: stderrFull.trim(),
      exitCode: err ? 1 : 0,
      timedOut: false,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // E2B melempar pesan timeout — petakan ke timedOut agar pemanggil
    // bisa membedakan gagal-eksekusi vs limit-terlampaui.
    if (/timeout|timed out/i.test(msg)) {
      return {
        stdout: "",
        stderr: `Eksekusi dihentikan karena melewati batas waktu ${timeoutSec} detik.`,
        exitCode: 124,
        timedOut: true,
        durationMs: Date.now() - started,
      };
    }
    throw new SandboxUnavailableError("provider_error", msg);
  } finally {
    // EPHEMERAL: hancurkan sandbox apa pun yang terjadi (PRD §8.1).
    try {
      await sandbox.kill();
    } catch {
      // sudah mati — abaikan
    }
  }
}
