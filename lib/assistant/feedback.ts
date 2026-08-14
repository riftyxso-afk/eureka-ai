/**
 * Helper survey performa Eureka (client-side).
 * Kunci localStorage untuk anti-flash: mencegah modal muncul berulang dalam
 * kunjungan yang sama sebelum respons server (answered) tiba.
 */
export const FEEDBACK_DISMISSED_KEY = "eureka_feedback_dismissed";

/** Baca flag lokal anti-flash. */
export function isFeedbackDismissedLocally(): boolean {
  try {
    return localStorage.getItem(FEEDBACK_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tandai survey sudah ditutup/diisi pada perangkat ini. */
export function markFeedbackDismissedLocally(): void {
  try {
    localStorage.setItem(FEEDBACK_DISMISSED_KEY, "1");
  } catch {
    // localStorage tidak tersedia — abaikan
  }
}