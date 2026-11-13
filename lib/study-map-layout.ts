import type { StudyMapNode } from "./study-mindmap";
export const MAP_NODE_WIDTH = 184;
export const MAP_NODE_HEIGHT = 84;
export function layoutStudyMap(nodes: StudyMapNode[], collapsed: ReadonlySet<string>) {
  const root = nodes.find(node => node.parentId === null);
  const positions: { node: StudyMapNode; x: number; y: number }[] = [];
  const edges: { id: string; path: string }[] = [];
  if (!root) return { positions, edges, width: 264, height: 180 };
  const children = (id: string) => collapsed.has(id) ? [] : nodes.filter(node => node.parentId === id);
  const widths = new Map<string, number>();
  function measure(node: StudyMapNode): number {
    const list = children(node.id);
    const width = Math.max(MAP_NODE_WIDTH, list.reduce((sum, child) => sum + measure(child), 0) + Math.max(0, list.length - 1) * 24);
    widths.set(node.id, width);
    return width;
  }
  const width = measure(root) + 64;
  function place(node: StudyMapNode, left: number, depth: number) {
    const x = left + (widths.get(node.id)! - MAP_NODE_WIDTH) / 2, y = 28 + depth * 164;
    positions.push({ node, x, y });
    let childLeft = left;
    for (const child of children(node.id)) {
      const childX = childLeft + widths.get(child.id)! / 2;
      const startX = x + MAP_NODE_WIDTH / 2, startY = y + MAP_NODE_HEIGHT, endY = y + 164;
      edges.push({ id: child.id, path: `M ${startX} ${startY} C ${startX} ${startY + 40}, ${childX} ${endY - 40}, ${childX} ${endY}` });
      place(child, childLeft, depth + 1);
      childLeft += widths.get(child.id)! + 24;
    }
  }
  place(root, 32, 0);
  return { positions, edges, width, height: Math.max(...positions.map(position => position.y)) + MAP_NODE_HEIGHT + 32 };
}
