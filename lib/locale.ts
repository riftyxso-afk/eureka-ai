/**
 * Helper bahasa server-side — memetakan header `x-locale` (id/en) yang
 * dikirim apiClient ke nama bahasa untuk prompt AI.
 *
 * Header x-locale diset middleware (berdasarkan geo IP) lalu diteruskan
 * apiClient → backend. Route memakai `languageFromRequest(req)` untuk
 * mengisi `prefs.bahasa` / prompt AI agar konten mengikuti bahasa user.
 */
import type { NextRequest } from "next/server";

export type AiLanguage = "Bahasa Indonesia" | "English";

/** Header x-locale → nama bahasa untuk prompt AI (default: Indonesia). */
export function localeToAiLanguage(locale: string | null | undefined): AiLanguage {
  return locale === "en" ? "English" : "Bahasa Indonesia";
}

/** Baca bahasa AI dari header x-locale request (default: Indonesia). */
export function languageFromRequest(req: NextRequest): AiLanguage {
  return localeToAiLanguage(req.headers.get("x-locale"));
}
