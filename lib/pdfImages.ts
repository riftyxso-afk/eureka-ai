/**
 * Koleksi & pemilihan gambar untuk dokumen PDF (opsi "Sertakan gambar").
 *
 * Sumber gambar (urut prioritas):
 *  1. Gambar yang sudah tertanam di bab catatan (![alt](url)) — paling relevan.
 *  2. Firecrawl scrape halaman sumber catatan (note.sourceUrl) — bila ada key.
 *
 * Gambar disaring & diurutkan: host CDN yang stabil (Wikimedia, Unsplash,
 * Pexels, dll) didahulukan agar gampang dirender dan selalu tampil di PDF.
 * Pemilihan gambar per bab memakai heuristik kecocokan kata (alt vs judul bab)
 * dengan fallback round-robin — murni deterministik, tanpa panggilan AI ekstra.
 *
 * Tahap ini TIDAK boleh menggagalkan PDF: bila tidak ada gambar / scrape gagal,
 * pipeline tetap lanjut tanpa gambar.
 */
import { isFirecrawlConfigured, scrapeWebUrl, firecrawlSearch } from "./firecrawl";
import type { WebImage } from "./firecrawl";

export interface PdfImage {
  url: string;
  alt: string;
}

/** Gambar yang dipilih untuk satu bab dokumen (chapterIndex = urutan bab hasil enrich). */
export interface ChapterImageMap {
  chapterIndex: number;
  url: string;
  alt: string;
}

export type PdfImagesProgressFn = (percent: number, message: string) => void;

/** Host CDN yang dikenal stabil & bisa dirender reportlab/pdfkit tanpa masalah. */
const CDN_HOSTS: RegExp[] = [
  /(^|\.)wikimedia\.org$/,
  /(^|\.)wikipedia\.org$/,
  /images\.unsplash\.com/,
  /(^|\.)unsplash\.com$/,
  /images\.pexels\.com/,
  /(^|\.)pexels\.com$/,
  /cdn\.pixabay\.com/,
  /(^|\.)pixabay\.com$/,
  /i\.imgur\.com/,
  /(^|\.)imgur\.com$/,
  /i\.ibb\.co/,
  /(^|\.)ibb\.co$/,
  /(^|\.)cloudfront\.net$/,
  /(^|\.)githubusercontent\.com$/,
  /(^|\.)googleusercontent\.com$/,
  /(^|\.)staticflickr\.com$/,
  /(^|\.)cloudinary\.com$/,
  /(^|\.)storyset\.com$/,
  /(^|\.)freepik\.com$/,
];

const IMAGE_MD_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isStableHost(url: string): boolean {
  const h = hostOf(url);
  return CDN_HOSTS.some((re) => re.test(h));
}

/**
 * Cegah SSRF: tolak hostname internal/loopback/link-local (localhost, 127.*,
 * 10.*, 192.168.*, 172.16-31.*, 169.254.*, .local, .internal, dll) — URL ini
 * nanti di-fetch server-side (Python urllib di VPS + Node fetch di Vercel).
 */
function isPrivateHost(url: string): boolean {
  let host = hostOf(url);
  if (!host) return true;
  host = host.toLowerCase().replace(/^\.|\.$/g, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    /(^|\.)(local|internal|intranet|home|lan)(\.|$)/.test(host) ||
    /(^|\.)(ip6-localhost|ip6-loopback|metadata)(\.|$)/.test(host)
  ) {
    return true;
  }
  const ip = host.replace(/^\[|\]$/g, "");
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata AWS
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/** URL yang layak dirender di PDF (bukan svg/data/gif/webp/tracking/internal). */
function isUsableImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isPrivateHost(url)) return false;
  const u = url.toLowerCase();
  if (
    u.startsWith("data:") ||
    u.includes(".svg") ||
    u.includes(".gif") ||
    u.includes(".webp") ||
    u.includes("blob:")
  ) {
    return false;
  }
  if (/logo|icon|avatar|emoji|sprite|favicon|pixel|tracking|badge|fallback|placeholder|spacer|loading/i.test(u)) {
    return false;
  }
  return true;
}

/** Ekstrak gambar markdown dari isi bab (maks 10, dedupe). */
export function extractEmbeddedImages(
  chapters: { title?: string; content?: string }[]
): PdfImage[] {
  const seen = new Set<string>();
  const out: PdfImage[] = [];
  for (const c of chapters ?? []) {
    const content = c.content ?? "";
    const re = new RegExp(IMAGE_MD_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const url = m[2].trim();
      if (!isUsableImageUrl(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, alt: (m[1] || "Ilustrasi").trim().slice(0, 120) });
      if (out.length >= 10) return out;
    }
  }
  return out;
}

/**
 * Kumpulkan gambar untuk dokumen:
 *  1. Gambar tertanam di bab catatan (![alt](url)).
 *  2. Firecrawl — cari halaman sumber dari judul catatan (search), lalu
 *     scrape halamannya untuk mengambil gambar (prioritas CDN stabil).
 *
 * Diurutkan dengan host CDN stabil di depan, maks 12 gambar. Tahap ini
 * TIDAK boleh menggagalkan PDF — semua kegagalan dilewati dengan aman.
 */
export async function collectImagesForPdf(
  note: {
    title?: string;
    subject?: string;
    sourceUrl?: string;
    chapters?: { title?: string; content?: string }[];
  },
  onProgress?: PdfImagesProgressFn
): Promise<PdfImage[]> {
  const images: PdfImage[] = [];
  const seen = new Set<string>();
  const push = (img: WebImage) => {
    if (!isUsableImageUrl(img.url) || seen.has(img.url)) return;
    seen.add(img.url);
    images.push({ url: img.url, alt: img.alt || "Ilustrasi" });
  };

  // 1) Gambar tertanam di bab catatan.
  extractEmbeddedImages(note.chapters ?? []).forEach(push);

  // 2) Firecrawl — cari halaman sumber lalu ambil gambarnya.
  if (isFirecrawlConfigured() && images.length < 8) {
    let scrapeUrl: string | null = note.sourceUrl || null;
    if (!scrapeUrl) {
      const query = `${note.title ?? ""} ${note.subject ?? ""}`.trim().slice(0, 150);
      if (query) {
        onProgress?.(40, "Mencari halaman sumber gambar via Firecrawl...");
        try {
          const results = await firecrawlSearch(query, 2);
          scrapeUrl = results.find((r) => r.url?.startsWith("http"))?.url ?? null;
        } catch (e) {
          console.warn("[pdfImages] Firecrawl search dilewati:", e);
        }
      }
    }
    if (scrapeUrl) {
      onProgress?.(60, "Mengambil gambar halaman sumber via Firecrawl...");
      try {
        const scraped = await scrapeWebUrl(scrapeUrl);
        (scraped.images ?? []).forEach(push);
        onProgress?.(
          85,
          scraped.images.length > 0
            ? `Firecrawl: ${scraped.images.length} gambar ditemukan.`
            : "Firecrawl: tidak ada gambar di halaman sumber."
        );
      } catch (e) {
        console.warn("[pdfImages] Firecrawl scrape dilewati:", e);
        onProgress?.(85, "Firecrawl tidak tersedia — pakai gambar yang ada.");
      }
    } else {
      onProgress?.(60, "Tidak ada halaman sumber — pakai gambar yang ada.");
    }
  }

  // Host CDN stabil didahulukan supaya lebih andal dirender di PDF.
  images.sort((a, b) => Number(isStableHost(b.url)) - Number(isStableHost(a.url)));
  return images.slice(0, 12);
}

/* ── Pemilihan gambar per bab (heuristik, tanpa AI) ── */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "are",
  "dan", "yang", "dengan", "pada", "dari", "untuk", "ke", "di", "adalah",
  "ini", "itu", "serta", "contoh", "materi", "bab", "bagian", "tentang",
  "pengertian", "sejarah", "konsep", "dasar", "utama",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Skor kecocokan alt gambar terhadap judul bab (kata yang sama = +2). */
function scoreAlt(alt: string, title: string): number {
  const altTokens = tokens(alt);
  const titleSet = new Set(tokens(title));
  const overlap = altTokens.reduce(
    (acc, w) => acc + (titleSet.has(w) ? 2 : 0),
    0
  );
  return overlap + (altTokens.length ? 0.1 : 0);
}

/**
 * Pilih 1 gambar relevan per bab. Tahap 1: skor kecocokan alt vs judul bab
 * (minimal skor 1 = ada kata sama). Tahap 2: bab tersisa diisi round-robin.
 * Gambar hasil yang valid (URL sungguhan dari koleksi) selalu dikembalikan.
 */
export function assignImagesToChapters(
  chapters: { title: string }[],
  images: PdfImage[],
  onProgress?: PdfImagesProgressFn
): ChapterImageMap[] {
  if (!images.length || !chapters.length) return [];
  onProgress?.(50, "Memilih gambar untuk tiap bab...");

  const used = new Set<string>();
  const out: ChapterImageMap[] = [];

  // 1) Cocokkan alt gambar dengan judul bab.
  for (let idx = 0; idx < chapters.length; idx++) {
    const title = chapters[idx].title;
    let best: PdfImage | null = null;
    let bestScore = 0;
    for (const img of images) {
      if (used.has(img.url)) continue;
      const s = scoreAlt(img.alt, title);
      if (s > bestScore) {
        bestScore = s;
        best = img;
      }
    }
    if (best && bestScore >= 1) {
      used.add(best.url);
      out.push({ chapterIndex: idx, url: best.url, alt: best.alt });
    }
  }

  // 2) Isi sisa bab dengan gambar yang belum terpakai (round-robin).
  const remaining = images.filter((i) => !used.has(i.url));
  if (remaining.length) {
    let ri = 0;
    for (let idx = 0; idx < chapters.length; idx++) {
      if (out.some((o) => o.chapterIndex === idx)) continue;
      if (ri >= remaining.length) break;
      const img = remaining[ri++];
      out.push({ chapterIndex: idx, url: img.url, alt: img.alt });
      used.add(img.url);
    }
  }

  onProgress?.(100, "Gambar siap.");
  return out.slice(0, chapters.length);
}
