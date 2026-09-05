import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";

const RATE_LIMIT_STORE = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_STORE.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function isValidChromeExtensionOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return /^chrome-extension:\/\//.test(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isValidChromeExtensionOrigin(origin)) {
    return NextResponse.json({ ok: false, error: "Origin tidak diizinkan." }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Terlalu banyak request. Coba lagi nanti." }, { status: 429 });
  }

  let body: { sessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim();
  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "sessionToken wajib diisi." }, { status: 400 });
  }

  try {
    const supabase = db();
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "Session tidak valid atau expired." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[session-exchange] Error:", e);
    return NextResponse.json({ ok: false, error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
