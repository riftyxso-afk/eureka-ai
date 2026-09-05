/**
 * Lapisan heuristik lokal (tanpa biaya API, tanpa latency jaringan).
 *
 * Dipakai dua peran:
 * 1. Pertahanan berlapis BERSAMA hasil NIM (defense in depth).
 * 2. Fallback PENUH saat NIM belum dikonfigurasi / down (circuit open).
 *
 * Semua fungsi murni (pure) → mudah diuji tanpa network.
 */
import { TOPIC_BLACKLIST, TOPIC_WHITELIST } from "./safety-config";

/** Pola jailbreak / prompt-injection umum (ID + EN, case-insensitive). */
const JAILBREAK_PATTERNS: RegExp[] = [
  /abaikan\s+(semua\s+)?instruksi\s+(sebelumnya|di\s*atas|system)/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /lupakan\s+(semua\s+)?aturan/i,
  /forget\s+(all\s+)?(rules|instructions)/i,
  /berpura-pura\s+(men)?jadi/i,
  /pretend\s+to\s+be/i,
  /jailbreak|dan\s+mode|developer\s+mode|do\s+anything\s+now/i,
  /tampilkan\s+(system\s+prompt|prompt\s+sistem|prompt\s+internal)/i,
  /(reveal|show|print)\s+(your\s+)?(system\s+prompt|internal\s+instructions|secret)/i,
  /bocorkan\s+(data|kunci|api|rahasia|prompt)/i,
  /(leak|expose)\s+(api[\s_-]?key|secret|credential|prompt)/i,
  /token\s+admin|service[\s_-]?role|supabase.*service/i,
  /\[system\]|\[instuksi\]|<\|system\|>|<<sys>>/i,
];

/** Pola PII: email, no. HP Indonesia/internasional, NIK 16 digit. */
const PII_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { name: "phone", re: /(\+?62[\s-]?\d[\s-]?\d{3}[\s-]?\d{3,4}[\s-]?\d{3,4}|\b08\d{8,11}\b)/ },
  { name: "nik", re: /\b\d{16}\b/ },
  { name: "api-key", re: /\b(sk-[A-Za-z0-9-_]{8,}|re_[A-Za-z0-9-_]{8,}|nvapi-[A-Za-z0-9-_]{8,}|xox[bpas]-[A-Za-z0-9-]+)\b/ },
];

const norm = (s: string) => s.toLowerCase();

/** True bila teks cocok pola jailbreak/prompt-injection. */
export function detectJailbreakHeuristic(text: string): boolean {
  return JAILBREAK_PATTERNS.some((re) => re.test(text));
}

/** Kembalikan daftar jenis PII yang ditemukan dalam teks. */
export function detectPiiHeuristic(text: string): string[] {
  return PII_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** Samarkan PII dari teks (untuk penyimpanan/log yang aman). */
export function scrubPii(text: string): string {
  let out = text;
  for (const p of PII_PATTERNS) {
    const global = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    out = out.replace(global, `[${p.name} disamarkan]`);
  }
  return out;
}

/**
 * Heuristik topik: blacklist → off-topic; whitelist → on-topic;
 * tidak ada kecocokan → { decided: false } (serahkan ke NIM / lolos).
 */
export function isOffTopicHeuristic(text: string): {
  decided: boolean;
  offTopic: boolean;
} {
  const t = norm(text);
  if (TOPIC_BLACKLIST.some((k) => t.includes(norm(k)))) {
    return { decided: true, offTopic: true };
  }
  if (TOPIC_WHITELIST.some((k) => t.includes(norm(k)))) {
    return { decided: true, offTopic: false };
  }
  return { decided: false, offTopic: false };
}
