import type { AssistantSource } from "./types";

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Retrieval finds candidates. An explicit note citation makes one visible. */
export function citedNoteSources(answer: string, candidates: AssistantSource[]): AssistantSource[] {
  const titles = new Set<string>();
  const citation = /(?:sumber(?: catatan)?|note sources?|sources?)[*_\t ]*:[\t ]*(?:catatan\s+|note\s+)?["“„]([^"”\r\n]+)["”]/gi;
  for (const match of answer.matchAll(citation)) titles.add(normalize(match[1]));

  const found = new Map<string, AssistantSource>();
  for (const source of candidates) {
    if (!source.noteId || !titles.has(normalize(source.noteTitle))) continue;
    const previous = found.get(source.noteId);
    if (!previous || (source.similarity ?? 0) > (previous.similarity ?? 0)) found.set(source.noteId, source);
  }
  return [...found.values()];
}
