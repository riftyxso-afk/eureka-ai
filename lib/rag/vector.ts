export const NOTE_EMBEDDING_DIMENSIONS = 1536;

/** Never pad a vector from a different model: its coordinates are incompatible. */
export function serializeNoteEmbedding(embedding?: number[]): string | null {
  if (!embedding || embedding.length !== NOTE_EMBEDDING_DIMENSIONS || embedding.some((n) => !Number.isFinite(n))) return null;
  return `[${embedding.map((n) => n.toFixed(6)).join(",")}]`;
}

/** Literal words only; user input must not become a Postgres tsquery expression. */
export function noteSearchTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase("id-ID").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3))].slice(0, 8);
}
