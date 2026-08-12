import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { db } from "@/lib/supabase/admin";

const CODE_TTL_SECONDS = 5 * 60;
const MIN_INTERVAL_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const FROM_ADDRESS = "Eureka.AI <onboarding@resend.dev>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashCode(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return key.length > 10 && key.startsWith("re_") && !key.includes("xxx");
}

async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error(
      "RESEND_API_KEY belum diisi. Tambahkan key asli (awalan re_) di .env.local & Vercel."
    );
  }
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Kode OTP Eureka.AI kamu: ${code}`,
    html: `
      <div style="max-width:440px;margin:0 auto;font-family:Arial,sans-serif;color:#3f3f46;">
        <div style="text-align:center;padding:28px;background:#faf7f2;border-radius:16px;border:2px solid #eecfa4;">
          <h1 style="font-size:22px;margin:0 0 8px;">Kode Verifikasi Eureka.AI</h1>
          <p style="font-size:14px;color:#71717a;margin:0 0 20px;">
            Gunakan kode ini untuk masuk atau membuat akun. Kode berlaku 5 menit.
          </p>
          <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#d97706;background:#fff;border-radius:12px;padding:16px;">${code}</div>
          <p style="font-size:12px;color:#a1a1aa;margin-top:20px;">
            <strong>${to}</strong><br/>Jangan bagikan kode ini ke siapa pun. Jika kamu tidak memintanya, abaikan email ini.
          </p>
        </div>
      </div>`,
  });
  if (error) throw new Error(`Kirim email gagal: ${error.message}`);
}

export async function POST(req: NextRequest) {
  let body: { action?: string; email?: string; name?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const action = body.action;
  const email = String(body.email ?? "").trim().toLowerCase();

  if (action !== "request" && action !== "verify") {
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Format email tidak valid." }, { status: 400 });
  }

  if (action === "request") {
    return handleRequest(email, String(body.name ?? "").trim().slice(0, 60));
  }
  return handleVerify(email, String(body.code ?? "").trim(), String(body.name ?? "").trim().slice(0, 60));
}

async function handleRequest(email: string, name: string) {
  const now = new Date();
  const recent = await db()
    .from("otp_codes")
    .select("id, created_at, used_at")
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent.error) {
    return NextResponse.json(
      { ok: false, error: "Mulai perjalanan gagal: tabel otp_codes belum ada. Jalankan supabase_patch_002_otp.sql di Supabase > SQL Editor." },
      { status: 500 }
    );
  }
  if (recent.data && !recent.data.used_at) {
    const elapsed = Math.floor(
      (now.getTime() - new Date(recent.data.created_at).getTime()) / 1000
    );
    if (elapsed < MIN_INTERVAL_SECONDS) {
      const wait = MIN_INTERVAL_SECONDS - elapsed;
      return NextResponse.json(
        { ok: false, error: `Kode sudah terkirim. Kirim ulang dalam ${wait}s.` },
        { status: 429 }
      );
    }
  }

  // Bersihkan kode lama (dipakai/kedaluwarsa) supaya tabel tidak membengkak.
  await db()
    .from("otp_codes")
    .delete()
    .eq("email", email)
    .or(`used_at.not.is.null,expires_at.lt.${now.toISOString()}`);

  const code = String(randomBytes(3).readUIntBE(0, 3) % 1000000).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(now.getTime() + CODE_TTL_SECONDS * 1000).toISOString();

  const { error: insertError } = await db().from("otp_codes").insert({
    email,
    code_hash: `${salt}:${hashCode(salt, code)}`,
    expires_at: expiresAt,
  });
  if (insertError) {
    return NextResponse.json(
      { ok: false, error: `Gagal menyimpan kode: ${insertError.message}` },
      { status: 500 }
    );
  }

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    await db().from("otp_codes").delete().eq("email", email).is("used_at", null);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gagal mengirim email." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, name: name || null });
}

async function handleVerify(email: string, code: string, name: string) {
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Kode harus 6 digit angka." }, { status: 400 });
  }

  const client = db();
  const { data: row, error } = await client
    .from("otp_codes")
    .select("*")
    .eq("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json(
      { ok: false, error: "Kode salah atau sudah kedaluwarsa. Minta kode baru." },
      { status: 400 }
    );
  }

  // bandingkan hash ("<salt>:<sha256>") terhadap kode yang dikirim
  const [storedSalt, storedHash] = row.code_hash.split(":");
  const match = storedHash === hashCode(storedSalt, code);

  if (!match) {
    const attempts = (row.attempts ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await client.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      await client.from("otp_codes").update({ attempts }).eq("id", row.id);
    }
    return NextResponse.json(
      { ok: false, error: "Kode salah atau sudah kedaluwarsa. Minta kode baru." },
      { status: 400 }
    );
  }

  await client.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  // --- Pastikan akun Supabase Auth ada & confirmed, tanpa kirim email ---
  let user: { id: string; email?: string | null; email_confirmed_at?: string | null; created_at?: string; user_metadata?: Record<string, unknown> } | null = null;
  {
    const { data: list } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    user = list?.users?.find((u) => u.email === email) ?? null;
  }

  if (!user) {
    const created = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: name ? { name: name.slice(0, 60) } : {},
    });
    if (created.error) {
      return NextResponse.json({ ok: false, error: `Gagal membuat akun: ${created.error.message}` }, { status: 500 });
    }
    user = created.data.user;
  } else if (!user.email_confirmed_at) {
    const updated = await client.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (updated.error) {
      return NextResponse.json({ ok: false, error: `Gagal verifikasi akun: ${updated.error.message}` }, { status: 500 });
    }
    user = updated.data.user;
  }

  const link = await client.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (!tokenHash) {
    return NextResponse.json({ ok: false, error: "Gagal membuat sesi masuk. Coba lagi." }, { status: 500 });
  }

  const displayName = String(user.user_metadata?.name ?? "").trim() || email.split("@")[0];
  return NextResponse.json({
    ok: true,
    tokenHash,
    user: {
      id: user.id,
      email: user.email,
      name: displayName.slice(0, 60),
      createdAt: user.created_at,
    },
  });
}