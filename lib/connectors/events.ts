import { z } from "zod";

function canvaUrl(hosts: string[]) {
  return z.string().max(8192).url().refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  });
}

export const canvaDesignIdSchema = z.string().regex(/^[\w-]{1,100}$/);
export const canvaTargetKindSchema = z.enum(["brand_template", "design"]);
export const canvaPreviewSchema = z.object({
  id: canvaDesignIdSchema,
  kind: canvaTargetKindSchema.optional(),
  title: z.string().min(1).max(160),
  thumbnail: z.object({
    url: canvaUrl(["media.canva.com", "document-export.canva.com"]),
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
  }).optional(),
  editUrl: canvaUrl(["www.canva.com", "canva.com"]).optional(),
  viewUrl: canvaUrl(["www.canva.com", "canva.com"]).optional(),
  createUrl: canvaUrl(["www.canva.com", "canva.com"]).optional(),
}).refine(preview => preview.kind === "brand_template" || Boolean(preview.thumbnail));
export type CanvaPreview = z.infer<typeof canvaPreviewSchema>;

export const canvaSearchSchema = z.object({
  query: z.string().max(300),
  continuation: z.string().min(1).max(4096).optional(),
});

export const connectorCallSchema = z.object({
  id: z.string().max(100), provider: z.string().max(30), action: z.string().max(40),
  status: z.enum(["running", "completed", "error", "pending"]),
  label: z.string().max(300), links: z.array(z.object({ title: z.string().max(160), url: z.string().url().refine(url => url.startsWith("https://")) })).max(8).default([]),
  updates: z.array(z.string().max(200)).max(5).optional(),
  previews: z.array(canvaPreviewSchema).max(3).optional(),
  canvaSearch: canvaSearchSchema.optional(),
});
export type ConnectorCall = z.infer<typeof connectorCallSchema>;
export function mergeConnectorCall(calls: ConnectorCall[], next: ConnectorCall) {
  return [...calls.filter(call => call.id !== next.id), next].slice(-12);
}
