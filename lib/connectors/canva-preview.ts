import { canvaPreviewSchema, type CanvaPreview } from "./events";

export function readCanvaPreviews(result: unknown): CanvaPreview[] {
  if (!result || typeof result !== "object") return [];
  const data = result as { design?: unknown; items?: unknown; job?: { result?: { designs?: unknown; design?: unknown } } };
  const designs = data.job?.result?.designs ?? data.items ?? [data.job?.result?.design ?? data.design];
  if (!Array.isArray(designs)) return [];
  const previews: CanvaPreview[] = [];
  for (const value of designs.slice(0, 12)) {
    if (!value || typeof value !== "object") continue;
    const design = value as { id?: unknown; title?: unknown; thumbnail?: unknown; urls?: { edit_url?: unknown; view_url?: unknown } };
    const preview = canvaPreviewSchema.safeParse({
      id: design.id,
      title: typeof design.title === "string" ? design.title.trim().slice(0, 160) || "Desain Canva" : "Desain Canva",
      thumbnail: design.thumbnail,
      editUrl: design.urls?.edit_url,
      viewUrl: design.urls?.view_url,
    });
    if (preview.success && !previews.some(item => item.id === preview.data.id)) previews.push(preview.data);
    if (previews.length === 3) break;
  }
  return previews;
}
