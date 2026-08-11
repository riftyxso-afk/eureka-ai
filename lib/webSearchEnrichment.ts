/**
 * Enrichment web search PER-BAB: setelah catatan dirangkum dari sumber apa pun
 * (YouTube, dokumen, audio, video, web), setiap bab dicari datanya di web via
 * Firecrawl untuk:
 * - validasi fakta/angka/tanggal/nama,
 * - informasi tambahan yang memperkaya penjelasan,
 * - contoh/ilustrasi praktis.
 *
 * Hasil validasi disisipkan INLINE di paragraf relevan (marker ^[n]) dan semua
 * sumber dikumpulkan untuk bagian "Sumber & Referensi" di akhir catatan.
 * Maksimal 5 sumber per catatan (2 per bab). Gagal pada satu bab tidak
 * menggagalkan bab lain / proses utama.
 */
import { aiChatJson, extractJsonObject, hasAiKey } from "@/lib/ai";
import {
  firecrawlSearch,
  isFirecrawlConfigured,
  scrapeWebUrl,
} from "@/lib/firecrawl";
import type { NoteChapter, SearchSource } from "@/lib/types";

const MAX_TOTAL_SOURCES = 5;
const MAX_SOURCES_PER_CHAPTER = 2;
const MIN_CHAPTER_LENGTH = 200;
const SCRAPE_CONTENT_LIMIT = 4000;
const SNIPPET_MIN_LENGTH = 150;

export interface WebSearchEnrichmentResult {
  chapters: NoteChapter[];
  references: SearchSource[];
  totalSearches: number;
}

export function isWebSearchEnrichmentAvailable(): boolean {
  return isFirecrawlConfigured() && hasAiKey();
}

interface ScrapedSource {
  url: string;
  title: string;
  content: string;
}

/** Query pencarian satu bab (AI): pendek & spesifik. */
async function generateSearchQuery(
  noteTitle: string,
  chapterTitle: string,
  chapterPreview: string
): Promise<string> {
  const parsed = await aiChatJson<{ query?: unknown }>(
    {
      system:
        "Kamu adalah generator kata kunci pencarian yang ahli. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
      user: `Catatan belajar: "${noteTitle}"
Bab: "${chapterTitle}"
Isi bab (cuplikan): ${chapterPreview.slice(0, 600)}

Buat 1 search query pendek dan spesifik (maksimal 12 kata, bahasa Indonesia) untuk mencari di web:
1. Fakta/angka/tanggal/nama yang bisa memvalidasi isi bab
2. Informasi tambahan untuk memperkaya penjelasan
3. Contoh nyata atau ilustrasi praktis

Output HANYA JSON object, tanpa teks lain:
{"query": "..."}`,
      json: true,
      maxTokens: 200,
      temperature: 0.3,
    },
    (raw) => extractJsonObject(raw)
  );
  const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
  if (!query) throw new Error("AI tidak menghasilkan query pencarian.");
  return query.slice(0, 200);
}

/**
 * Cari di Firecrawl lalu ambil konten tiap hasil. Deskripsi hasil pencarian
 * yang sudah cukup panjang dipakai langsung (hemat waktu); hasil pendek
 * di-scrape halamannya.
 */
async function searchAndScrape(
  query: string,
  maxResults: number
): Promise<ScrapedSource[]> {
  const results = await firecrawlSearch(query, maxResults);
  const out: ScrapedSource[] = [];

  for (const r of results.slice(0, maxResults)) {
    try {
      if (r.description.length >= SNIPPET_MIN_LENGTH) {
        out.push({ url: r.url, title: r.title, content: r.description });
        continue;
      }
      const scraped = await scrapeWebUrl(r.url);
      const content = scraped.text.slice(0, SCRAPE_CONTENT_LIMIT);
      if (!content.trim()) continue;
      out.push({
        url: r.url,
        title: r.title || scraped.title,
        content,
      });
    } catch {
      // hasil ini gagal -> lanjut ke hasil berikutnya
    }
  }
  return out;
}

interface EnrichmentData {
  validationFacts: string[];
  enrichmentPoints: string[];
  examples: string[];
}

/** AI mengekstrak fakta validasi + info tambahan + contoh dari hasil pencarian. */
async function extractEnrichmentData(
  chapterContent: string,
  searchResults: ScrapedSource[]
): Promise<EnrichmentData> {
  const parsed = await aiChatJson<EnrichmentData>(
    {
      system:
        "Kamu adalah pemeriksa fakta (fact-checker) yang teliti. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
      user: `Catatan belajar (cuplikan bab):
${chapterContent.slice(0, 4000)}

Hasil pencarian web yang memvalidasi materi:
${searchResults
  .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 1200)}`)
  .join("\n\n---\n\n")}

Ekstrak dari hasil pencarian:
1. "validationFacts": 1-3 fakta valid (angka, tanggal, nama, statistik) yang sesuai dan memperkuat isi bab.
2. "enrichmentPoints": 1-3 informasi tambahan yang memperkaya penjelasan bab (JANGAN mengulang isi bab).
3. "examples": 1-2 contoh nyata atau ilustrasi praktis yang bisa disisipkan ke bab.
Jangan menulis fakta yang tidak didukung oleh sumber di atas.

Output HANYA JSON object, tanpa teks lain:
{"validationFacts": ["..."], "enrichmentPoints": ["..."], "examples": ["..."]}`,
      json: true,
      maxTokens: 1800,
      temperature: 0.2,
    },
    (raw) => {
      const obj = extractJsonObject(raw) as Record<string, unknown>;
      const clean = (v: unknown): string[] =>
        Array.isArray(v)
          ? (v as unknown[])
              .map((s) => (typeof s === "string" ? s.trim() : ""))
              .filter(Boolean)
              .slice(0, 3)
          : [];
      return {
        validationFacts: clean(obj.validationFacts),
        enrichmentPoints: clean(obj.enrichmentPoints),
        examples: clean(obj.examples),
      } as EnrichmentData;
    }
  );
  return parsed;
}

/** AI menulis ulang bab dengan enrichment inline + marker rujukan ^[n]. */
async function enrichChapterContent(
  chapter: NoteChapter,
  data: EnrichmentData,
  sources: SearchSource[]
): Promise<string> {
  const parsed = await aiChatJson<{ content?: unknown }>(
    {
      system:
        'Kamu adalah penulis catatan belajar yang teliti. Jawab HANYA JSON object valid — nilai "content" boleh berformat markdown, tanpa teks di luar JSON.',
      user: `Bab catatan belajar saat ini:

${chapter.content}

Data validasi & enrichment dari sumber web tepercaya:
- Fakta validasi: ${data.validationFacts.join("; ") || "(tidak ada)"}
- Info tambahan: ${data.enrichmentPoints.join("; ") || "(tidak ada)"}
- Contoh nyata: ${data.examples.join("; ") || "(tidak ada)"}

Sumber yang boleh dirujuk (n = nomor sumber):
${sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n")}

TUGAS:
1. Sisipkan fakta validasi, info tambahan, dan contoh ke paragraf yang PALING relevan secara natural.
2. Tandai setiap kalimat yang berasal dari sumber web dengan marker ^[n] tepat setelah kalimat, contoh: "Fotosintesis mengubah sekitar 6% energi cahaya menjadi energi kimia^[1]."
3. Pertahankan struktur heading (###), bullet, dan bagian lain yang sudah ada — JANGAN merombak isi selain menambah.
4. Jangan membuat bagian referensi di bab ini (dibuat otomatis di akhir catatan).
5. Jangan menambah fakta yang tidak ada di data di atas.

Output HANYA JSON object, tanpa teks lain:
{"content": "<bab lengkap dengan enrichment>"}`,
      json: true,
      maxTokens: 5000,
      temperature: 0.3,
    },
    (raw) => {
      const obj = extractJsonObject(raw) as Record<string, unknown>;
      const content =
        typeof obj.content === "string" && obj.content.trim()
          ? obj.content.trim()
          : "";
      if (!content) throw new Error("AI tidak menghasilkan konten enrichment.");
      return { content };
    }
  );
  return typeof parsed.content === "string" ? parsed.content : "";
}

/**
 * Enrichment utama: loop tiap bab → query → search (budget 5 sumber) →
 * ekstrak data → sisipkan inline. Bab yang gagal/tidak memenuhi syarat
 * dikembalikan apa adanya.
 */
export async function enrichChaptersWithWebSearch(
  noteTitle: string,
  chapters: NoteChapter[],
  onProgress?: (done: number, total: number, label: string) => void
): Promise<WebSearchEnrichmentResult> {
  if (!isWebSearchEnrichmentAvailable()) {
    return { chapters, references: [], totalSearches: 0 };
  }

  const enriched: NoteChapter[] = [];
  const references: SearchSource[] = [];
  let totalSearches = 0;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const skip =
      chapter.content.length < MIN_CHAPTER_LENGTH ||
      /sumber|referensi|daftar pustaka|bibliografi/i.test(chapter.title);

    if (skip || totalSearches >= MAX_TOTAL_SOURCES) {
      enriched.push(chapter);
      continue;
    }

    try {
      onProgress?.(i, chapters.length, `Memvalidasi: ${chapter.title}`);
      const allowed = Math.min(
        MAX_SOURCES_PER_CHAPTER,
        MAX_TOTAL_SOURCES - totalSearches
      );
      if (allowed <= 0) {
        enriched.push(chapter);
        continue;
      }

      const query = await generateSearchQuery(
        noteTitle,
        chapter.title,
        chapter.content.slice(0, 500)
      );
      const results = await searchAndScrape(query, allowed);
      if (results.length === 0) {
        enriched.push(chapter);
        continue;
      }
      totalSearches += results.length;

      const data = await extractEnrichmentData(chapter.content, results);
      const hasData =
        data.validationFacts.length > 0 ||
        data.enrichmentPoints.length > 0 ||
        data.examples.length > 0;
      if (!hasData) {
        enriched.push(chapter);
        continue;
      }

      const sources: SearchSource[] = results.map((r) => ({
        url: r.url,
        title: r.title.slice(0, 160),
        snippet: r.content.trim().replace(/\s+/g, " ").slice(0, 240),
      }));

      const newContent = await enrichChapterContent(chapter, data, sources);
      enriched.push({ ...chapter, content: newContent, sources });
      references.push(...sources);
    } catch (e) {
      console.warn(`[webSearchEnrichment] Bab "${chapter.title}" dilewati:`, e);
      enriched.push(chapter);
    }
  }

  const seen = new Set<string>();
  const uniqueReferences = references.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return {
    chapters: enriched,
    references: uniqueReferences,
    totalSearches,
  };
}

/** Format markdown untuk bab "Sumber & Referensi". */
export function buildReferencesMarkdown(references: SearchSource[]): string {
  return references
    .map(
      (r, i) =>
        `${i + 1}. **[${r.title}](${r.url})**  \n   ${r.snippet.trim()}`
    )
    .join("\n\n");
}