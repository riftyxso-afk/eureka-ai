import { requireAuth } from "@/lib/assistant/auth";
import { CONNECTORS, connectorById } from "@/lib/connectors/catalog";
import { connectorStates, oauthConfig, saveTokens } from "@/lib/connectors/server";
import { db } from "@/lib/supabase/admin";
import { connectorLimit } from "@/lib/connectors/limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const limited = connectorLimit(auth.userId); if (limited) return limited;
  const input = await request.json().catch(() => ({}));
  const provider = connectorById(input?.provider);
  if (!provider || !["token","microsoft"].includes(provider.group)) return Response.json({error:"Gunakan login resmi untuk aplikasi ini."},{status:400});
  if (!oauthConfig(provider.id).ready) return Response.json({error:"Penyimpanan konektor belum dikonfigurasi."},{status:503});
  if (typeof input.token !== "string" || input.token.length < 12 || input.token.length > 8000 || /\s/.test(input.token)) return Response.json({error:"Token tidak valid."},{status:400});
  const validations: Record<string,string> = {
    github:"https://api.github.com/user", todoist:"https://api.todoist.com/api/v1/user",
    slack:"https://slack.com/api/auth.test", discord:"https://discord.com/api/v10/users/@me",
    zotero:"https://api.zotero.org/keys/current", onedrive:"https://graph.microsoft.com/v1.0/me",
    microsoft:"https://graph.microsoft.com/v1.0/me", teams:"https://graph.microsoft.com/v1.0/me",
  };
  try {
    let url = validations[provider.id];
    if (provider.id === "trello") {
      const [key,token,...rest] = input.token.split(":");
      if (!key || !token || rest.length) throw new Error("Gunakan format API_KEY:TOKEN.");
      url = "https://api.trello.com/1/members/me?" + new URLSearchParams({key,token});
    }
    if (!url) throw new Error("Validasi provider belum tersedia.");
    const response = await fetch(url,{headers:{Authorization:(provider.id==="discord"?"Bot ":"Bearer ")+input.token,
      ...(provider.id==="zotero"?{"Zotero-API-Key":input.token,"Zotero-API-Version":"3"}:{})},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error("Provider menolak token. Periksa token dan izin aplikasinya.");
    const data = await response.json();
    if (data.ok === false) throw new Error("Token Slack belum valid.");
    await saveTokens(auth.userId,provider.id,input.permission==="write"&&provider.write.length?"write":"read",{access_token:input.token,
      ...(["microsoft"].includes(provider.group)?{expires_in:3500}:{})});
    return Response.json({connected:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return Response.json({error:(error as Error).message},{status:400}); }
}
export async function GET(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  let connections: Awaited<ReturnType<typeof connectorStates>> = [];
  let warning = "";
  try { connections = await connectorStates(auth.userId); } catch (error) { warning = (error as Error).message; }
  return Response.json({ providers: CONNECTORS.map(provider => ({ ...provider,
    ready: oauthConfig(provider.id).ready && !warning,
    connection: connections.find(item => item.provider === provider.id) || null,
  })), warning }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status });
  const provider = (await request.json().catch(() => null))?.provider;
  if (!connectorById(provider)) return Response.json({ error: "Konektor tidak ditemukan." }, { status: 400 });
  const result = await db().from("user_connectors").delete().eq("user_id", auth.userId).eq("provider", provider);
  if (result.error) return Response.json({ error: "Koneksi belum berhasil dilepas." }, { status: 503 });
  await db().from("connector_oauth_states").delete().eq("user_id", auth.userId).eq("provider", provider);
  return Response.json({ disconnected: true });
}
