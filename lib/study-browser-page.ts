/** Read-only browsing instructions derived from the user's message, never from web text. */
export function scrollIntent(prompt: string) {
  const explicit = /\b(scroll|gulir|geser)\b/i.test(prompt);
  const direction = explicit && /\b(scroll|gulir|geser)\b[^.!?]*\b(atas|up)\b/i.test(prompt) ? "up" : "down";
  const thorough = /sampai (?:paling )?(?:bawah|akhir)|seluruh halaman|semua (?:isi|bagian)|to the (?:bottom|end)/i.test(prompt);
  const only = explicit && !/\b(cari|temukan|search|buka|kunjungi|filter|saring|ketik|pilih|urutkan|klik|click|masukkan)\b/i.test(prompt);
  return { explicit, direction, steps: thorough ? 6 : 3, only } as const;
}

export function continuationOffset(text: string) {
  const match = text.match(/\[characters\s+\d+-(\d+)\s+of\s+(\d+);\s*pass offset\s+(\d+)\s+to read more\]/i);
  if (!match) return undefined;
  const next = Number(match[3]);
  return next > 0 && next < Number(match[2]) && next <= 100_000 ? next : undefined;
}

/** Retain the start, relevant middle passages, and the newly read bottom within the source budget. */
export function browserPageExcerpt(parts: string[], prompt: string) {
  const unique = [...new Set(parts.map(part => part.replace(/\n?\[characters[^\n]+pass offset[^\n]+\]/gi, "").trim()).filter(Boolean))];
  const text = unique.join("\n\n[Bagian halaman berikutnya]\n\n");
  if (text.length <= 18_000) return text;
  const terms = [...new Set(prompt.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])]
    .filter(term => !/^(tolong|scroll|gulir|geser|halaman|bagian|bawah|atas|sampai|semua|lanjut|lanjutkan|cari|saya|untuk|dari|yang|dengan)$/.test(term));
  const chunks = [];
  for (let start = 6000; start < text.length - 4000; start += 1000) {
    const value = text.slice(start, Math.min(start + 1000, text.length - 4000));
    chunks.push({ start, value, score: terms.filter(term => value.toLowerCase().includes(term)).length });
  }
  const middle = chunks.filter(chunk => chunk.score > 0).sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, 7).sort((a, b) => a.start - b.start).map(chunk => chunk.value);
  return [text.slice(0, 6000), ...middle, text.slice(-4000)].join("\n[…]\n").slice(0, 18_000);
}
