export interface LibraryBook {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  cover?: string;
  url: string;
  source: "Open Library" | "Project Gutenberg";
  readable: boolean;
  description?: string;
}
export type LibrarySource = "all" | "openlibrary" | "gutenberg";
export interface LibraryResult { books: LibraryBook[]; page: number; hasMore: boolean; warnings: string[] }
const cache = new Map<string, { expires: number; promise: Promise<LibraryResult> }>();

async function json(url: string, timeout = 12_000) {
  const response = await fetch(url, { headers: { "User-Agent": "EurekaLearning/1.0 (https://www.eureka-ai.web.id)", Accept: "application/json" }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error("Catalog unavailable");
  return response.json();
}

export async function searchLibrary(query: string, source: LibrarySource, page: number): Promise<LibraryResult> {
  const key = JSON.stringify([query, source, page]);
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.promise;
  const promise = (async () => {
    const searches: Promise<{ books: LibraryBook[]; hasMore: boolean }>[] = [];
    const providers: string[] = [];
    if (source !== "gutenberg") {
      providers.push("Open Library");
      const params = new URLSearchParams({ q: query || "subject:children", page: String(page), limit: "16", fields: "key,title,author_name,first_publish_year,cover_i,ebook_access", lang: "id" });
      searches.push(json(`https://openlibrary.org/search.json?${params}`).then(data => ({
        hasMore: Number(data.numFound ?? data.num_found) > page * 16,
        books: (Array.isArray(data.docs) ? data.docs : []).flatMap((doc: { key?: string; title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; ebook_access?: string }) => {
          const match = /^\/?(?:works\/)?(OL\d+W)$/.exec(doc.key ?? "");
          if (!match || !doc.title) return [];
          return [{ id: `ol-${match[1]}`, title: doc.title, authors: Array.isArray(doc.author_name) ? doc.author_name : [], year: doc.first_publish_year, cover: Number.isInteger(doc.cover_i) && Number(doc.cover_i) > 0 ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined, url: `https://openlibrary.org/works/${match[1]}`, source: "Open Library" as const, readable: doc.ebook_access === "public" }];
        }),
      })));
    }
    if (source !== "openlibrary") {
      providers.push("Project Gutenberg");
      const params = new URLSearchParams({ page: String(page), copyright: "false" });
      if (query) params.set("search", query); else params.set("topic", "children");
      searches.push(json(`https://gutendex.com/books/?${params}`, 6500).then(data => ({
        hasMore: Boolean(data.next),
        books: (Array.isArray(data.results) ? data.results : []).filter((book: { id: number; title: unknown; copyright?: boolean }) => book.copyright === false && Number.isSafeInteger(book.id) && book.id > 0 && typeof book.title === "string" && book.title.trim()).map((book: { id: number; title: string; authors?: { name: string }[]; summaries?: string[] }) => ({
          id: `pg-${book.id}`, title: book.title, authors: (book.authors ?? []).map(author => author.name), url: `https://www.gutenberg.org/ebooks/${book.id}`, source: "Project Gutenberg" as const, readable: true, description: book.summaries?.[0],
        })),
      })));
    }
    const results = await Promise.allSettled(searches);
    const books: LibraryBook[] = []; const warnings: string[] = []; let hasMore = false;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") { books.push(...result.value.books); hasMore ||= result.value.hasMore; }
      else warnings.push(`${providers[index]} belum dapat dihubungi. Coba lagi sebentar.`);
    });
    if (warnings.length === providers.length) throw new Error("Katalog buku belum dapat dihubungi. Silakan coba lagi.");
    return { books, page, hasMore, warnings };
  })();
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 300_000, promise });
  try {
    const result = await promise;
    const entry = cache.get(key);
    if (entry?.promise === promise && result.warnings.length) entry.expires = Date.now() + 30_000;
    return result;
  } catch (error) { if (cache.get(key)?.promise === promise) cache.delete(key); throw error; }
}
