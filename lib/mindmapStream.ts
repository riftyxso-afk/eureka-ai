export type MindmapConcept = { label: string; detail: string };
export type MindmapBranch = { id: number; concepts: MindmapConcept[] };

export function mindmapBranch(value: unknown, chapterIds: number[]): MindmapBranch | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { id?: unknown; concepts?: unknown };
  if (typeof item.id !== "number" || !chapterIds.includes(item.id) || !Array.isArray(item.concepts)) return null;
  const concepts = item.concepts.flatMap(v => v && typeof v.label === "string" && v.label.trim() && typeof v.detail === "string" ? [{ label: v.label.trim().slice(0, 60), detail: v.detail.trim().slice(0, 500) }] : []).slice(0, 3);
  return concepts.length ? { id: item.id, concepts } : null;
}
