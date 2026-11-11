import { z } from "zod";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";
import type { StudySeries, StudySource } from "./study-sources-types";

const endpoint = {
  web: "search-tools:brave/search",
  video: "social-media:youtube-scraper/search",
  captions: "social-media:youtube-scraper/transcript",
  paper: "search-tools:arxiv/search",
  stocks: "finance:idx/stock-history",
} as const;

export class ZapiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function hasZapi() {
  return Boolean(process.env.ZAPI_API_KEY?.trim());
}

const cache = new Map<string, { data: unknown; expires: number }>();

async function run(source: keyof typeof endpoint, params: Record<string, string>, signal?: AbortSignal) {
  const key = process.env.ZAPI_API_KEY?.trim();
  if (!key) throw new ZapiError("Sumber Zapi belum diaktifkan.", 503);
  const url = new URL("https://api.zapi.ink/v1/" + endpoint[source]);
  url.search = new URLSearchParams(params).toString();
  const cacheKey = url.href;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  let response: Response;
  const timeout = AbortSignal.timeout(12000);
  try {
    response = await fetch(url, {
      headers: { "x-api-key": key, Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new ZapiError("Sumber belum merespons. Coba lagi.", 502);
  }
  if (!response.ok) {
    if (response.status === 429) throw new ZapiError("Kuota sumber sedang terbatas. Coba lagi nanti.", 429);
    if (response.status === 404 && source === "captions") return null;
    throw new ZapiError("Sumber Zapi belum bisa diakses.", 502);
  }
  const { data } = z.object({ data: z.unknown() }).parse(await response.json());
  if (cache.size >= 256) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { data, expires: Date.now() + (source === "stocks" ? 60_000 : 300_000) });
  return data;
}

const cleanText = (value: unknown, length: number) => typeof value === "string"
  ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, length)
  : "";

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.href.length > 600) return null;
    return url;
  } catch {
    return null;
  }
}

const itemsSchema = z.object({ items: z.array(z.record(z.string(), z.unknown())) });

export async function findStudySources(kind: StudySource["kind"], query: string, signal?: AbortSignal): Promise<StudySource[]> {
  const params: Record<string, string> = kind === "web" ? { query, country: "id", safesearch: "strict" }
    : kind === "video" ? { query, type: "videos", gl: "ID", hl: "id" }
      : { query, count: "8" };
  const data = await run(kind, params, signal);
  const { items } = itemsSchema.parse(data);
  const results: StudySource[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const title = cleanText(item.title, 230);
    const parsed = safeUrl(item.url);
    if (!title || !parsed) continue;
    let url = parsed.href;
    let byline = parsed.hostname;
    if (kind === "video") {
      const id = extractYoutubeVideoId(url);
      if (!id || item.isLive === true) continue;
      url = "https://www.youtube.com/watch?v=" + id;
      byline = cleanText((item.channel as { name?: unknown } | undefined)?.name, 120) || "YouTube";
    } else if (kind === "paper") {
      if (parsed.hostname !== "arxiv.org" || !parsed.pathname.startsWith("/abs/")) continue;
      url = "https://arxiv.org" + parsed.pathname;
      byline = Array.isArray(item.authors) ? item.authors.slice(0, 4).map(a => cleanText(a, 60)).filter(Boolean).join(", ") : "arXiv";
    }
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({
      kind, title, url, byline,
      excerpt: cleanText(kind === "paper" ? item.summary : kind === "video" ? item.description : item.snippet, 1100),
      publishedAt: kind === "paper" ? cleanText(item.publishedAt, 32) : undefined,
    });
    if (results.length === (kind === "paper" ? 8 : 5)) break;
  }
  return results;
}

export async function getStudySeries(code: string, signal?: AbortSignal): Promise<StudySeries> {
  const data = await run("stocks", { code, length: "30" }, signal);
  const { items, name } = itemsSchema.extend({ name: z.string().optional() }).parse(data);
  const points = new Map<string, number>();
  for (const row of items) {
    const date = cleanText(row.date, 10);
    const close = typeof row.close === "number" || typeof row.close === "string" ? Number(row.close) : NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close) && close > 0) points.set(date, close);
  }
  return { code, name: cleanText(name, 150) || code, points: [...points].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, close]) => ({ date, close })) };
}

export async function getZapiCaptions(id: string, signal?: AbortSignal) {
  const data = await run("captions", { id }, signal);
  const parsed = z.object({
    title: z.unknown().optional(),
    segments: z.array(z.record(z.string(), z.unknown())).optional(),
    transcript: z.unknown().optional(),
  }).safeParse(data);
  if (!parsed.success) return null;
  const segments = parsed.data.segments ?? (Array.isArray(parsed.data.transcript) ? parsed.data.transcript : []);
  const clean = segments.slice(0, 3000).flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const text = cleanText(row.text, 800);
    const start = row.start === null || row.start === "" ? NaN : Number(row.start);
    if (!text || !Number.isFinite(start) || start < 0) return [];
    return [{ text, offsetMs: Math.round(start * 1000), durationMs: Math.max(0, Number(row.duration) || 0) * 1000 }];
  });
  return clean.length ? { title: cleanText(parsed.data.title, 230) || "Video YouTube", segments: clean } : null;
}
