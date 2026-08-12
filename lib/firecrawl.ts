/**
 * Ekstraksi konten dari halaman web via Firecrawl (scrape).
 * Butuh FIRECRAWL_API_KEY di .env.local — daftar & buat key di https://firecrawl.dev
 */
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

export interface WebImage {
  url: string;
  alt: string;
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

export interface WebScrapeResult {
  text: string;
  title: string;
  sourceUrl: string;
  images: WebImage[];
}

export function isFirecrawlConfigured(): boolean {
  return FIRECRAWL_API_KEY.length > 0;
}

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const IMAGE_BLOCK_RE = /\[!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\]\(https?:\/\/[^)\s]+\)/g;

/** Ubah HTML kasar menjadi teks polos yang bisa dijadikan catatan. */
function htmlToText(html: string): string {
  const withoutTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\u00a0/g, " ");
  return withoutTags.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function isLikelyContentImage(url: string): boolean {
  const clean = url.toLowerCase();
  if (clean.includes(".svg") || clean.includes("data:")) return false;
  if (/logo|icon|avatar|emoji|sprite|banner|favicon|tracking|pixel/i.test(clean)) {
    return false;
  }
  return true;
}

/** Kumpulkan URL gambar dari markdown hasil scrape (maks 30). */
function extractImagesFromMarkdown(markdown: string): WebImage[] {
  const seen = new Set<string>();
  const images: WebImage[] = [];

  const push = (url: string, alt: string) => {
    if (!isLikelyContentImage(url)) return;
    const key = url.split("?")[0];
    if (seen.has(key) || images.length >= 30) return;
    seen.add(key);
    images.push({ url, alt: alt.trim().slice(0, 120) || "Ilustrasi" });
  };

  // Format `[![alt](src)](link)` → pakai src dalam markdown image
  const blockRe = new RegExp(IMAGE_BLOCK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(markdown)) !== null) push(m[2], m[1]);
  const inlineRe = new RegExp(IMAGE_MARKDOWN_RE.source, "g");
  while ((m = inlineRe.exec(markdown)) !== null) push(m[2], m[1]);
  return images;
}

/** Ambil teks markdown + daftar gambar dari sebuah URL halaman web. */
export async function scrapeWebUrl(url: string): Promise<WebScrapeResult> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error(
      "Scrape web butuh FIRECRAWL_API_KEY di .env.local. Tambahkan key-nya (dapat di firecrawl.dev), lalu coba lagi."
    );
  }

  // Body minimal agar kompatibel dengan v2 (key opsional bisa berubah);
  // kalau masih 400 BAD_REQUEST, coba tanpa key opsional.
  let res = await scrapeWithBody(url, true);
  if (res.status === 400) {
    res = await scrapeWithBody(url, false);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Firecrawl gagal (${res.status}). ${detail.slice(0, 160) || "Periksa kembali URL atau key-nya."}`
    );
  }

  const data = await res.json();
  let markdown = String(data?.data?.markdown ?? "").trim();

  // Fallback: beberapa situs hanya mengembalikan HTML — ubah ke teks polos.
  if (!markdown) {
    const html = String(data?.data?.html ?? data?.data?.rawHtml ?? "").trim();
    if (html) markdown = htmlToText(html);
  }

  if (!markdown) {
    throw new Error(
      "Halaman tidak menghasilkan teks (mungkin butuh login/browser). Coba URL lain."
    );
  }

  const images = extractImagesFromMarkdown(markdown);
  const textWithoutImages = markdown.replace(IMAGE_MARKDOWN_RE, "").trim();

  return {
    text: textWithoutImages,
    title:
      String(data?.data?.metadata?.title ?? "").trim() || "Catatan dari Web",
    sourceUrl: url,
    images,
  };
}

async function scrapeWithBody(url: string, withOptions: boolean): Promise<Response> {
  const body: Record<string, unknown> = {
    url,
    formats: ["markdown"],
  };
  if (withOptions) {
    body.onlyMainContent = true;
  }
  return fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
}

/** Cari materi relevan di web via Firecrawl (untuk validasi/penambah informasi). */
export async function firecrawlSearch(query: string, limit = 3): Promise<SearchResult[]> {
  if (!FIRECRAWL_API_KEY) return [];

  let res = await fetch(FIRECRAWL_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query.slice(0, 200),
      limit,
      country: "id",
      lang: "id",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 400) {
    // Key opsional bisa berubah antar versi → coba body minimal
    res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query.slice(0, 200), limit }),
      signal: AbortSignal.timeout(30000),
    });
  }

  if (!res.ok) {
    console.warn(`[firecrawlSearch] Search gagal (${res.status}).`);
    return [];
  }

  const data = await res.json();
  // v2: hasil ada di data.web; v1 lama: data.data (array). Dukung keduanya.
  const results = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.data?.web)
      ? data.data.web
      : [];
  return results
    .map((r: Record<string, unknown>) => ({
      url: String(r.url ?? ""),
      title: String(r.title ?? "").trim().slice(0, 160),
      description: String(r.description ?? "").trim().slice(0, 300),
    }))
    .filter((r: SearchResult) => r.url && r.url.startsWith("http"));
}
