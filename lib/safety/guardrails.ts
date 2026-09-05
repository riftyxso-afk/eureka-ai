/**
 * Orkestrator guardrails: gabungkan NIM + heuristik lokal + circuit breaker.
 *
 * Alur guardInput(text):
 *  1. Heuristik lokal dulu (gratis, <1ms): jailbreak → blokir langsung.
 *  2. Bila NIM tersedia & breaker tertutup: checkContentSafety + checkJailbreak
 *     + checkTopic paralel → gabungkan hasil.
 *  3. Bila NIM tidak tersedia / breaker terbuka: heuristik penuh + log fallback.
 *
 * Alur guardOutput(text): cek moderasi + PII; PII → scrub (bukan blokir);
 * konten unsafe → blokir (pemanggil mengganti dengan SAFETY_REFUSAL_ID).
 *
 * Circuit breaker: setelah 3 gagal beruntun, buka 60 detik (hanya heuristik).
 */
import {
  SAFETY_BLOCK_THRESHOLD,
  SAFETY_REFUSAL_ID,
  isNvidiaNimConfigured,
} from "./safety-config";
import {
  checkContentSafety,
  checkJailbreak,
  checkTopic,
  type NimSafetyResult,
} from "./nvidia-nim";
import {
  detectJailbreakHeuristic,
  detectPiiHeuristic,
  isOffTopicHeuristic,
  scrubPii,
} from "./patterns";
import {
  countInputCheck,
  countOutputCheck,
  logSafetyEvent,
} from "./safety-log";

export interface GuardVerdict {
  allowed: boolean;
  /** Teks yang sudah di-scrub (untuk output yang lolos dengan PII). */
  text: string;
  categories: NimSafetyResult["categories"];
  source: "nim" | "heuristic" | "mixed";
  /** True bila permintaan normal harus diarahkan ulang ke topik edukasi. */
  topicRedirect: boolean;
}

/* ── Circuit breaker (in-memory, per proses) ── */
const BREAKER_FAIL_LIMIT = 3;
const BREAKER_COOLDOWN_MS = 60_000;
let breakerFailures = 0;
let breakerOpenedAt = 0;

function breakerOpen(): boolean {
  if (breakerFailures < BREAKER_FAIL_LIMIT) return false;
  if (Date.now() - breakerOpenedAt > BREAKER_COOLDOWN_MS) {
    breakerFailures = 0;
    return false;
  }
  return true;
}

function breakerRecord(ok: boolean): void {
  if (ok) {
    breakerFailures = 0;
  } else {
    breakerFailures++;
    if (breakerFailures >= BREAKER_FAIL_LIMIT) breakerOpenedAt = Date.now();
  }
}

export function isNimBreakerOpen(): boolean {
  return breakerOpen();
}

function shouldUseNim(): boolean {
  return isNvidiaNimConfigured() && !breakerOpen();
}

/** Cek input user SEBELUM dikirim ke LLM. */
export async function guardInput(text: string): Promise<GuardVerdict> {
  countInputCheck();
  const clean = text.slice(0, 4000);

  // Lapisan 1: heuristik lokal (selalu jalan).
  if (detectJailbreakHeuristic(clean)) {
    logSafetyEvent({
      type: "jailbreak-detected",
      severity: "high",
      categories: ["jailbreak"],
      snippet: clean,
      source: "heuristic",
    });
    return { allowed: false, text: clean, categories: ["jailbreak"], source: "heuristic", topicRedirect: false };
  }
  const topicLocal = isOffTopicHeuristic(clean);
  if (topicLocal.decided && topicLocal.offTopic) {
    logSafetyEvent({
      type: "topic-redirect",
      severity: "low",
      categories: ["off-topic"],
      snippet: clean,
      source: "heuristic",
    });
    return { allowed: true, text: clean, categories: ["off-topic"], source: "heuristic", topicRedirect: true };
  }

  // Lapisan 2: NIM (bila tersedia & breaker tertutup).
  if (!shouldUseNim()) {
    if (isNvidiaNimConfigured() && breakerOpen()) {
      logSafetyEvent({ type: "nim-fallback", severity: "medium", categories: [], snippet: "", source: "system" });
    }
    return { allowed: true, text: clean, categories: [], source: "heuristic", topicRedirect: false };
  }

  const [mod, jb, topic] = await Promise.all([
    checkContentSafety(clean),
    checkJailbreak(clean),
    checkTopic(clean),
  ]);
  const nimOk = mod.ok && jb.ok;
  breakerRecord(nimOk);
  if (!nimOk) {
    logSafetyEvent({ type: "nim-error", severity: "medium", categories: [], snippet: "", source: "system" });
    return { allowed: true, text: clean, categories: [], source: "heuristic", topicRedirect: false };
  }

  const cats = [...new Set([...mod.categories, ...jb.categories, ...topic.categories])];
  // Jailbreak-check hanya memblokir bila kategorinya memang injeksi —
  // model safety bisa menilai UNSAFE untuk alasan lain (mis. topik kekerasan
  // dalam pertanyaan edukasi) yang sudah ditangani moderasi (mod), bukan jb.
  const INJECTION_CATS = new Set(["jailbreak", "prompt-injection"]);
  const jbBlocks =
    !jb.safe && jb.categories.some((c) => INJECTION_CATS.has(c)) &&
    jb.confidence >= SAFETY_BLOCK_THRESHOLD;
  const blocked =
    (!mod.safe && mod.confidence >= SAFETY_BLOCK_THRESHOLD) || jbBlocks;
  if (blocked) {
    logSafetyEvent({
      type: "input-blocked",
      severity: "high",
      categories: cats,
      snippet: clean,
      source: "nim",
    });
    return { allowed: false, text: clean, categories: cats, source: "nim", topicRedirect: false };
  }
  const redirect = !topic.safe && topic.categories.includes("off-topic");
  if (redirect) {
    logSafetyEvent({ type: "topic-redirect", severity: "low", categories: ["off-topic"], snippet: clean, source: "mixed" });
  }
  return { allowed: true, text: clean, categories: cats, source: "mixed", topicRedirect: redirect };
}

/**
 * Cek output AI SETELAH LLM selesai.
 * PII → scrub (lolos dengan teks bersih). Unsafe → blokir (pemanggil
 * mengganti konten tersimpan dengan SAFETY_REFUSAL_ID).
 */
export async function guardOutput(text: string): Promise<GuardVerdict> {
  countOutputCheck();
  const clean = text.slice(0, 8000);

  const pii = detectPiiHeuristic(clean);
  let out = clean;
  let scrubbed = false;
  if (pii.length > 0) {
    out = scrubPii(clean);
    scrubbed = true;
    logSafetyEvent({
      type: "output-scrubbed",
      severity: "medium",
      categories: ["pii"],
      snippet: clean,
      source: "heuristic",
    });
  }

  if (!shouldUseNim()) {
    if (isNvidiaNimConfigured() && breakerOpen()) {
      logSafetyEvent({ type: "nim-fallback", severity: "medium", categories: [], snippet: "", source: "system" });
    }
    return {
      allowed: true,
      text: out,
      categories: scrubbed ? ["pii"] : [],
      source: "heuristic",
      topicRedirect: false,
    };
  }

  const [mod, jb] = await Promise.all([checkContentSafety(out), checkJailbreak(out)]);
  const nimOk = mod.ok && jb.ok;
  breakerRecord(nimOk);
  if (!nimOk) {
    logSafetyEvent({ type: "nim-error", severity: "medium", categories: [], snippet: "", source: "system" });
    return { allowed: true, text: out, categories: scrubbed ? ["pii"] : [], source: "heuristic", topicRedirect: false };
  }

  const cats = [...new Set([...(scrubbed ? (["pii"] as const) : []), ...mod.categories, ...jb.categories])];
  // jb hanya blokir utk kategori injeksi (lihat alasan di guardInput).
  const INJECTION_CATS = new Set(["jailbreak", "prompt-injection"]);
  const jbBlocks =
    !jb.safe && jb.categories.some((c) => INJECTION_CATS.has(c)) &&
    jb.confidence >= SAFETY_BLOCK_THRESHOLD;
  const blocked =
    (!mod.safe && mod.confidence >= SAFETY_BLOCK_THRESHOLD) || jbBlocks;
  if (blocked) {
    logSafetyEvent({ type: "output-blocked", severity: "high", categories: cats, snippet: out, source: "nim" });
    return { allowed: false, text: SAFETY_REFUSAL_ID, categories: cats, source: "nim", topicRedirect: false };
  }
  return { allowed: true, text: out, categories: cats, source: "mixed", topicRedirect: false };
}

export { SAFETY_REFUSAL_ID };
