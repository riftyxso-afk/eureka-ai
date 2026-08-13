/**
 * Tipe bersama chat asisten (dipakai server & client — bebas dependency).
 */

/**
 * Lampiran (upload) pada pesan chat.
 * - Gambar (image/*): dataUrl utuh dikirim sebagai image_url (vision).
 * - Dokumen (pdf/docx/…): dataUrl base64, teksnya diekstrak server-side.
 */
export interface ChatAttachment {
  filename: string;
  mimeType: string;
  /** data URL: `data:<mime>;base64,<data>` */
  dataUrl: string;
}

/** Opsi tool yang aktif saat mengirim pesan. */
export interface ChatToolOptions {
  /** Cari info tambahan di web (Firecrawl) sebelum menjawab. */
  webSearch?: boolean;
  /** File/gambar yang dilampirkan user (opsional). */
  attachment?: ChatAttachment | null;
  /** Kecepatan jawaban AI: fast (Kilat) / normal (Seimbang) / deep (Mendalam). */
  speedMode?: "fast" | "normal" | "deep";
}

/** Satu hasil pencarian web (tool globe) yang ditampilkan ke user. */
export interface WebSearchItem {
  url: string;
  title: string;
  description: string;
  /** Nama domain untuk favicon, mis. "ruangguru.com". */
  domain: string;
}

/** Tahap pipeline web search yang tampil sebagai loading. */
export type WebSearchStage = "searching" | "analyzing" | "writing";

/** Sumber materi yang dipakai AI saat menjawab (hasil RAG). */
export interface AssistantSource {
  noteId: string;
  noteTitle: string;
  chapterId?: number | null;
  similarity?: number;
}

export interface AssistantChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  mentions: string[];
  sources: AssistantSource[];
  model: string | null;
  createdAt: string;
}

export interface AssistantChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}