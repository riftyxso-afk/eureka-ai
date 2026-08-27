/**
 * Kosakata KANONIK jenjang & kelas — dipakai onboarding dan profil agar
 * nilai yang tersimpan selalu konsisten (enum mesin, bukan label tampilan).
 * Sumber opsi jenjang→kelas: lib/onboardingContent.ts (gradeOptionsFor).
 */
import { EDUCATION_OPTIONS, gradeOptionsFor } from "@/lib/onboardingContent";

/** Semua nilai kelas/semester yang valid dalam kosakata kanonik. */
export const ALL_GRADE_VALUES: string[] = Array.from(
  new Set(
    EDUCATION_OPTIONS.map((e) => e.value).flatMap((edu) =>
      gradeOptionsFor(edu).map((g) => g.value)
    )
  )
);

/**
 * Pemetaan nilai lama bergaya label (dipakai select profil versi lama)
 * → enum kanonik. Normalisasi baca-saja: data lama tidak perlu dimigrasi.
 */
const LEGACY_LABEL_MAP: Record<string, string> = {
  "10 sma": "kelas_10",
  "11 sma": "kelas_11",
  "12 sma": "kelas_12",
  mahasiswa: "semester_1",
  smk: "kelas_10",
};

/**
 * Normalisasi nilai grade apa pun (enum baru atau label lama) → enum kanonik.
 * Mengembalikan null bila kosong/tak dikenal — pemanggil memutuskan fallback.
 */
export function normalizeGrade(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (ALL_GRADE_VALUES.includes(v)) return v;
  const mapped = LEGACY_LABEL_MAP[v.toLowerCase()];
  return mapped ?? null;
}

/** Label tampilan untuk enum kanonik (mis. "kelas_10" → "Kelas 10"). */
export function gradeLabel(value?: string | null): string {
  const v = normalizeGrade(value);
  if (!v) return "";
  for (const edu of EDUCATION_OPTIONS.map((e) => e.value)) {
    const hit = gradeOptionsFor(edu).find((g) => g.value === v);
    if (hit) return hit.label;
  }
  return v;
}

/** Inferensi jenjang pendidikan dari nilai kelas kanonik. */
export function educationForGrade(value?: string | null): string | null {
  const v = normalizeGrade(value);
  if (!v) return null;
  if (v.startsWith("kelas_")) {
    const n = Number(v.slice("kelas_".length));
    if (n >= 1 && n <= 6) return "sd";
    if (n >= 7 && n <= 9) return "smp";
    if (n >= 10 && n <= 12) return "sma";
    return null;
  }
  if (v.startsWith("semester_")) return "mahasiswa";
  if (["pemula", "menengah", "lanjut"].includes(v)) return "lainnya";
  return null;
}
