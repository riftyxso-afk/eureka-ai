import { requireAuth } from "@/lib/assistant/auth";
import { readCanvaPreviews } from "@/lib/connectors/canva-preview";
import { canvaDesignIdSchema } from "@/lib/connectors/events";
import { providerFetch } from "@/lib/connectors/server";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status, headers });
  const params = new URL(request.url).searchParams;
  const des = canvaDesignIdSchema.safeParse(params.get("id"));
  const kind = params.get("kind") === "brand_template" ? "brand_template" : "design";
  if (!des.success) return Response.json({ error: "ID desain tidak valid." }, { status: 400, headers });
  ensureRateLimitPrune();
  if (!checkRateLimit(`canva-preview:${auth.userId}`, 45, 60_000).ok) {
    return Response.json({ error: "Terlalu banyak permintaan pratinjau." }, { status: 429, headers });
  }
  try {
    const resource = kind === "brand_template" ? "brand-templates" : "designs";
    const result = await providerFetch(auth.userId, "canva", `https://api.canva.com/rest/v1/${resource}/${encodeURIComponent(des.data)}`);
    const [preview] = readCanvaPreviews(result, kind);
    if (preview) return Response.json({ preview }, { headers });
  } catch {
    // Canva enforces access to the design using this user's connector grant.
  }
  return Response.json({ error: "Pratinjau Canva belum tersedia." }, { status: 404, headers });
}
