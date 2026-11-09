import type { Note } from "../types";

/** Read the current saved note even when vector indexing is missing or out of date. */
export function buildNoteQuestionContext(
  note: Pick<Note, "title" | "summary" | "chapters">,
  chunks: readonly { text?: string }[],
  question: string,
  history: readonly { role: string; content: string }[] = [],
): string {
  const chapters = (note.chapters ?? []).filter(chapter => String(chapter.content ?? "").trim());
  const sections = chapters.length
    ? chapters.map(chapter => ({ title: chapter.title, text: String(chapter.content).trim() }))
    : chunks.filter(chunk => typeof chunk.text === "string" && chunk.text.trim()).map((chunk, i) => ({ title: `Bagian ${i + 1}`, text: chunk.text!.trim() }));
  const summary = String(note.summary ?? "").trim();
  if (!summary && !sections.length) return "";
  const overview = [`CATATAN: ${note.title}`, summary && `RINGKASAN:\n${summary.slice(0, 2000)}`,
    sections.length && `DAFTAR BAGIAN:\n${sections.map(section => section.title).join("\n").slice(0, 1500)}`].filter(Boolean).join("\n\n");
  const all = sections.map(section => `BAB: ${section.title}\n${section.text}`).join("\n\n---\n\n");
  const budget = 24000 - overview.length - 2;
  if (all.length <= budget) return `${overview}\n\n${all}`;

  // Only rank passages within this owned note, without a similarity rejection threshold.
  const words = (text: string) => [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 3))].slice(0, 40);
  const currentTerms = words(question);
  const historyTerms = words(history.filter(message => message.role === "user").slice(-2).map(message => message.content).join(" "));
  const blocks = sections.flatMap(section => {
    const parts = [];
    for (let offset = 0; offset < section.text.length; offset += 1250) {
      const text = section.text.slice(offset, offset + 1400);
      const lower = `${section.title} ${text}`.toLowerCase();
      const score = currentTerms.reduce((sum, term) => sum + (lower.includes(term) ? 3 : 0), 0)
        + historyTerms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      parts.push({ text: `BAB: ${section.title}\n${text}`, score });
    }
    return parts;
  }).sort((a, b) => b.score - a.score);
  let context = overview;
  for (const block of blocks) {
    if (context.length + block.text.length + 7 > 24000) continue;
    context += `\n\n---\n\n${block.text}`;
  }
  return context;
}
