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
  /**
   * Model spesifik pilihan user (Model Store) — server memvalidasi terhadap
   * katalog; id asing diabaikan (mode tier normal).
   */
  model?: string;
  /** Reasoning ON = tampilkan thinking real + pakai model thinking; OFF = loading pixel-grid + model biasa. */
  reasoning?: boolean;
  /**
   * Link YouTube pada pesan user (jika ada) — server mengekstrak transkrip
   * sebagai konteks jawaban AI dan sesi memakainya sebagai "video aktif".
   */
  videoUrl?: string | null;
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
  /** Nama file lampiran (hanya untuk pesan user optimis — tidak disimpan server). */
  attachmentName?: string | null;
  /**
   * Link YouTube pada pesan user (hanya untuk pesan optimis — server tidak
   * menyimpan kolom ini; di-render ulang dari content setelah reload).
   */
  videoUrl?: string | null;
}

export interface AssistantChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** Satu pesan di dalam snapshot share (hanya teks — tanpa metadata). */
export interface ShareMessage {
  role: "user" | "assistant";
  content: string;
}

/** Baris tabel ai_chat_shares (snapshot percakapan yang dibagikan). */
export interface ShareRecord {
  id: string;
  sessionId: string | null;
  userId: string | null;
  title: string;
  token: string;
  messages: ShareMessage[];
  createdAt: string;
}