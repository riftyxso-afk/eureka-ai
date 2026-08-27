/**
 * Palet aksen mata pelajaran — SATU SUMBER KEBENARAN warna aksen.
 * Tiap hue punya dua nilai:
 *  - light: dipakai pada tema terang (tier 700 → teks AA di kartu terang)
 *  - dark : dipakai pada tema gelap (tier 300/400 → terbaca di kartu gelap)
 * Nilainya terdaftar sebagai CSS variable --subject-* di app/globals.css dan
 * sebagai token colors.subject di tailwind.config.ts (format kanal "R G B").
 * JANGAN ubah nilai di sini dan di sana secara terpisah.
 * Verifikasi kontras: node scripts/check-palette-contrast.mjs
 */
export interface SubjectAccent {
  id: string;
  /** Hex untuk tema terang (teks/border/sampul). */
  light: string;
  /** Hex untuk tema gelap. */
  dark: string;
}

import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BookOpen,
  Calculator,
  Coins,
  FlaskConical,
  Globe2,
  Languages,
  Landmark,
  Leaf,
  Music,
  Palette,
  Terminal,
  Users,
} from "lucide-react";

export const SUBJECT_ACCENTS: SubjectAccent[] = [
  { id: "sky", light: "#0369A1", dark: "#7DD3FC" },
  { id: "violet", light: "#7C3AED", dark: "#C4B5FD" },
  { id: "rose", light: "#BE123C", dark: "#FDA4AF" },
  { id: "amber", light: "#B45309", dark: "#FBBF24" },
  { id: "emerald", light: "#047857", dark: "#6EE7B7" },
  { id: "fuchsia", light: "#A21CAF", dark: "#F0ABFC" },
  { id: "blue", light: "#1D4ED8", dark: "#93C5FD" },
  { id: "orange", light: "#C2410C", dark: "#FDBA74" },
  { id: "teal", light: "#0F766E", dark: "#5EEAD4" },
  { id: "red", light: "#B91C1C", dark: "#FCA5A5" },
  { id: "lime", light: "#4D7C0F", dark: "#BEF264" },
  { id: "indigo", light: "#4338CA", dark: "#A5B4FC" },
];

/** Hash string stabil (djb2) → indeks palet yang deterministik. */
export function accentIndexFor(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % SUBJECT_ACCENTS.length;
}

export function accentForSubject(subject?: string | null): SubjectAccent {
  if (!subject || !subject.trim()) return SUBJECT_ACCENTS[0];
  return SUBJECT_ACCENTS[accentIndexFor(subject.trim().toLowerCase())];
}

/** Kata kunci mata pelajaran umum → ikon + akson tetap (semantik). */
const SUBJECT_KEYWORD_MAP: {
  keys: string[];
  icon: LucideIcon;
  accentId?: string;
}[] = [
  { keys: ["matematika", "math"], icon: Calculator, accentId: "blue" },
  { keys: ["fisika"], icon: Atom, accentId: "sky" },
  { keys: ["kimia"], icon: FlaskConical, accentId: "emerald" },
  { keys: ["biologi", "ipa"], icon: Leaf, accentId: "lime" },
  { keys: ["sejarah", "sejarwati"], icon: Landmark, accentId: "amber" },
  { keys: ["geografi"], icon: Globe2, accentId: "teal" },
  { keys: ["ekonomi"], icon: Coins, accentId: "orange" },
  { keys: ["sosiologi", "ppkn", "pkn"], icon: Users, accentId: "rose" },
  { keys: ["inggris", "english"], icon: Languages, accentId: "indigo" },
  { keys: ["indo", "bahasa", "sastra"], icon: BookOpen, accentId: "violet" },
  { keys: ["informatika", "tik", "komputer"], icon: Terminal, accentId: "fuchsia" },
  { keys: ["seni", "budaya"], icon: Palette, accentId: "red" },
  { keys: ["musik"], icon: Music, accentId: "violet" },
];

/** Ikon yang mewakili mata pelajaran; fallback FileText untuk tak dikenal. */
export function subjectIconFor(subject?: string | null): LucideIcon {
  const s = (subject ?? "").trim().toLowerCase();
  if (!s) return BookOpen;
  for (const entry of SUBJECT_KEYWORD_MAP) {
    if (entry.keys.some((k) => s.includes(k))) return entry.icon;
  }
  return BookOpen;
}

/**
 * Akson untuk mata pelajaran: pakai pemetaan semantik bila dikenali,
 * selain itu hash deterministik agar konsisten lintas perangkat.
 */
export function subjectAccent(subject?: string | null): SubjectAccent {
  const s = (subject ?? "").trim().toLowerCase();
  if (s) {
    for (const entry of SUBJECT_KEYWORD_MAP) {
      if (!entry.accentId) continue;
      if (entry.keys.some((k) => s.includes(k))) {
        const hit = SUBJECT_ACCENTS.find((a) => a.id === entry.accentId);
        if (hit) return hit;
      }
    }
  }
  return accentForSubject(subject);
}

/** Luminans relatif WCAG → pilih teks hitam/putih untuk latar solid berwarna. */
export function readableTextColor(hex: string): "#0F0D0B" | "#FFFFFF" {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.35 ? "#0F0D0B" : "#FFFFFF";
}
