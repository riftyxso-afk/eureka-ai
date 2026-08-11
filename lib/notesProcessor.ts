/**
 * Pemroses materi di latar belakang: ekstrak → bab AI → enrichment →
 * RAG (chunk + embed + simpan) → stabilo → kuis & flashcards.
 *
 * Dipanggil oleh worker job (lihat lib/jobQueue.ts) dari
 * POST /api/notes/process — response 202 { jobId } langsung dikembalikan ke
 * klien, pekerjaan berat berjalan di sini tanpa memblokir user.
 */
import { randomUUID } from "crypto";

import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import { saveNoteWithChunks, type StoredChunk } from "@/lib/rag/store";
import {
  generateAiSummary,
  processSubtitleToChapters,
  processYouTubeSubtitle,
} from "@/lib/processSubtitle";
import { generateHighlightsForChapters } from "@/lib/ai-highlights";
import { enrichNoteWithFirecrawl } from "@/lib/noteEnrich";
import { generateFlashcards, generateQuiz } from "@/lib/studyTools";
import {
  processWebPageToChapters,
  downloadWebImages,
} from "@/lib/processWeb";
import { scrapeWebUrl, type WebImage } from "@/lib/firecrawl";
import type { TranscriptSegment } from "@/lib/rag/extract";
import {
  scrapeYoutubeTranscript,
  extractTextFromFile,
  transcribeAudioVideo,
} from "@/lib/rag/extract";
import type { ProcessPhase } from "@/lib/progressTracker";
import {
  enrichChaptersWithWebSearch,
  isWebSearchEnrichmentAvailable,
  buildReferencesMarkdown,
} from "@/lib/webSearchEnrichment";
import type { Note, SearchSource } from "@/lib/types";

export interface NotePrefs {
  studyMode: "ringkas" | "standar" | "lengkap";
  gayaPenulisan: string;
  bahasa: string;
}

export interface NotesProcessorInput {
  sourceType: string;
  url: string;
  fileBuffer?: Buffer;
  fileName?: string;
  prefs: NotePrefs;
}

export interface NotesProcessorProgress {
  report: (phase: ProcessPhase, percent: number, message: string) => void;
  advance: (phase: ProcessPhase, fraction: number, message: string) => void;
  done: (phase: ProcessPhase, message: string) => void;
}

export interface NotesProcessorResult {
  note: Note;
  preview: string;
}

const SUBJECT_BY_SOURCE: Record<string, string> = {
  dokumen: "Dokumen",
  youtube: "YouTube",
  audio: "Audio",
  video: "Video",
  web: "Web",
};

/**
 * Jalankan seluruh fase pembuatan catatan. Progress dikirim lewat objek
 * `progress` (membungkus ProgressTracker SSE + update status job).
 */
export async function processNoteForBackground(
  input: NotesProcessorInput,
  progress: NotesProcessorProgress
): Promise<NotesProcessorResult> {
  const { report, advance, done } = progress;
  const { sourceType, prefs } = input;

  // FASE 1: Ekstraksi (0-15%)
  let extracted: {
    text: string;
    title?: string;
    segments?: TranscriptSegment[];
    sourceUrl?: string;
  };
  let webImages: WebImage[] = [];

  report("extract", 2, "Menyiapkan materi...");
  if (sourceType === "youtube") {
    report("extract", 6, "Mengambil subtitle video dari YouTube...");
    extracted = await scrapeYoutubeTranscript(input.url);
    report("extract", 13, "Subtitle berhasil diambil.");
  } else if (sourceType === "web") {
    report("extract", 6, "Membaca halaman web...");
    const scraped = await scrapeWebUrl(input.url);
    extracted = {
      text: scraped.text,
      title: scraped.title,
      sourceUrl: input.url,
    };
    webImages = scraped.images;
    report("extract", 13, "Halaman web berhasil dibaca.");
  } else if (input.fileBuffer && input.fileBuffer.length > 0) {
    if (sourceType === "dokumen") {
      report("extract", 6, "Mengurai isi dokumen...");
      extracted = await extractTextFromFile(input.fileBuffer, input.fileName ?? "file");
    } else {
      report("extract", 6, "Mentranskripsikan audio/video (Whisper)...");
      extracted = await transcribeAudioVideo(input.fileBuffer, input.fileName ?? "file");
    }
    report("extract", 13, "Ekstraksi teks selesai.");
  } else {
    throw new Error("Unggah file dulu.");
  }

  report("extract", 15, "Materi siap diproses.");

  const noteId = randomUUID();

  // FASE 2: Bab-bab catatan (15-50%)
  let chapters: Note["chapters"];
  let summary: string | undefined;
  let keyPoints: string[] | undefined;
  let title = extracted.title ?? "";

  if (sourceType === "youtube") {
    advance("chapters", 0.05, "Merangkum video dengan AI...");
    const processed = await processYouTubeSubtitle(
      extracted.text,
      extracted.segments,
      prefs,
      true,
      (fraction: number, label: string) => advance("chapters", fraction, label)
    );
    chapters = processed.chapters;
    summary = processed.summary;
    keyPoints = processed.keyPoints;
    if (processed.title && processed.title !== "Ringkasan Video") {
      title = processed.title;
    }
  } else if (sourceType === "web") {
    advance("chapters", 0.05, "Menyusun catatan dari halaman web...");
    const processed = await processWebPageToChapters(
      extracted.text,
      webImages,
      prefs,
      (fraction: number, label: string) => advance("chapters", fraction, label)
    );
    chapters = processed.chapters;
    summary = processed.summary;
    keyPoints = processed.keyPoints;
    title = processed.title || (extracted.title ?? "");
  } else {
    advance("chapters", 0.3, "Membagi materi menjadi bab-bab...");
    chapters = await processSubtitleToChapters(
      extracted.text,
      extracted.segments,
      prefs
    );
    advance("chapters", 0.8, "Membuat ringkasan...");
    summary = await generateAiSummary(extracted.text, prefs);
  }
  done("chapters", "Bab-bab selesai ditulis.");

  const note: Note = {
    id: noteId,
    title: title || "Ringkasan Materi",
    subject: SUBJECT_BY_SOURCE[sourceType] ?? "Materi",
    sourceUrl: extracted.sourceUrl,
    chunkCount: 0,
    createdAt: new Date().toISOString(),
    chapters,
    summary,
    keyPoints,
  };
  let references: SearchSource[] = [];

  // Unduh gambar yang dipilih AI dari halaman web → simpan ke local agar
  // tampil stabil di catatan. Gagal tidak menggagalkan proses.
  if (sourceType === "web") {
    try {
      note.chapters = await downloadWebImages(note.id, note.chapters ?? []);
      chapters = note.chapters;
    } catch (e) {
      console.warn("[notesProcessor] Unduh gambar web dilewati:", e);
    }
  }

  // Enrich pasca-rangkum (selain sumber web yang gambarnya dari halaman itu sendiri):
  // cari materi terkait via Firecrawl → validasi, tambah poin penting, dan sisipkan
  // gambar yang relevan ke bab — semuanya otomatis. Gagal tidak menggagalkan proses.
  if (sourceType !== "web") {
    try {
      advance("enrichment", 0.03, "Mencari materi pendukung...");
      const enriched = await enrichNoteWithFirecrawl(note);
      if (enriched) {
        Object.assign(note, enriched.note);
        title = note.title;
        chapters = note.chapters;
        summary = note.summary;
        keyPoints = note.keyPoints;
        console.info(
          `[notesProcessor] Enrich: +${enriched.imagesPlaced} gambar, +${enriched.keyPointsAdded} poin tambahan`
        );
      }
    } catch (e) {
      console.warn("[notesProcessor] Enrich dilewati:", e);
    }
  }

  // FASE 3: Validasi & enrichment per-bab via web search (50-80%)
  if (chapters && chapters.length > 0) {
    advance("enrichment", 0.06, "Mencari sumber web untuk validasi...");
    if (isWebSearchEnrichmentAvailable()) {
      const enriched = await enrichChaptersWithWebSearch(
        title,
        chapters,
        (doneCount: number, total: number, label: string) =>
          advance(
            "enrichment",
            0.1 + (doneCount / Math.max(total, 1)) * 0.72,
            label
          )
      );
      chapters = enriched.chapters;
      references = enriched.references;
      console.info(
        `[notesProcessor] Web search: ${enriched.totalSearches} sumber dipakai untuk validasi`
      );
    } else {
      console.info("[notesProcessor] Web search enrichment dilewati (butuh FIRECRAWL_API_KEY + API key AI).");
    }

    // Sertakan bagian "Sumber & Referensi" di akhir catatan.
    if (references.length > 0) {
      advance("enrichment", 0.92, "Menyusun bagian Sumber & Referensi...");
      chapters = [
        ...chapters,
        {
          id: chapters.length + 1,
          title: "Sumber & Referensi",
          content: buildReferencesMarkdown(references),
        },
      ];
    }
  }
  note.chapters = chapters;
  done("enrichment", "Validasi & enrichment selesai.");

  // FASE 4: RAG — chunk, embed, simpan (80-90%)
  advance("rag", 0.1, "Memecah materi menjadi potongan kecil...");
  const fullText = (chapters ?? [])
    .map((c) => c.content)
    .join("\n\n")
    .trim();
  const chunks = chunkText(fullText || extracted.text, 800, 100);
  if (!chunks.length) {
    throw new Error("Materi terlalu pendek untuk dibuat catatan.");
  }
  note.chunkCount = chunks.length;
  note.references = references.length > 0 ? references : undefined;
  advance("rag", 0.45, "Mengubah potongan menjadi vektor...");
  const embeddings = await embedTexts(chunks, "passage");
  advance("rag", 0.85, "Menyimpan ke knowledge base...");

  const storedChunks: StoredChunk[] = chunks.map((text, i) => ({
    id: `${note.id}-${i}`,
    noteId: note.id,
    text,
    embedding: embeddings[i],
  }));

  await saveNoteWithChunks(note, storedChunks);
  done("rag", "Knowledge base siap.");

  // Stabilo otomatis dari AI (default) — gagal tidak menggagalkan proses.
  try {
    const highlightCount = await generateHighlightsForChapters(
      note.id,
      note.chapters ?? []
    );
    console.info(
      `[notesProcessor] Stabilo AI: ${highlightCount} highlight untuk ${note.id}`
    );
  } catch (e) {
    console.warn("[notesProcessor] Stabilo AI dilewati:", e);
  }

  // FASE 5: Kuis & flashcards otomatis sesuai Mode Belajar (90-100%)
  const studyCounts: Record<string, number> = { ringkas: 0, standar: 5, lengkap: 10 };
  const studyCount = studyCounts[prefs.studyMode ?? "standar"] ?? 0;
  if (studyCount > 0) {
    advance("study_tools", 0.2, "Membuat kuis...");
    try {
      const [quizCount, cardCount] = await Promise.all([
        generateQuiz(note.id, note.title, note.chapters ?? [], studyCount, prefs.bahasa),
        generateFlashcards(note.id, note.chapters ?? [], studyCount, prefs.bahasa),
      ]);
      console.info(
        `[notesProcessor] Kuis: ${quizCount} soal, Flashcards: ${cardCount} kartu`
      );
    } catch (e) {
      console.warn("[notesProcessor] Kuis/flashcards dilewati:", e);
    }
  }
  done("study_tools", "Selesai! Catatan siap dipelajari.");
  report("study_tools", 100, "Selesai!");

  return {
    note,
    preview: chunks[0].slice(0, 240),
  };
}
