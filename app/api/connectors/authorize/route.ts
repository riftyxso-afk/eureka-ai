import { createHash, randomBytes } from "node:crypto";
import { requireAuth } from "@/lib/assistant/auth";
import { oauthConfig, seal } from "@/lib/connectors/server";
import { db } from "@/lib/supabase/admin";
import { connectorLimit } from "@/lib/connectors/limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const limited = connectorLimit(auth.userId); if (limited) return limited;
  try {
    const input = await request.json();
    const config = oauthConfig(String(input.provider));
    if (!["google", "canva", "notion"].includes(config.provider.group)) return Response.json({ error: "Gunakan token aplikasi untuk konektor ini." }, { status: 400 });
    if (!config.ready) return Response.json({ error: "Konektor sedang disiapkan oleh pengelola Eureka." }, { status: 503 });
    const permission = input.permission === "write" && config.provider.write.length ? "write" : "read";
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await db().from("connector_oauth_states").delete().eq("user_id", auth.userId).lt("expires_at", new Date().toISOString());
    const result = await db().from("connector_oauth_states").insert({ state_hash: stateHash, user_id: auth.userId,
      provider: config.provider.id, permission, verifier: seal(verifier), expires_at: new Date(Date.now() + 600000).toISOString() });
    if (result.error) throw new Error("Belum dapat memulai koneksi. Coba lagi.");
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirect, response_type: "code", state });
    if (config.provider.group !== "notion") {
      params.set("scope", permission === "write" ? config.provider.writeScope : config.provider.scope);
      params.set("code_challenge_method", "S256");
      params.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    } else params.set("owner", "user");
    if (config.provider.group === "google") { params.set("access_type", "offline"); params.set("prompt", "consent"); }
    return Response.json({ url: config.authorize + "?" + params }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
}
