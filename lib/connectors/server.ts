import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { connectorById, type ConnectorId } from "./catalog";

type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
function key() {
  const secret = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Pengelola perlu menyiapkan CONNECTOR_ENCRYPTION_KEY.");
  return createHash("sha256").update(secret).digest();
}
export function seal(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
export function unseal<T>(value: string): T {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
export function oauthConfig(id: string) {
  const provider = connectorById(id);
  if (!provider) throw new Error("Konektor tidak ditemukan.");
  const prefix = `CONNECTOR_${provider.group.toUpperCase()}`;
  const clientId = process.env[`${prefix}_CLIENT_ID`] || "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] || "";
  const origin = process.env.CONNECTOR_PUBLIC_ORIGIN || "";
  return { provider, clientId, clientSecret, redirect: origin.replace(/\/$/, "") + "/api/connectors/callback",
    ready: ["google","canva","notion"].includes(provider.group)
      ? Boolean(clientId && clientSecret && origin.startsWith("https://") && (process.env.CONNECTOR_ENCRYPTION_KEY?.length || 0) >= 32)
      : (process.env.CONNECTOR_ENCRYPTION_KEY?.length || 0) >= 32,
    authorize: provider.group === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : provider.group === "canva" ? "https://www.canva.com/api/oauth/authorize" : "https://api.notion.com/v1/oauth/authorize",
    token: provider.group === "google" ? "https://oauth2.googleapis.com/token" : provider.group === "canva" ? "https://api.canva.com/rest/v1/oauth/token" : "https://api.notion.com/v1/oauth/token",
  };
}
export async function connectorStates(userId: string) {
  const result = await db().from("user_connectors").select("provider,permission,connected_at").eq("user_id", userId);
  if (result.error) throw new Error("Penyimpanan konektor belum siap. Hubungi pengelola Eureka.");
  return result.data;
}
export async function exchange(id: string, fields: Record<string, string>): Promise<Tokens> {
  const config = oauthConfig(id);
  const basic = config.provider.group !== "google";
  const headers: Record<string, string> = { "Content-Type": config.provider.group === "notion" ? "application/json" : "application/x-www-form-urlencoded" };
  if (basic) headers.Authorization = "Basic " + Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64");
  const body = { ...fields, ...(!basic ? { client_id: config.clientId, client_secret: config.clientSecret } : {}) };
  const response = await fetch(config.token, { method: "POST", headers,
    body: config.provider.group === "notion" ? JSON.stringify(body) : new URLSearchParams(body).toString(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Provider menolak koneksi. Hubungkan ulang akun.");
  const tokens = await response.json();
  if (!tokens.access_token) throw new Error("Provider belum memberikan akses.");
  return tokens;
}
export async function saveTokens(userId: string, id: string, permission: string, tokens: Tokens) {
  const result = await db().from("user_connectors").upsert({ user_id: userId, provider: id, permission,
    credentials: seal(tokens), expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
  }, { onConflict: "user_id,provider" });
  if (result.error) throw new Error("Koneksi belum berhasil disimpan.");
}
const refreshes = new Map<string, Promise<string>>();
export async function accessToken(userId: string, id: ConnectorId, write = false) {
  const { data, error } = await db().from("user_connectors").select("*").eq("user_id", userId).eq("provider", id).maybeSingle();
  if (error || !data) throw new Error("Hubungkan " + connectorById(id)?.name + " di Pengaturan → Konektor.");
  if (write && data.permission !== "write") throw new Error("Hubungkan ulang konektor dengan izin baca & tulis.");
  const tokens = unseal<Tokens>(data.credentials);
  if (!data.expires_at || new Date(data.expires_at).getTime() > Date.now() + 60000) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error("Sesi konektor berakhir. Hubungkan ulang.");
  const lock = userId + ":" + id;
  const pending = refreshes.get(lock);
  if (pending) return pending;
  const refresh = (async () => {
    const next = await exchange(id, { grant_type: "refresh_token", refresh_token: tokens.refresh_token! });
    // A delayed refresh must never recreate a disconnected grant or overwrite a newer login.
    const saved = await db().from("user_connectors").update({
      credentials: seal({ ...next, refresh_token: next.refresh_token || tokens.refresh_token }),
      expires_at: next.expires_in ? new Date(Date.now() + next.expires_in * 1000).toISOString() : null,
    }).eq("user_id", userId).eq("provider", id).eq("credentials", data.credentials).select("provider").maybeSingle();
    if (saved.error || !saved.data) throw new Error("Koneksi berubah. Coba ulang permintaanmu.");
    return next.access_token;
  })().finally(() => refreshes.delete(lock));
  refreshes.set(lock, refresh);
  return refresh;
}
export async function providerFetch(userId: string, id: ConnectorId, url: string, body?: unknown) {
  const token = await accessToken(userId, id, body !== undefined);
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: {
    Authorization: "Bearer " + token, "Content-Type": "application/json", ...(id === "notion" ? { "Notion-Version": "2022-06-28" } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${connectorById(id)?.name} gagal memproses permintaan (${response.status}).`);
  const value = await response.text();
  return JSON.parse(value || "{}");
}
