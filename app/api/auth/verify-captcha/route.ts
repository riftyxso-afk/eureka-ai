import { NextRequest, NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/captcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-captcha — verifikasi token Cloudflare Turnstile.
 *
 * Dipakai sebelum aksi yang butuh perlindungan bot (mis. login kata sandi).
 * Bila Turnstile belum dikonfigurasi → lolos (mode dev/demo).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    captchaToken?: unknown;
  } | null;
  const token = String(body?.captchaToken ?? "").trim();

  const result = await verifyTurnstileToken(token);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Verifikasi keamanan gagal." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
