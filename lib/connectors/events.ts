import { z } from "zod";
export const connectorCallSchema = z.object({
  id: z.string().max(100), provider: z.string().max(30), action: z.string().max(40),
  status: z.enum(["running", "completed", "error", "pending"]),
  label: z.string().max(300), links: z.array(z.object({ title: z.string().max(160), url: z.string().url().refine(url => url.startsWith("https://")) })).max(8).default([]),
});
export type ConnectorCall = z.infer<typeof connectorCallSchema>;
export function mergeConnectorCall(calls: ConnectorCall[], next: ConnectorCall) {
  return [...calls.filter(call => call.id !== next.id), next].slice(-12);
}
