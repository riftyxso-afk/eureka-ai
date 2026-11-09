import type { WebSearchItem } from "./types";

/** Shared validation for SSE, saved history, and external source links. */
export function normalizeWebResults(values: unknown): WebSearchItem[] {
  if (!Array.isArray(values)) return [];
  const results: WebSearchItem[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || typeof value.url !== "string") continue;
    try {
      const url = new URL(value.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.hash = "";
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      const domain = url.hostname.replace(/^www\./, "");
      results.push({
        url: url.href,
        domain,
        title: typeof value.title === "string" ? value.title.trim().slice(0, 300) || domain : domain,
        description: typeof value.description === "string" ? value.description.slice(0, 1500) : "",
      });
      if (results.length === 10) break;
    } catch {
      // Ignore malformed provider URLs without affecting the answer.
    }
  }
  return results;
}
