import type { AssistantSuggestion } from "@/lib/assistant/types";

/** Reject malformed, oversized, or unactionable model output. Never invent a template fallback. */
export function parseAssistantSuggestions(value: unknown): AssistantSuggestion[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(items) || items.length !== 3) return [];
  const result: AssistantSuggestion[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return [];
    const { label, kind, prompt } = item as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim() || label.length > 90) return [];
    if (kind !== "send" && kind !== "quiz" && kind !== "flashcards") return [];
    if (kind === "send" && (typeof prompt !== "string" || !prompt.trim() || prompt.length > 600)) return [];
    if (prompt !== undefined && typeof prompt !== "string") return [];
    result.push({ label: label.trim(), kind, ...(kind === "send" ? { prompt: String(prompt).trim() } : {}) });
  }
  return new Set(result.map((item) => item.label.toLocaleLowerCase())).size === 3 ? result : [];
}
