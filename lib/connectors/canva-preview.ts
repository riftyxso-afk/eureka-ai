import { canvaPreviewSchema, type CanvaPreview } from "./events";

export function readCanvaPreviews(result: unknown, kind?: CanvaPreview["kind"]): CanvaPreview[] {
  if (!result || typeof result !== "object") return [];
  const data = result as { design?: unknown; brand_template?: unknown; items?: unknown; job?: { result?: { designs?: unknown; design?: unknown } } };
  const designs = data.job?.result?.designs ?? data.items ?? [data.job?.result?.design ?? data.design ?? data.brand_template];
  if (!Array.isArray(designs)) return [];
  const previews: CanvaPreview[] = [];
  for (const value of designs.slice(0, 12)) {
    if (!value || typeof value !== "object") continue;
    const design = value as { id?: unknown; title?: unknown; thumbnail?: unknown; view_url?: unknown; create_url?: unknown; urls?: { edit_url?: unknown; view_url?: unknown } };
    const data = {
      id: design.id,
      kind,
      title: typeof design.title === "string" ? design.title.trim().slice(0, 160) || "Desain Canva" : "Desain Canva",
      thumbnail: design.thumbnail,
      editUrl: design.urls?.edit_url,
      viewUrl: design.urls?.view_url ?? design.view_url,
      createUrl: kind === "brand_template" ? design.create_url : undefined,
    };
    let preview = canvaPreviewSchema.safeParse(data);
    if (!preview.success && kind === "brand_template") {
      preview = canvaPreviewSchema.safeParse({ ...data, thumbnail: undefined });
    }
    if (preview.success && !previews.some(item => item.id === preview.data.id)) previews.push(preview.data);
    if (previews.length === 3) break;
  }
  return previews;
}
