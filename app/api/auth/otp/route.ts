import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { db } from "@/lib/supabase/admin";

const CODE_TTL_SECONDS = 5 * 60;
const MIN_INTERVAL_SECONDS = 60;
const MAX_ATTEMPTS = 5;
// "onboarding@resend.dev" hanya bisa kirim ke email akun sendiri (mode testing).
// Setelah domain diverifikasi di https://resend.com/domains, set RESEND_FROM_EMAIL
// mis. "Eureka.AI <noreply@domainmu.com>"
const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? "Eureka.AI <onboarding@resend.dev>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashCode(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return key.length > 10 && key.startsWith("re_") && !key.includes("xxx");
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function buildOtpEmailHtml(code: string, email: string): string {
  const digits = code.split("");
  const digitBoxes = digits
    .map(
      (d) =>
        `<td align="center" style="width:48px;height:58px;background:#fffdf8;border:1.5px solid #e3c48f;border-radius:10px;color:#1c1917;font-size:28px;font-weight:800;font-family:${FONT};">${d}</td>`
    )
    .join("");

  // Tampilan malam hari (dark mode) di Gmail/Apple Mail
  const dark = `
    .dark, div[data-ogsc] .main, div[data-ogsb] .main { background-color:#211d16 !important; border-color:#3a332a !important; }
    .dark, div[data-ogsc] .cardtext, div[data-ogsb] .cardtext, div[data-ogsc] .headline, div[data-ogsb] .headline { color:#f5f0e8 !important; }
    div[data-ogsc] .subtext, div[data-ogsb] .subtext, div[data-ogsc] .foottext, div[data-ogsb] .foottext { color:#a8a29e !important; }
    div[data-ogsc] .codebox, div[data-ogsb] .codebox { background:#2a241c !important; border-color:#5a4a30 !important; color:#ffc061 !important; }
    div[data-ogsc] .infobox, div[data-ogsb] .infobox { background:#2a221a !important; border-color:#4d3f2c !important; }
    div[data-ogsc] .divider, div[data-ogsb] .divider { border-top-color:#3a332a !important; }
    div[data-ogsc] .brandmark, div[data-ogsb] .brandmark { background:linear-gradient(135deg,#f59e0b,#b45309) !important; }
  `;

  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kode Verifikasi Eureka.AI</title>
    <style>${dark}</style>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f0e4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f0e4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table class="main" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#ffffff;border:1px solid #efdbbe;border-radius:22px;overflow:hidden;box-shadow:0 14px 44px rgba(94,64,22,0.12);">

            <!-- Header gradient -->
            <tr>
              <td style="background:linear-gradient(135deg,#d97706,#b45309);padding:30px 40px 26px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="brandmark" style="width:42px;height:42px;background:rgba(255,255,255,0.18);border-radius:12px;text-align:center;vertical-align:middle;font-family:${FONT};font-size:22px;font-weight:800;color:#ffffff;">E</td>
                    <td style="padding-left:14px;font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.3px;">Eureka<span style="color:#ffd9a0;">.AI</span></td>
                  </tr>
                </table>
                <p style="margin:22px 0 4px;font-family:${FONT};font-size:11px;font-weight:700;color:#ffe3bd;letter-spacing:2.5px;">VERIFIKASI AKUN</p>
                <h1 class="headline" style="margin:0;font-family:${FONT};font-size:24px;font-weight:800;color:#ffffff;line-height:1.35;">Kode Verifikasi Kamu</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:28px 40px 0;">
                <p class="cardtext" style="margin:0;font-family:${FONT};font-size:14.5px;line-height:1.7;color:#44403c;">
                  Halo! Gunakan kode di bawah ini untuk <b>masuk</b> atau <b>membuat akun</b> di Eureka.AI.
                  Jangan bagikan kode ini kepada siapa pun.
                </p>
              </td>
            </tr>

            <!-- Ilustrasi -->
            <tr>
              <td align="center" style="padding:22px 40px 0;">
                <img src="https://s6.imgcdn.dev/YXbD48.png" alt="Ilustrasi Eureka.AI" width="460" style="display:block;width:100%;max-width:460px;height:auto;border:0;border-radius:14px;" />
              </td>
            </tr>

            <!-- OTP digit boxes -->
            <tr>
              <td align="center" style="padding:24px 40px 6px;">
                <table class="codebox" role="presentation" cellpadding="0" cellspacing="6" style="background-color:#fffbf3;border:1px solid #f0e0c2;border-radius:16px;padding:14px;">
                  <tr>${digitBoxes}</tr>
                </table>
              </td>
            </tr>

            <!-- Info box -->
            <tr>
              <td style="padding:18px 40px 6px;">
                <table class="infobox" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf6ec;border:1px solid #f0e2c8;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;font-family:${FONT};font-size:12.5px;line-height:1.7;color:#706957;">
                      <div style="margin-bottom:2px;"><span style="display:inline-block;width:7px;height:7px;background-color:#d97706;border-radius:50%;vertical-align:middle;"></span>&nbsp; Kode berlaku selama <b>5 menit</b> dan hanya bisa dipakai <b>satu kali</b>.</div>
                      <div><span style="display:inline-block;width:7px;height:7px;background-color:#d97706;border-radius:50%;vertical-align:middle;"></span>&nbsp; Dikirim ke: <b style="color:#44403c;">${email}</b></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td class="divider" style="padding:24px 40px 0;border-top:1px solid #f0e6d2;"></td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <p class="foottext" style="margin:18px 0 0;font-family:${FONT};font-size:12px;line-height:1.8;color:#a8a29e;">
                  Tidak meminta kode ini? Abaikan saja — akunmu tetap aman.<br />
                  Eureka.AI tidak akan pernah meminta kode verifikasi melalui telepon atau chat.
                </p>
                <p style="margin:16px 0 0;font-family:${FONT};font-size:13px;font-weight:700;color:#57534e;">
                  Eureka.AI <span style="color:#d97706;">·</span> Belajar lebih cepat dengan AI
                </p>
                <a href="https://www.eureka-ai.web.id" style="font-family:${FONT};font-size:12px;font-weight:700;color:#d97706;text-decoration:none;">www.eureka-ai.web.id</a>
              </td>
            </tr>

          </table>
          <p style="margin:16px 0 0;font-family:${FONT};font-size:11px;color:#a8a29e;">© ${new Date().getFullYear()} Eureka.AI — Semua hak dilindungi.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
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
    subject: `${code} adalah kode verifikasi Eureka.AI kamu`,
    html: buildOtpEmailHtml(code, to),
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