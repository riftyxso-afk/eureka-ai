/**
 * Pencarian web via Tavily — fallback otomatis saat Firecrawl gagal/kosong.
 * Butuh TAVILY_API_KEY di env server (Vercel project env / .env VPS).
 * Tanpa key, fungsi ini tidak dipanggil dan tidak pernah crash.
 */
import { isNoiseSearchResult } from "./firecrawl";
import type { SearchResult } from "./firecrawl";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

function getTavilyApiKey(): string {
  return process.env.TAVILY_API_KEY ?? "";
}

/** Apakah fallback Tavily tersedia (key terisi)? */
export function isTavilyConfigured(): boolean {
  return getTavilyApiKey().length > 0;
}

/**
 * Cari materi di web via Tavily, hasil diformat sama persis dengan
 * SearchResult Firecrawl (url/title/description) + filter noise + dedup.
 * Return [] tanpa crash bila key belum diisi atau API gagal.
 */
export async function tavilySearch(
  query: string,
  limit = 3
): Promise<SearchResult[]> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim().slice(0, 200),
        max_results: limit,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[tavilySearch] Search gagal (${res.status}).`);
      return [];
    }
    const data = (await res.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>;
    };
    const seen = new Set<string>();
    return (data.results ?? [])
      .map((r) => ({
        url: String(r.url ?? ""),
        title: String(r.title ?? "").trim().slice(0, 160),
        description: String(r.content ?? "").trim().slice(0, 300),
      }))
      .filter(
        (r: SearchResult) =>
          r.url &&
          r.url.startsWith("http") &&
          !isNoiseSearchResult(r.url, r.title)
      )
      .filter((r: SearchResult) => {
        const key = r.url.split("#")[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  } catch (e) {
    console.warn("[tavilySearch] Search gagal:", (e as Error)?.message ?? e);
    return [];
  }
}