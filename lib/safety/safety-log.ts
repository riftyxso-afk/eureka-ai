/**
 * Safety event log + metrik (in-memory).
 *
 * Catatan: di serverless, memori reset antar cold start — cukup untuk
 * monitoring operasional; untuk audit jangka panjang, hubungkan ke
 * tabel Supabase (di luar cakupan MVP ini).
 */
import { scrubPii } from "./patterns";
import type { SafetyCategory } from "./safety-config";

export type SafetyEventType =
  | "input-blocked"
  | "output-blocked"
  | "output-scrubbed"
  | "topic-redirect"
  | "nim-error"
  | "nim-fallback"
  | "jailbreak-detected";

export type SafetySeverity = "low" | "medium" | "high";

export interface SafetyEvent {
  at: string;
  type: SafetyEventType;
  severity: SafetySeverity;
  categories: SafetyCategory[];
  /** Penggalan konteks yang sudah di-scrub PII (maks 200 char). */
  snippet: string;
  source: "nim" | "heuristic" | "mixed" | "system";
}

export interface SafetyMetrics {
  totalInputChecks: number;
  totalOutputChecks: number;
  blockedInputs: number;
  blockedOutputs: number;
  scrubbedOutputs: number;
  jailbreakDetections: number;
  topicRedirects: number;
  nimErrors: number;
  nimFallbacks: number;
  byCategory: Partial<Record<SafetyCategory, number>>;
}

const MAX_EVENTS = 200;
const events: SafetyEvent[] = [];

const metrics: SafetyMetrics = {
  totalInputChecks: 0,
  totalOutputChecks: 0,
  blockedInputs: 0,
  blockedOutputs: 0,
  scrubbedOutputs: 0,
  jailbreakDetections: 0,
  topicRedirects: 0,
  nimErrors: 0,
  nimFallbacks: 0,
  byCategory: {},
};

export function logSafetyEvent(e: Omit<SafetyEvent, "at" | "snippet"> & { snippet?: string }): void {
  const snippet = scrubPii(String(e.snippet ?? "")).slice(0, 200);
  events.unshift({ ...e, snippet, at: new Date().toISOString() });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;

  for (const c of e.categories) {
    metrics.byCategory[c] = (metrics.byCategory[c] ?? 0) + 1;
  }
  switch (e.type) {
    case "input-blocked": metrics.blockedInputs++; break;
    case "output-blocked": metrics.blockedOutputs++; break;
    case "output-scrubbed": metrics.scrubbedOutputs++; break;
    case "topic-redirect": metrics.topicRedirects++; break;
    case "nim-error": metrics.nimErrors++; break;
    case "nim-fallback": metrics.nimFallbacks++; break;
    // Jailbreak = input yang diblokir → hitung di kedua metrik.
    case "jailbreak-detected": metrics.jailbreakDetections++; metrics.blockedInputs++; break;
  }
}

export function countInputCheck(): void {
  metrics.totalInputChecks++;
}

export function countOutputCheck(): void {
  metrics.totalOutputChecks++;
}

export function getSafetyMetrics(): SafetyMetrics {
  return { ...metrics, byCategory: { ...metrics.byCategory } };
}

export function getSafetyEvents(limit = 50): SafetyEvent[] {
  return events.slice(0, Math.min(limit, MAX_EVENTS));
}

export function resetSafetyMetrics(): void {
  Object.assign(metrics, {
    totalInputChecks: 0,
    totalOutputChecks: 0,
    blockedInputs: 0,
    blockedOutputs: 0,
    scrubbedOutputs: 0,
    jailbreakDetections: 0,
    topicRedirects: 0,
    nimErrors: 0,
    nimFallbacks: 0,
    byCategory: {},
  });
  events.length = 0;
}
