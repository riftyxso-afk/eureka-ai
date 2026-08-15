/**
 * Email otomatis Eureka.AI (via Resend) — selamat datang & notifikasi login.
 *
 * Dipakai dari:
 *  - Route OTP (app/api/auth/otp) saat verifikasi: user baru → welcome,
 *    user lama → notifikasi login.
 *  - Route /api/auth/notify untuk jalur login password (diverifikasi sesi).
 *
 * Template bergaya sama dengan email OTP (tema clay + dark mode) agar
 * konsisten di inbox.
 */
import { Resend } from "resend";

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? "Eureka.AI <onboarding@resend.dev>";

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return key.length > 10 && key.startsWith("re_") && !key.includes("xxx");
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const SITE_URL = "https://www.eureka-ai.web.id";

function darkStyles(): string {
  return `
    .dark, div[data-ogsc] .main, div[data-ogsb] .main { background-color:#211d16 !important; border-color:#3a332a !important; }
    .dark, div[data-ogsc] .cardtext, div[data-ogsb] .cardtext, div[data-ogsc] .headline, div[data-ogsb] .headline { color:#f5f0e8 !important; }
    div[data-ogsc] .subtext, div[data-ogsb] .subtext, div[data-ogsc] .foottext, div[data-ogsb] .foottext { color:#a8a29e !important; }
    div[data-ogsc] .infobox, div[data-ogsb] .infobox { background:#2a221a !important; border-color:#4d3f2c !important; }
    div[data-ogsc] .divider, div[data-ogsb] .divider { border-top-color:#3a332a !important; }
    div[data-ogsc] .brandmark, div[data-ogsb] .brandmark { background:linear-gradient(135deg,#f59e0b,#b45309) !important; }
  `;
}

interface EmailShellOptions {
  kicker: string;
  headline: string;
  bodyHtml: string;
}

function shell({ kicker, headline, bodyHtml }: EmailShellOptions): string {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headline}</title>
    <style>${darkStyles()}</style>
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
                <p style="margin:22px 0 4px;font-family:${FONT};font-size:11px;font-weight:700;color:#ffe3bd;letter-spacing:2.5px;">${kicker}</p>
                <h1 class="headline" style="margin:0;font-family:${FONT};font-size:24px;font-weight:800;color:#ffffff;line-height:1.35;">${headline}</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:28px 40px 6px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td class="divider" style="padding:24px 40px 0;border-top:1px solid #f0e6d2;"></td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 40px 30px;text-align:center;">
                <p style="margin:18px 0 0;font-family:${FONT};font-size:13px;font-weight:700;color:#57534e;">
                  Eureka.AI <span style="color:#d97706;">·</span> Belajar lebih cepat dengan AI
                </p>
                <a href="${SITE_URL}" style="font-family:${FONT};font-size:12px;font-weight:700;color:#d97706;text-decoration:none;">www.eureka-ai.web.id</a>
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

function welcomeHtml(name: string): string {
  const firstName = name.split(" ")[0] || "Kawan Belajar";
  return shell({
    kicker: "SELAMAT DATANG",
    headline: "Momen Eureka-mu Dimulai! ✨",
    bodyHtml: `
      <p class="cardtext" style="margin:0;font-family:${FONT};font-size:14.5px;line-height:1.7;color:#44403c;">
        Halo <b>${escapeHtml(firstName)}</b>! 🎉<br /><br />
        Selamat bergabung di <b>Eureka.AI</b> — AI Tutor yang bukan sekadar memberi jawaban, tapi membimbingmu menemukan <i>momen Eureka</i>.
      </p>
      <table class="infobox" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background-color:#fbf6ec;border:1px solid #f0e2c8;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;font-family:${FONT};font-size:13px;line-height:1.8;color:#44403c;">
            <b style="color:#b45309;">Yang bisa kamu lakukan:</b><br />
            📚 Buat catatan dari materi, video, atau soal<br />
            💬 Tanya apa saja ke asisten AI<br />
            🃏 Kuis & flashcards untuk menguji pemahaman<br />
            🔍 Web search real-time saat belajar
          </td>
        </tr>
      </table>
      <p style="margin:22px 0 0;text-align:center;">
        <a href="${SITE_URL}/home" style="display:inline-block;background:linear-gradient(135deg,#d97706,#b45309);color:#ffffff;font-family:${FONT};font-size:14px;font-weight:800;text-decoration:none;padding:13px 30px;border-radius:12px;">Mulai Belajar Sekarang 🚀</a>
      </p>
      <p class="subtext" style="margin:18px 0 0;font-family:${FONT};font-size:11.5px;color:#a8a29e;text-align:center;">
        Akunmu sudah aktif — langsung masuk dan coba fitur pertamamu.
      </p>
    `,
  });
}

function loginNoticeHtml(name: string, email: string, timeLabel: string): string {
  const firstName = name.split(" ")[0] || "Kawan Belajar";
  return shell({
    kicker: "AKTIVITAS AKUN",
    headline: "Kamu Baru Saja Masuk 👋",
    bodyHtml: `
      <p class="cardtext" style="margin:0;font-family:${FONT};font-size:14.5px;line-height:1.7;color:#44403c;">
        Halo <b>${escapeHtml(firstName)}</b>,<br /><br />
        Kami mendeteksi login baru ke akun Eureka.AI kamu:
      </p>
      <table class="infobox" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background-color:#fbf6ec;border:1px solid #f0e2c8;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;font-family:${FONT};font-size:13px;line-height:1.8;color:#44403c;">
            📧 Email: <b style="color:#44403c;">${escapeHtml(email)}</b><br />
            🕐 Waktu: <b style="color:#44403c;">${escapeHtml(timeLabel)}</b>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.7;color:#706957;">
        Bukan kamu yang masuk? Segera ubah kata sandi dan hubungi kami — akunmu tetap aman.
        Jika ini memang kamu, abaikan email ini.
      </p>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isResendConfigured()) {
    throw new Error(
      "RESEND_API_KEY belum diisi. Tambahkan key asli (awalan re_) di .env.local & Vercel."
    );
  }
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Kirim email gagal: ${error.message}`);
}

function premiumWelcomeHtml(
  name: string,
  tier: "promo" | "normal" | string,
  days: number
): string {
  const firstName = name.split(" ")[0] || "Kawan Belajar";
  const tierLabel =
    tier === "promo"
      ? "Pro Promo"
      : tier === "normal"
        ? "Pro"
        : tier === "referral"
          ? "Pro (Referral)"
          : tier === "trial"
            ? "Trial"
            : "Pro";
  return shell({
    kicker: "PREMIUM AKTIF",
    headline: "Selamat, Premium Aktif! 👑",
    bodyHtml: `
      <p class="cardtext" style="margin:0;font-family:${FONT};font-size:14.5px;line-height:1.7;color:#44403c;">
        Halo <b>${escapeHtml(firstName)}</b>! 🎉<br /><br />
        Paket <b>${escapeHtml(tierLabel)}</b> kamu sekarang <b>aktif</b> — nikmati semua fitur Eureka.AI tanpa batas.
      </p>
      <table class="infobox" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background-color:#fbf6ec;border:1px solid #f0e2c8;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;font-family:${FONT};font-size:13px;line-height:1.8;color:#44403c;">
            👑 Paket: <b style="color:#b45309;">${escapeHtml(tierLabel)}</b><br />
            ⏳ Durasi: <b style="color:#b45309;">${days} hari</b><br />
            ✨ Chat AI tanpa batas · catatan otomatis tanpa batas · kolaborasi real-time
          </td>
        </tr>
      </table>
      <p style="margin:22px 0 0;text-align:center;">
        <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#d97706,#b45309);color:#ffffff;font-family:${FONT};font-size:14px;font-weight:800;text-decoration:none;padding:13px 30px;border-radius:12px;">Masuk ke Dashboard 🚀</a>
      </p>
      <p class="subtext" style="margin:18px 0 0;font-family:${FONT};font-size:11.5px;color:#a8a29e;text-align:center;">
        Terima kasih sudah mempercayai Eureka.AI. Selamat belajar!
      </p>
    `,
  });
}

/** Kirim email selamat datang (user baru). Throw bila gagal. */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail(to, `Selamat datang di Eureka.AI, ${name.split(" ")[0] || "Kawan"}! 🎉`, welcomeHtml(name));
}

/** Kirim email konfirmasi saat premium diaktifkan. Throw bila gagal. */
export async function sendPremiumWelcomeEmail(
  to: string,
  name: string,
  tier: "promo" | "normal" | string,
  days: number
): Promise<void> {
  await sendEmail(
    to,
    `Premium Eureka.AI aktif — ${days} hari! 👑`,
    premiumWelcomeHtml(name, tier, days)
  );
}

/** Kirim notifikasi login. Throw bila gagal. */
export async function sendLoginNotificationEmail(
  to: string,
  name: string
): Promise<void> {
  const timeLabel = new Date().toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  await sendEmail(
    to,
    "Login baru terdeteksi di akun Eureka.AI kamu 🔐",
    loginNoticeHtml(name, to, timeLabel)
  );
}
