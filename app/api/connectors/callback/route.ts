import { createHash } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { exchange, oauthConfig, seal, unseal } from "@/lib/connectors/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.CONNECTOR_APP_ORIGIN || "https://www.eureka-ai.web.id";
  const result = new URL("/dashboard-v2/pengaturan/konektor", origin);
  try {
    const state = url.searchParams.get("state") || "";
    if (state.length < 20 || state.length > 200) throw new Error("invalid");
    const { data, error } = await db().from("connector_oauth_states").delete()
      .eq("state_hash", createHash("sha256").update(state).digest("hex")).is("pending_credentials", null).gt("expires_at", new Date().toISOString()).select().maybeSingle();
    if (error || !data) throw new Error("invalid");
    if (url.searchParams.has("error")) { result.searchParams.set("connection", "cancelled"); return Response.redirect(result, 303); }
    const code = url.searchParams.get("code");
    if (!code) throw new Error("invalid");
    const config = oauthConfig(data.provider);
    const tokens = await exchange(data.provider, { grant_type: "authorization_code", code, redirect_uri: config.redirect,
      ...(config.provider.group !== "notion" ? { code_verifier: unseal<string>(data.verifier) } : {}) });
    // Bind the grant to the authenticated Eureka account after the redirect.
    // A forwarded OAuth URL must not link a victim's provider account to its sender.
    const pending = await db().from("connector_oauth_states").insert({ ...data,
      verifier: "", pending_credentials: seal({ tokens, obtainedAt: Date.now() }),
      expires_at: new Date(Date.now() + 300000).toISOString() });
    if (pending.error) throw new Error("pending");
    result.searchParams.set("connection", "pending");
    result.searchParams.set("state", state);
    result.searchParams.set("provider", data.provider);
  } catch { result.searchParams.set("connection", "failed"); }
  return Response.redirect(result, 303);
}
