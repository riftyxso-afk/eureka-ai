import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const ORDER_ID = "EKA202608151039023BB82A";
const AMOUNT = 59000;
const TIER = "normal";

async function main() {
  // Resolve user riftyxso31 berdasarkan email (prefix dihitung ulang).
  const { data: users } = await sb.from("users").select("id,email,name").ilike("email", "rif%@gmail.com");
  const USER_ID = (users ?? []).find((u) => String(u.id).startsWith("1258eab8"))?.id ?? "";
  if (!USER_ID) {
    console.error("User 1258eab8… tidak ditemukan. Daftar:", JSON.stringify(users));
    process.exit(1);
  }
  console.log("Target user:", USER_ID);

  // 1. Cek user saat ini
  const { data: user } = await sb.from("users").select("id,email,name,is_premium,premium_until,premium_tier").eq("id", USER_ID).maybeSingle();
  if (!user) { console.error("User tidak ditemukan:", USER_ID); process.exit(1); }
  console.log("Sebelum:", JSON.stringify(user));

  // 2. Aktivasi (sama seperti activatePremium: aditif 30 hari dari premium_until)
  const now = Date.now();
  const existing = user.premium_until ? new Date(user.premium_until).getTime() : 0;
  const base = existing > now ? existing : now;
  const premiumUntil = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await sb
    .from("users")
    .update({
      is_premium: true,
      premium_tier: TIER,
      premium_until: premiumUntil,
      pakasir_invoice_number: ORDER_ID,
    })
    .eq("id", USER_ID);
  if (updErr) { console.error("Update users gagal:", updErr.message); process.exit(1); }
  console.log("Premium aktif s/d", premiumUntil);

  // 3. Catat payment request (order yang dibayar tapi tak tercatat)
  const { error: insErr } = await sb.from("pakasir_payment_requests").insert({
    user_id: USER_ID,
    order_id: ORDER_ID,
    amount: AMOUNT,
    tier: TIER,
    status: "paid",
    paid_at: new Date().toISOString(),
  });
  if (insErr) {
    if (!String(insErr.message).toLowerCase().includes("duplicate")) {
      console.error("Insert payment request gagal:", insErr.message);
    } else {
      console.log("Payment request sudah ada (duplikat) — dilewati");
    }
  } else {
    console.log("Payment request paid dicatat:", ORDER_ID);
  }

  // 4. Update matched_user_id di event webhook (audit)
  const { error: evErr } = await sb
    .from("pakasir_notification_events")
    .update({ matched_user_id: USER_ID })
    .eq("order_id", ORDER_ID);
  if (evErr) console.warn("Update event matched_user_id gagal:", evErr.message);
  else console.log("Event webhook matched_user_id diperbarui");

  // 5. Verifikasi akhir
  const { data: after } = await sb.from("users").select("is_premium,premium_tier,premium_until,pakasir_invoice_number").eq("id", USER_ID).maybeSingle();
  console.log("\nSesudah:", JSON.stringify(after));
  console.log(after?.is_premium ? "🎉 PREMIUM AKTIF ✅" : "❌ masih free");
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
