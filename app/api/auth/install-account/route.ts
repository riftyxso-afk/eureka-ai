import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { createInstallTicket, readInstallTicket, INSTALL_COOKIE, INSTALL_TTL } from "@/lib/auth/installTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function sameOrigin(req: NextRequest) {
  return req.headers.get("origin") === req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "Permintaan tidak diizinkan." }, 403);
  const body = await req.json().catch(() => null);
  if (!body || !["prepare", "link", "restore"].includes(body.action)) return reply({ error: "Permintaan tidak valid." }, 400);
  ensureRateLimitPrune();
  try {
    if (body.action === "restore") {
      const value = typeof body.ticket === "string" ? body.ticket : req.cookies.get(INSTALL_COOKIE)?.value;
      if (!value) return reply({ restored: false });
      const ticket = readInstallTicket(value);
      if (!ticket) {
        const response = reply({ error: "Tautan sudah kedaluwarsa. Buat tautan baru dari browser yang sudah masuk." }, 410);
        response.cookies.delete(INSTALL_COOKIE);
        return response;
      }
      if (!checkRateLimit("install-restore:" + ticket.userId, 10, 60_000).ok) return reply({ error: "Tunggu sebentar lalu coba lagi." }, 429);
      // Use a separate client: verification must never replace the admin
      // singleton's service-role authorization with the transferred session.
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.verifyOtp({ token_hash: ticket.hash, type: "email" });
      if (error || !data.session || data.user?.id !== ticket.userId) {
        const response = reply({ error: "Tautan sudah digunakan atau kedaluwarsa. Buat tautan baru." }, 410);
        response.cookies.delete(INSTALL_COOKIE);
        return response;
      }
      const response = reply({ restored: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      response.cookies.delete(INSTALL_COOKIE);
      return response;
    }
    const auth = await requireAuth(req.headers.get("authorization"));
    if (!auth.userId) return reply({ error: auth.error }, auth.status ?? 401);
    if (!checkRateLimit("install-prepare:" + auth.userId, 5, 300_000).ok) return reply({ error: "Tunggu beberapa menit sebelum menyiapkan tautan baru." }, 429);
    const client = db();
    const { data: account, error: accountError } = await client.auth.admin.getUserById(auth.userId);
    if (accountError || !account.user?.email || !account.user.email_confirmed_at) return reply({ error: "Verifikasi email akun terlebih dahulu." }, 403);
    const { data, error } = await client.auth.admin.generateLink({ type: "magiclink", email: account.user.email });
    if (error || !data.properties?.hashed_token) return reply({ error: "Akun belum bisa disiapkan. Coba lagi." }, 502);
    const ticket = createInstallTicket(data.properties.hashed_token, auth.userId);
    const response = reply({ ready: true, expiresIn: INSTALL_TTL, ...(body.action === "link" ? { ticket } : {}) });
    response.cookies.set(INSTALL_COOKIE, ticket, {
      httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "strict", path: "/", maxAge: INSTALL_TTL,
    });
    return response;
  } catch {
    return reply({ error: "Pemindahan akun belum tersedia. Coba lagi sebentar." }, 503);
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "Permintaan tidak diizinkan." }, 403);
  const response = reply({ ok: true });
  response.cookies.delete(INSTALL_COOKIE);
  return response;
}
