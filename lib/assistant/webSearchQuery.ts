import { cleanSearchQuery } from "../firecrawl";

type SearchMessage = { role: string; content: string };

// These requests need a subject from the conversation; a named new subject does not.
const GENERIC_REQUEST = /\b(?:apa|itu|ini|nya|yang|yg|dan|di|ke|dari|untuk|dengan|lebih|lagi|saja|dong|ya|buatkan|buat|bikin|berikan|beri|contoh|kartu|hafalan|flashcards?|kuis|quiz|ringkasan|rangkuman|singkat|lanjutkan|lanjut|jelas|jelaskan|detail|lengkap|mendalam|rumus|sumber|referensi|tadi|tersebut|terkait|terbaru|tentangnya|mencatatnya|penulisnya|asalnya|sejarahnya|how|what|is|the|this|that|it|of|a|an|explain|more|examples?|summarize)\b/gi;

function hasSubject(text: string) {
  return cleanSearchQuery(text).replace(GENERIC_REQUEST, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().length > 2;
}

/** Prioritize the current question. Only inherit context for subjectless follow-ups. */
export function buildWebSearchQuery(question: string, history: readonly SearchMessage[]): string {
  const current = cleanSearchQuery(question);
  if (hasSubject(question)) return current;

  // Never prepend unrelated earlier prompts or an assistant's suggested next activity.
  for (const message of [...history].reverse()) {
    if (message.role !== "user" || message.content.trim() === question.trim()) continue;
    if (hasSubject(message.content)) {
      const topic = cleanSearchQuery(message.content).slice(0, 110);
      return cleanSearchQuery(`${topic} ${current.slice(0, 45)}`);
    }
  }
  return current;
}
