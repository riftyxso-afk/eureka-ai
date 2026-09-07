/**
 * Supabase Admin Client (service role).
 *
 * Dipakai di semua operasi server-side (API routes) agar bebas dari RLS.
 * Perlu SUPABASE_SERVICE_ROLE_KEY di .env.local — JANGAN pernah dipakai client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const CONFIG_ERROR_MSG =
  "Supabase belum dikonfigurasi. Masukkan kunci asli di .env.local lalu jalankan supabase_schema.sql di Supabase Dashboard > SQL Editor.";

/** True bila .env.local berisi kredensial Supabase asli (bukan placeholder). */
export function isSupabaseConfigured(): boolean {
  return (
    url.startsWith("https://") &&
    url.length > 20 &&
    serviceKey.length > 40 &&
    serviceKey.startsWith("eyJ")
  );
}

let adminClient: SupabaseClient<any, "public", any> | null = null;

/**
 * Ambil client service-role (lazy singleton).
 * Bila Supabase belum dikonfigurasi, lempar error yang jelas.
 */
export function db(): SupabaseClient<any, "public", any> {
  if (!isSupabaseConfigured()) {
    throw new Error(CONFIG_ERROR_MSG);
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: {
        // Supabase di balik Cloudflare: alamat IP pertama (104.18.38.10) kadang
        // mengalami packet loss / connect timeout (10s default undici).
        // Custom fetch dengan AbortSignal 25s memberi kesempatan fallback IP
        // sebelum undici melempar ConnectTimeoutError ke handler.
        fetch: (fetchUrl, opts) => {
          return fetch(fetchUrl, {
            ...opts,
            signal: AbortSignal.timeout(25_000),
          });
        },
      },
    });
  }
  return adminClient;
}
