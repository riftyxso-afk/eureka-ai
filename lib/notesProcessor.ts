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
  generateAiTitle,
  processLongDocumentToChapters,
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
import { clampChapterCount } from "@/lib/prompts/noteGeneration";
import { isJobCancelled, JobCancelledError } from "@/lib/jobQueue";
import { detectJailbreakHeuristic } from "@/lib/safety/patterns";
import { checkJailbreak } from "@/lib/safety/nvidia-nim";
import { SAFETY_BLOCK_THRESHOLD, isNvidiaNimConfigured } from "@/lib/safety/safety-config";
import { logSafetyEvent } from "@/lib/safety/safety-log";
import type { Note, SearchSource } from "@/lib/types";

export interface NotePrefs {
  studyMode: "ringkas" | "standar" | "lengkap";
  gayaPenulisan: string;
  bahasa: string;
  chapterCount?: number;
  /** Mode pembuatan: "cepat" = ringkas & kilat (lewati fase berat), "lengkap" = pipeline penuh. */
  generationMode?: "cepat" | "lengkap";
  /** Mode Soal/Tugas: teks sumber adalah soal yang harus dijawab tuntas. */
  assignment?: boolean;
  /** Terjemahkan materi sumber ke bahasa target. */
  translate?: boolean;
  /** Jenis rangkuman: rangkuman | makalah | laporan | poin (mempengaruhi prompt AI). */
  noteType?: "rangkuman" | "makalah" | "laporan" | "poin";
  /**
   * Mata pelajaran pilihan user — menimpa label otomatis dari jenis sumber
   * (mata-pelajaran-subject: user memilih mapel saat membuat catatan).
   * Kosong = pakai label sumber seperti sebelumnya.
   */
  subject?: string;
}

/** Batas bab pada mode CEPAT — dijamin selesai cepat. */
const FAST_MAX_CHAPTERS = 3;

/**
 * Preferensi efektif untuk prompt AI: mode CEPAT memaksa ringkas dan
 * membatasi jumlah bab agar generate benar-benar cepat.
 */
function resolvePrefs(prefs: NotePrefs): NotePrefs {
  if (prefs.generationMode !== "cepat") return prefs;
  const capped =
    prefs.chapterCount != null
      ? Math.min(FAST_MAX_CHAPTERS, Math.max(1, Math.floor(prefs.chapterCount)))
      : FAST_MAX_CHAPTERS;
  return {
    ...prefs,
    generationMode: "cepat",
    chapterCount: capped,
  };
}

export type NoteSourceType =
  | "dokumen"
  | "youtube"
  | "web"
  | "soal"
  | "audio"
  | "video";

/** Satu sumber materi untuk pembuatan catatan (maks 5 per catatan). */
export interface NoteSource {
  type: NoteSourceType;
  url?: string;
  /** Teks soal yang ditempel user (type "soal"). */
  soalText?: string;
  fileBuffer?: Buffer;
  fileName?: string;
}

export interface NotesProcessorInput {
  /** Sumber materi — 1 sampai 5, bebas campur jenis. */
  sources: NoteSource[];
  prefs: NotePrefs;
  /** Job background — dipakai untuk cek pembatalan di antara fase. */
  jobId?: string;
  /** Pemilik catatan (UUID users) — wajib agar sesuai FK notes.user_id. */
  userId?: string;
}

/** Label ramah user per jenis sumber. */
export const SOURCE_LABEL: Record<NoteSourceType, string> = {
  dokumen: "Dokumen",
  youtube: "YouTube",
  audio: "Audio",
  video: "Video",
  web: "Web",
  soal: "Soal/Tugas",
};

/** Hasil ekstraksi satu sumber. */
interface ExtractedSource {
  text: string;
  title?: string;
  segments?: TranscriptSegment[];
  sourceUrl?: string;
}

export interface NotesProcessorProgress {
  report: (phase: ProcessPhase, percent: number, message: string) => void;
  advance: (phase: ProcessPhase, fraction: number, message: string) => void;
  done: (phase: ProcessPhase, message: string) => void;
}

export interface NotesProcessorResult {
  note: Note;
  preview: string;
  /** Sumber yang gagal diekstrak tapi tidak menggagalkan proses (dilewati). */
  warnings?: string[];
}

const SUBJECT_BY_SOURCE: Record<string, string> = SOURCE_LABEL;

/** Judul hasil ekstraksi yang masih placeholder generik (tanpa topik). */
const WEAK_NOTE_TITLE_RE =
  /^(catatan|ringkasan|materi|dokumen|catatan baru|untitled|tanpa judul|ringkasan materi)$/i;

/**
 * Ekstrak semua sumber; sumber yang gagal dilewati (dikumpulkan) selama
 * masih ada sumber lain yang berhasil — bila SEMUA gagal, lempar error
 * dengan detail sumber mana yang gagal dan alasannya.
 */
async function extractAllSources(
  sources: NoteSource[],
  report: NotesProcessorProgress["report"]
): Promise<{
  extracted: ExtractedSource;
  webImages: WebImage[];
  failures: { label: string; error: string }[];
}> {
  const parts: string[] = [];
  const results: ExtractedSource[] = [];
  const failures: { label: string; error: string }[] = [];
  let webImages: WebImage[] = [];

  const total = Math.max(sources.length, 1);
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const label =
      src.fileName || src.url || SOURCE_LABEL[src.type] || "Sumber";
    report("extract", 2 + (i / total) * 11, `Membaca ${label}...`);
    try {
      let res: ExtractedSource;
      if (src.type === "soal") {
        const soal = (src.soalText ?? "").trim();
        if (soal.length < 10) {
          throw new Error(
            "Soal terlalu pendek. Tempel soal/tugas dengan lengkap."
          );
        }
        res = { text: soal, title: "Soal/Tugas" };
      } else if (src.type === "youtube") {
        res = await scrapeYoutubeTranscript(src.url ?? "");
      } else if (src.type === "web") {
        const scraped = await scrapeWebUrl(src.url ?? "");
        webImages.push(...scraped.images);
        res = {
          text: scraped.text,
          title: scraped.title,
          sourceUrl: src.url,
        };
      } else if (src.fileBuffer && src.fileBuffer.length > 0) {
        if (src.type === "dokumen") {
          res = await extractTextFromFile(
            src.fileBuffer,
            src.fileName ?? "file"
          );
        } else {
          res = await transcribeAudioVideo(
            src.fileBuffer,
            src.fileName ?? "file"
          );
        }
      } else {
        throw new Error("Unggah file dulu.");
      }
      // Guardrail 4.3: scan prompt-injection per sumber (heuristik, gratis).
      // Kena → sumber dikarantina via kanal failures (user lihat warning,
      // sumber lain tetap diproses). NIM menyusul sekali untuk teks gabungan.
      if (detectJailbreakHeuristic(res.text)) {
        const msg =
          "Diblokir guardrail keamanan: materi terindikasi mengandung instruksi injeksi prompt.";
        failures.push({ label, error: msg });
        logSafetyEvent({
          type: "jailbreak-detected",
          severity: "high",
          categories: ["jailbreak", "prompt-injection"],
          snippet: res.text,
          source: "heuristic",
        });
        console.warn(`[notesProcessor] Sumber dikarantina guardrail: ${label}`);
        continue;
      }
      results.push(res);
      parts.push(`[${i + 1}. ${label}]\n${res.text}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal diproses.";
      failures.push({ label, error: msg });
      console.warn(`[notesProcessor] Sumber gagal: ${label} — ${msg}`);
    }
  }

  if (parts.length === 0) {
    const detail = failures
      .map((f) => `${f.label}: ${f.error}`)
      .join("; ");
    throw new Error(
      failures.length > 0
        ? `Semua sumber gagal diproses. ${detail}`
        : "Tidak ada materi yang bisa diproses."
    );
  }

  // Guardrail 4.3 (lapis 2): satu panggilan NIM untuk teks gabungan.
  // HANYA kategori injeksi (jailbreak/prompt-injection) yang memblokir —
  // konten edukasi sah bisa memicu kategori lain (mis. sejarah perang →
  // "violence") dan TIDAK boleh menggagalkan pembuatan catatan.
  const INJECTION_CATS = new Set(["jailbreak", "prompt-injection"]);
  const combinedText = parts.join("\n\n---\n\n");
  if (isNvidiaNimConfigured()) {
    try {
      // Job latar belakang — boleh tunggu model lebih lama (bukan jalur chat).
      const nimVerdict = await checkJailbreak(combinedText, 20_000);
      const isInjection = nimVerdict.categories.some((c) => INJECTION_CATS.has(c));
      if (
        nimVerdict.ok &&
        !nimVerdict.safe &&
        isInjection &&
        nimVerdict.confidence >= SAFETY_BLOCK_THRESHOLD
      ) {
        logSafetyEvent({
          type: "input-blocked",
          severity: "high",
          categories: nimVerdict.categories,
          snippet: combinedText,
          source: "nim",
        });
        throw new Error(
          "Materi diblokir guardrail keamanan: terdeteksi upaya injeksi prompt. " +
            "Periksa kembali isi sumber lalu coba lagi."
        );
      }
    } catch (e) {
      // Kegagalan NIM tidak boleh menggagalkan job (fallback ke heuristik
      // + prompt rules) — kecuali error-nya justru penolakan di atas.
      if (e instanceof Error && e.message.startsWith("Materi diblokir guardrail")) {
        throw e;
      }
      console.warn("[notesProcessor] Cek NIM materi dilewati:", e instanceof Error ? e.message : e);
    }
  }

  const first = results[0];
  // Sumber YouTube di POSISI BERAPA PUN ikut jadi sourceUrl catatan —
  // dulu hanya sumber pertama yang dibaca, sehingga catatan multi-sumber
  // (mis. dokumen + YouTube) kehilangan embed video di halaman catatan.
  const youtubeSourceUrl = sources.find(
    (s) => s.type === "youtube" && (s.url ?? "").trim()
  )?.url?.trim();
  return {
    extracted: {
      text: combinedText,
      title: first?.title,
      // Segmen subtitle hanya bermakna bila satu-satunya sumber adalah YouTube.
      segments: sources.length === 1 ? first?.segments : undefined,
      sourceUrl: youtubeSourceUrl ?? first?.sourceUrl,
    },
    webImages,
    failures,
  };
}

/**
 * Jalankan seluruh fase pembuatan catatan. Progress dikirim lewat objek
 * `progress` (membungkus ProgressTracker SSE + update status job).
 */
export async function processNoteForBackground(
  input: NotesProcessorInput,
  progress: NotesProcessorProgress
): Promise<NotesProcessorResult> {
  const { report, advance, done } = progress;
  const sources = input.sources ?? [];
  if (sources.length === 0) {
    throw new Error("Minimal satu sumber diperlukan.");
  }
  const isFast = input.prefs.generationMode === "cepat";
  const prefs = resolvePrefs(input.prefs);

  // FASE 1: Ekstraksi (0-15%) — semua sumber diekstrak & digabung.
  report("extract", 2, "Menyiapkan materi...");
  const { extracted, webImages, failures } = await extractAllSources(
    sources,
    report
  );
  report("extract", 15, "Materi siap diproses.");

  const noteId = randomUUID();

  if (input.jobId && (await isJobCancelled(input.jobId))) {
    throw new JobCancelledError();
  }

  // FASE 2: Bab-bab catatan (15-50%)
  let chapters: Note["chapters"];
  let summary: string | undefined;
  let keyPoints: string[] | undefined;
  let title = extracted.title ?? "";

  // Jalur khusus hanya dipakai untuk SATU sumber (perilaku lama dipertahankan);
  // multi-sumber memakai jalur generik bab+ringkasan terhadap teks gabungan.
  const singleSource = sources.length === 1 ? sources[0] : null;
  const sourceType = singleSource?.type ?? sources[0]?.type ?? "dokumen";

  if (singleSource?.type === "youtube") {
    advance("chapters", 0.05, "Merangkum video dengan AI...");
    const processed = await processYouTubeSubtitle(
      extracted.text,
      extracted.segments,
      prefs,
      true,
      (fraction: number, label: string) => advance("chapters", fraction, label)
    );
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
    chapters = processed.chapters;
    summary = processed.summary;
    keyPoints = processed.keyPoints;
    if (processed.title && processed.title !== "Ringkasan Video") {
      title = processed.title;
    }
  } else if (singleSource?.type === "web") {
    advance("chapters", 0.05, "Menyusun catatan dari halaman web...");
    const processed = await processWebPageToChapters(
      extracted.text,
      webImages,
      prefs,
      (fraction: number, label: string) => advance("chapters", fraction, label)
    );
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
    chapters = processed.chapters;
    summary = processed.summary;
    keyPoints = processed.keyPoints;
    title = processed.title || (extracted.title ?? "");
  } else if (
    singleSource?.type === "dokumen" &&
    !prefs.assignment &&
    extracted.text.length > 40000
  ) {
    // F8: buku/modul tebal → rangkum bertahap per bagian.
    advance("chapters", 0.1, "Buku panjang terdeteksi — merangkum per bagian...");
    const processed = await processLongDocumentToChapters(
      extracted.text,
      prefs,
      (fraction: number, label: string) => advance("chapters", fraction, label)
    );
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
    chapters = processed.chapters;
    summary = processed.summary;
    keyPoints = processed.keyPoints;
    if (processed.title) title = processed.title;
  } else {
    advance("chapters", 0.3, "Membagi materi menjadi bab-bab...");
    chapters = await processSubtitleToChapters(
      extracted.text,
      extracted.segments,
      prefs
    );
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
    advance("chapters", 0.8, "Membuat ringkasan...");
    summary = await generateAiSummary(extracted.text, prefs);
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
  }

  // Judul placeholder generik (mis. file "catatan.txt" dari topik chat) →
  // minta AI membuat judul sesuai isi materi. Gagal/tanpa AI key → pertahankan
  // judul lama (fallback "Ringkasan Materi" di bawah).
  if (
    !title ||
    WEAK_NOTE_TITLE_RE.test(title.trim())
  ) {
    advance("chapters", 0.92, "Menentukan judul catatan...");
    try {
      const aiTitle = await generateAiTitle(extracted.text, prefs);
      if (aiTitle) title = aiTitle;
    } catch (e) {
      console.warn("[notesProcessor] Judul AI gagal — pakai judul lama:", e);
    }
    if (input.jobId && (await isJobCancelled(input.jobId))) {
      throw new JobCancelledError();
    }
  }
  done("chapters", "Bab-bab selesai ditulis.");

  const requestedChapters = clampChapterCount(prefs.chapterCount);
  if (requestedChapters && chapters.length > requestedChapters) {
    chapters = chapters.slice(0, requestedChapters).map((c, i) => ({ ...c, id: i + 1 }));
  } else if (requestedChapters && chapters.length < requestedChapters) {
    console.warn(
      `[notesProcessor] AI menghasilkan ${chapters.length} bab, diminta ${requestedChapters} — hasil tetap dipakai (topik yang tersisa digabung).`
    );
  }

  const note: Note = {
    id: noteId,
    title: title || "Ringkasan Materi",
    subject: input.prefs.subject?.trim() || (SUBJECT_BY_SOURCE[sourceType] ?? "Materi"),
    user_id: input.userId || undefined,
    sourceUrl: extracted.sourceUrl,
    chunkCount: 0,
    createdAt: new Date().toISOString(),
    chapters,
    summary,
    keyPoints,
    noteType: prefs.noteType ?? "rangkuman",
  };
  let references: SearchSource[] = [];

  // Unduh gambar yang dipilih AI dari halaman web → simpan ke local agar
  // tampil stabil di catatan. Gagal tidak menggagalkan proses.
  if (singleSource?.type === "web" && !isFast) {
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
  if (singleSource?.type !== "web" && !isFast) {
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
  if (input.jobId && (await isJobCancelled(input.jobId))) {
    throw new JobCancelledError();
  }
  if (chapters && chapters.length > 0) {
    if (isFast) {
      // Mode CEPAT: lewati validasi web & referensi agar selesai secepatnya.
      advance("enrichment", 0.4, "Mode cepat — menyingkat langkah validasi...");
      // Bersihkan marker gambar yang mungkin tersisa (mode cepat tanpa gambar).
      chapters = chapters.map((c) => ({
        ...c,
        content: c.content
          .replace(
            /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
            (_m, alt: string) => `*${alt || "ilustrasi"}*`
          )
          .trim(),
      }));
      note.chapters = chapters;
      done("enrichment", "Validasi dilewati (mode cepat).");
    } else {
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
            ),
          // Bahasa enrichment mengikuti bahasa catatan (id/en).
          prefs.bahasa
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
      done("enrichment", "Validasi & enrichment selesai.");
    }
  } else {
    done("enrichment", "Tidak ada bab untuk divalidasi.");
  }
  note.chapters = chapters;

  // FASE 4: RAG — chunk, embed, simpan (80-90%)
  if (input.jobId && (await isJobCancelled(input.jobId))) {
    throw new JobCancelledError();
  }
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
  if (!isFast) {
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
  }

  // FASE 5: Kuis & flashcards otomatis sesuai Mode Belajar (90-100%)
  if (input.jobId && (await isJobCancelled(input.jobId))) {
    throw new JobCancelledError();
  }
  const studyCounts: Record<string, number> = { ringkas: 0, standar: 5, lengkap: 10 };
  // Mode CEPAT: tanpa kuis & flashcards — prioritas kecepatan selesai.
  const studyCount = isFast ? 0 : (studyCounts[prefs.studyMode ?? "standar"] ?? 0);
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
    warnings:
      failures.length > 0
        ? failures.map((f) => `${f.label}: ${f.error}`)
        : undefined,
  };
}
