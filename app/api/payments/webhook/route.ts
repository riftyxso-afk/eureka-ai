import { NextRequest, NextResponse } from "next/server";

import { isPakasirConfigured, verifyTransactionDetail } from "@/lib/pakasir";
import { db } from "@/lib/supabase/admin";
import { activatePremium } from "@/lib/premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jendela pencarian fallback: pending request dengan amount sama (≤ 24 jam). */
const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/payments/webhook — webhook Pakasir (JSON, POST).
 *
 * Payload (pakasir.com/p/docs → Webhook):
 *   { "amount": 22000, "order_id": "240910HDE7C9", "project": "depodomain",
 *     "status": "completed", "payment_method": "qris", "completed_at": "..." }
 * Dikirim oleh Pakasir ke Webhook URL proyek (diisi di dashboard Pakasir).
 *
 * Flow (fail-closed, karena webhook Pakasir TIDAK bersignature):
 *   0. PAKASIR_PROJECT/PAKASIR_API_KEY harus terisi (503 bila belum);
 *      field `project` webhook harus cocok (401 bila beda).
 *   1. Audit event disimpan (order_id UNIQUE). Event duplikat BUKAN batu
 *      sandungan: bila request belum ditandai `paid`, webhook `completed`
 *      yang datang belakangan TETAP diproses (perbaikan: sebelumnya event
 *      `pending` yang masuk duluan memblokir webhook `completed` — user
 *      bayar tapi premium tak pernah aktif).
 *   2. Hanya status `completed` yang memproses; status lain → 200 tanpa aktivasi.
 *   3. Cocokkan order_id → user + tier + amount (pakasir_payment_requests);
 *      amount webhook harus konsisten dengan amount tercatat.
 *   4. Verifikasi authoritative via API transactiondetail (status harus
 *      `completed`); bila API gagal/tak terjangkau → 5xx TANPA aktivasi agar
 *      Pakasir mengulang; status ≠ completed → 200 tanpa aktivasi.
 *   5. Aktivasi premium 30 hari + tandai payment request lunas.
 *   6. FALLBACK (order tidak tercatat): bila webhook `completed` terbukti via
 *      transactiondetail namun order-nya tidak ditemukan di
 *      pakasir_payment_requests (mis. baris checkout hilang/tak sempat
 *      tersimpan), cari pending request user dengan amount SAMA dalam 24 jam
 *      terakhir — bila tepat satu kandidat → aktivasi user tsb dan catat
 *      order-nya (recovered). Bila ambigu → log keras untuk review manual.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text().catch(() => "");
  if (!rawBody) {
    return NextResponse.json({ error: "Body kosong." }, { status: 400 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }

  const body = payload as {
    amount?: unknown;
    order_id?: unknown;
    project?: unknown;
    status?: unknown;
    payment_method?: unknown;
    completed_at?: unknown;
    [key: string]: unknown;
  };

  // ── 0. Fail-closed: konfigurasi + project ──────────────────
  if (!isPakasirConfigured()) {
    console.error(
      "[webhook] PAKASIR_PROJECT / PAKASIR_API_KEY belum di-set — semua webhook ditolak (fail-closed)."
    );
    return NextResponse.json(
      { error: "Server belum dikonfigurasi untuk notifikasi." },
      { status: 503 }
    );
  }

  const project = String(body?.project ?? "").trim();
  if (project !== process.env.PAKASIR_PROJECT?.trim()) {
    console.warn(
      `[webhook] project "${project}" tidak cocok dengan PAKASIR_PROJECT — ditolak`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = String(body?.order_id ?? "").trim();
  const status = String(body?.status ?? "").trim().toLowerCase();
  const amount = Number(body?.amount) || 0;

  // ── 1. Audit event (idempotensi TIDAK memblokir proses ulang) ──
  const { error: insertErr } = await db()
    .from("pakasir_notification_events")
    .insert({
      order_id: orderId || null,
      status: status || null,
      amount: amount || null,
      payload: body as Record<string, unknown>,
    });

  if (insertErr) {
    const isDup = String(insertErr.message ?? "")
      .toLowerCase()
      .includes("duplicate");

    if (!isDup) {
      console.error("[webhook] simpan event gagal:", insertErr);
      return NextResponse.json({ error: "Gagal menyimpan event." }, { status: 500 });
    }

    // Duplikat: cek apakah order SUDAH berhasil diproses (request = paid).
    // - Sudah paid → duplikat murni, 200 tanpa aksi.
    // - Belum paid (mis. event pending dulu, atau percobaan 500 gagal)
    //   → webhook `completed` ini TETAP diproses (bukan block).
    const { data: paidReq } = await db()
      .from("pakasir_payment_requests")
      .select("status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (paidReq?.status === "paid") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.log(
      `[webhook] event duplikat untuk order ${orderId} (belum paid) — lanjut proses`
    );
  }

  if (!orderId) {
    console.warn("[webhook] webhook tanpa order_id — diabaikan");
    return NextResponse.json({ ok: true, skipped: "no order_id" });
  }

  // ── 2. Hanya completed yang mengaktifkan premium ────────────
  if (status !== "completed") {
    console.log(
      `[webhook] status=${status || "?"} untuk order ${orderId} — tanpa aktivasi`
    );
    return NextResponse.json({ ok: true, skipped: status || "unknown status" });
  }

  // ── 3. Cocokkan order_id → user + tier (pakasir_payment_requests) ─
  const { data: reqRow, error: reqErr } = await db()
    .from("pakasir_payment_requests")
    .select("user_id, tier, amount, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (reqErr) {
    console.error("[webhook] cari payment request gagal:", reqErr);
    return NextResponse.json({ ok: true, matched: false });
  }

  if (reqRow && reqRow.status === "paid") {
    // Sudah pernah dibayar & diproses → abaikan (perlindungan ganda).
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Verifikasi amount konsisten (hanya bila request tercatat).
  if (reqRow && amount && reqRow.amount && Number(amount) !== Number(reqRow.amount)) {
    console.warn(
      `[webhook] amount tidak cocok: notif=${amount} expected=${reqRow.amount} (order ${orderId}) — diabaikan`
    );
    return NextResponse.json({ ok: true, skipped: "amount mismatch" });
  }

  // ── 4. Verifikasi authoritative via transactiondetail ──────
  let verifiedStatus: string | null = null;
  try {
    const detail = await verifyTransactionDetail({
      orderId,
      amount: Number(reqRow?.amount ?? amount),
    });
    verifiedStatus = detail.status;
  } catch (e) {
    // API tak terjangkau / error → TIDAK mengaktifkan premium, balas 5xx agar
    // Pakasir mengulang webhook (aktivasi hanya lewat status confirmed).
    console.error(
      `[webhook] transactiondetail error untuk order ${orderId}:`,
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { error: "Verifikasi gagal, coba lagi." },
      { status: 500 }
    );
  }

  if (verifiedStatus !== "completed") {
    console.log(
      `[webhook] transactiondetail status=${verifiedStatus} untuk order ${orderId} — tanpa aktivasi`
    );
    return NextResponse.json({ ok: true, skipped: `status ${verifiedStatus}` });
  }

  // ── 5. Aktivasi premium 30 hari (jalur bersama activatePremium) ──
  let userId: string;
  let tier: "promo" | "normal";
  let recovered = false;

  if (reqRow) {
    userId = reqRow.user_id as string;
    tier = reqRow.tier as "promo" | "normal";
  } else {
    // ── 6. FALLBACK: order completed terbukti (transactiondetail) tapi
    // tidak tercatat di pakasir_payment_requests. Cari pending request user
    // dengan amount SAMA dalam 24 jam terakhir → TEPAT SATU kandidat.
    const since = new Date(Date.now() - FALLBACK_WINDOW_MS).toISOString();
    const { data: candidates, error: candErr } = await db()
      .from("pakasir_payment_requests")
      .select("user_id, tier, amount")
      .eq("status", "pending")
      .eq("amount", amount)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (candErr) {
      console.error("[webhook] fallback cari pending request gagal:", candErr);
      return NextResponse.json({ ok: true, matched: false, fallback: "query error" });
    }

    if (!candidates || candidates.length !== 1) {
      console.error(
        `[webhook] ⚠️ ORDER TERBAYAR TIDAK TERCATAT: order ${orderId} (Rp ${amount}) ` +
          `status=completed terverifikasi, tapi fallback ambigu (${candidates?.length ?? 0} kandidat). ` +
          "Perlu review manual & aktivasi manual!"
      );
      return NextResponse.json({
        ok: true,
        matched: false,
        fallback: candidates?.length === 0 ? "no candidate" : "ambiguous",
      });
    }

    userId = candidates[0].user_id as string;
    tier = candidates[0].tier as "promo" | "normal";
    recovered = true;
    console.log(
      `[webhook] FALLBACK: order ${orderId} (Rp ${amount}) → user ${userId} (tier ${tier})`
    );
  }

  const activated = await activatePremium({
    userId,
    tier,
    days: 30,
    invoiceNumber: orderId,
    transactionId: null, // webhook Pakasir tidak membawa transaction id
  });
  if (!activated.ok || !activated.premiumUntil) {
    console.error("[webhook] update premium gagal:", activated.error);
    return NextResponse.json({ ok: true, error: "update failed" });
  }
  const premiumUntil = activated.premiumUntil;

  // Order yang dibayar tapi tidak tercatat → catat barisnya (status paid)
  // agar lookup berikutnya cocok & audit lengkap.
  if (recovered) {
    await db().from("pakasir_payment_requests").insert({
      user_id: userId,
      order_id: orderId,
      amount,
      tier,
      status: "paid",
      paid_at: new Date().toISOString(),
    });
  }

  // Tandai payment request lunas (mencegah aktivasi ganda) + catat audit
  // matched_user_id pada event webhook (kolom sudah ada di skema).
  await db()
    .from("pakasir_payment_requests")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await db()
    .from("pakasir_notification_events")
    .update({ matched_user_id: userId })
    .eq("order_id", orderId);

  // ── Email konfirmasi premium (fire-and-forget, tidak memblokir) ──
  try {
    const { data: userRow } = await db()
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle();
    if (userRow?.email) {
      const { sendPremiumWelcomeEmail } = await import("@/lib/email");
      void sendPremiumWelcomeEmail(
        String(userRow.email),
        userRow.name ? String(userRow.name) : "",
        tier,
        30
      ).catch((e) =>
        console.error("[webhook] gagal kirim email premium:", e)
      );
    }
  } catch (e) {
    console.warn("[webhook] email premium dilewati:", e);
  }

  console.log(
    `[webhook] completed order ${orderId} → premium aktif untuk user ${userId} ` +
      `(${tier}, s/d ${premiumUntil})${recovered ? " [RECOVERED]" : ""}`
  );
  return NextResponse.json({
    ok: true,
    activated: true,
    ...(recovered ? { recovered: true } : {}),
  });
}
