import { NextRequest, NextResponse } from "next/server";

import { getUserIdFromAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/notify — kirim email otomatis untuk jalur login PASSWORD
 * (jalur OTP sudah mengirim langsung di route /api/auth/otp).
 *
 * Body: { email: string, kind: "welcome" | "login" }
 * Keamanan: verifikasi Bearer token sesi → email body harus cocok dengan
 * email user token (cegah spam email ke orang lain). Fire-and-forget —
 * selalu balas { ok: true } walau kirim email gagal (login tidak terblokir).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: unknown;
      kind?: unknown;
    } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const kind = String(body?.kind ?? "").trim();

    if (kind !== "welcome" && kind !== "login") {
      return NextResponse.json(
        { error: "Jenis email tidak dikenal." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    // Verifikasi sesi: token wajib valid & email harus milik user itu.
    const userId = await getUserIdFromAuth(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan." },
        { status: 401 }
      );
    }
    const { data: user, error } = await db()
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle();
    if (error || !user) {
      return NextResponse.json(
        { error: "Data user tidak ditemukan." },
        { status: 404 }
      );
    }
    if (String(user.email ?? "").trim().toLowerCase() !== email) {
      // Email di body ≠ email user sesi → cegah spam ke email orang lain.
      return NextResponse.json(
        { error: "Email tidak cocok dengan sesi." },
        { status: 403 }
      );
    }

    const { sendWelcomeEmail, sendLoginNotificationEmail } = await import(
      "@/lib/email"
    );
    const displayName =
      String(user.name ?? "").trim() || email.split("@")[0] || "Kawan Belajar";

    if (kind === "welcome") {
      void sendWelcomeEmail(email, displayName).catch((e) =>
        console.error("[auth/notify] welcome gagal:", e)
      );
    } else {
      void sendLoginNotificationEmail(email, displayName).catch((e) =>
        console.error("[auth/notify] login gagal:", e)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal kirim email.";
    console.error("[api/auth/notify] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
