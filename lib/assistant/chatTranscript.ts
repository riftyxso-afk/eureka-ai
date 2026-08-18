/**
 * Transkrip percakapan chat untuk dijadikan materi sumber catatan
 * ("buatkan catatan sesuai topik di chat").
 *
 * Murni (tanpa I/O) agar bisa diuji node:test tanpa jaringan. Dipakai
 * komponen klien NoteProgressOverlay untuk membangun isi file sumber.
 */

export interface TranscriptMessage {
  role: string;
  content: string;
}

export interface ChatTranscriptOptions {
  /** Ambil maksimal N pesan TERAKHIR (paling relevan dengan topik terkini). */
  maxMessages?: number;
  /** Batas total panjang output. Bila lewat, pesan TERLAMA yang dibuang. */
  maxChars?: number;
}

export const CHAT_TRANSCRIPT_DEFAULTS = {
  maxMessages: 12,
  maxChars: 20000,
} as const;

/** Label peran (konsisten dengan tampilan chat & studyContext). */
export function transcriptRoleLabel(role: string): string {
  return role === "assistant" ? "Eureka" : "Siswa";
}

/**
 * Bangun transkrip berlabel peran dari daftar pesan, berisi pesan-pesan
 * TERAKHIR. Bila total melebihi maxChars, pesan tertua dibuang dulu agar
 * bagian paling baru (topik yang sedang dibahas) selalu ikut.
 */
export function buildChatTranscript(
  messages: TranscriptMessage[],
  opts: ChatTranscriptOptions = {}
): string {
  const maxMessages = opts.maxMessages ?? CHAT_TRANSCRIPT_DEFAULTS.maxMessages;
  const maxChars = opts.maxChars ?? CHAT_TRANSCRIPT_DEFAULTS.maxChars;

  const recent = (Array.isArray(messages) ? messages : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        String(m.content ?? "").trim().length > 0
    )
    .slice(-maxMessages);

  const lines = recent.map((m) => {
    const content = String(m.content).trim();
    return `${transcriptRoleLabel(m.role)}: ${content}`;
  });

  let joined = lines.join("\n");
  if (joined.length > maxChars) {
    // Simpan pesan terbaru yang muat; buang yang tertua.
    const kept: string[] = [];
    let len = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const sep = kept.length > 0 ? 1 : 0;
      if (len + sep + lines[i].length > maxChars) break;
      kept.unshift(lines[i]);
      len += lines[i].length + sep;
    }
    joined = kept.join("\n");
  }
  return joined;
}
