import { z } from "zod";

export const studyMapNodeSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  parentId: z.string().max(40).nullable(),
  label: z.string().trim().min(1).max(90),
  detail: z.string().trim().max(360),
});
export type StudyMapNode = z.infer<typeof studyMapNodeSchema>;

/** Accept only a rooted, parent-first tree, including during a partial stream. */
export function appendStudyMapNode(nodes: StudyMapNode[], value: unknown): StudyMapNode[] {
  const parsed = studyMapNodeSchema.safeParse(value);
  if (!parsed.success || nodes.length >= 24) return nodes;
  const node = parsed.data;
  if (nodes.some(item => item.id === node.id)) return nodes;
  if (!nodes.length) return node.parentId === null ? [node] : nodes;
  if (!node.parentId || !nodes.some(item => item.id === node.parentId)) return nodes;
  let parent = nodes.find(item => item.id === node.parentId), depth = 1;
  while (parent?.parentId) { depth++; parent = nodes.find(item => item.id === parent!.parentId); }
  if (depth > 3) return nodes;
  return [...nodes, node];
}

export const studyMindmapSchema = z.array(studyMapNodeSchema).max(24).transform(nodes =>
  nodes.reduce<StudyMapNode[]>((valid, node) => appendStudyMapNode(valid, node), []));

export function parseStudyMapLine(nodes: StudyMapNode[], line: string) {
  try { return appendStudyMapNode(nodes, JSON.parse(line.trim())); } catch { return nodes; }
}
