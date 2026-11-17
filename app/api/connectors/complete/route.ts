import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { saveTokens, unseal } from "@/lib/connectors/server";
import { connectorLimit } from "@/lib/connectors/limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const limited = connectorLimit(auth.userId); if (limited) return limited;
  const input = await request.json().catch(() => null);
  if (typeof input?.state !== "string" || !/^[\w-]{43}$/.test(input.state)) return Response.json({ error: "Koneksi tidak valid." }, { status: 400 });
  const { data, error } = await db().from("connector_oauth_states").delete()
    .eq("state_hash", createHash("sha256").update(input.state).digest("hex"))
    .eq("user_id", auth.userId).not("pending_credentials", "is", null)
    .gt("expires_at", new Date().toISOString()).select().maybeSingle();
  if (error || !data) return Response.json({ error: "Koneksi kedaluwarsa atau milik akun Eureka yang berbeda. Hubungkan kembali." }, { status: 400 });
  try {
    const pending = unseal<{ tokens: {access_token: string; refresh_token?: string; expires_in?: number}; obtainedAt: number }>(data.pending_credentials);
    if (pending.tokens.expires_in) pending.tokens.expires_in = Math.max(1, pending.tokens.expires_in - Math.ceil((Date.now() - pending.obtainedAt) / 1000));
    await saveTokens(auth.userId, data.provider, data.permission, pending.tokens);
    return Response.json({ connected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Koneksi belum berhasil disimpan. Hubungkan kembali." }, { status: 503 }); }
}
