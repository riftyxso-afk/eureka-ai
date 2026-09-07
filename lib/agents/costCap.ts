/**
 * Cap biaya harian per user — dua bucket terpisah (PRD §10):
 * - "loop"  : seluruh pemanggilan agent dalam Mode Eureka Multi Agent.
 * - "astra" : panggilan model Astra untuk Solve-then-Guide (mahal).
 *
 * Pengukuran memakai agent_call_logs (lihat loopStore.checkDailyCostCap).
 * Fungsi di sini hanya util estimasi + alias agar route lebih terbaca.
 */

export function estimateTokens(text: string, defaultOutput = 500): number {
  if (!text) return defaultOutput;
  // Estimasi kasar: ~4 karakter per token (cukup untuk cap guard, bukan billing).
  return Math.ceil(text.length / 4) + defaultOutput;
}

export { checkDailyCostCap } from "./loopStore";
