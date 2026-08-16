import { NextRequest, NextResponse } from "next/server";

import { applyDiscount, normalizeCode } from "@/lib/discount";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/validate-code
 * Body: { code: string, tier: "promo" | "normal" }
 * Validasi kode diskon TANPA mengonsumsi — dipakai UI pricing saat user
 * menekan Enter: menampilkan harga final (mis. Rp 500 untuk kode free 100%)
 * sebelum checkout. Mengembalikan sisa kuota bila kode punya max_uses.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      code?: unknown;
      tier?: unknown;
    } | null;
    const code = String(body?.code ?? "").trim();
    const tier = String(body?.tier ?? "").trim();
    if (!code) {
      return NextResponse.json({ ok: false, error: "Masukkan kode diskon." }, { status: 400 });
    }
    if (tier !== "promo" && tier !== "normal") {
      return NextResponse.json(
        { ok: false, error: "Pilih tier yang valid." },
        { status: 400 }
      );
    }

    const baseAmount = tier === "promo" ? 5000 : 59000;
    const disc = await applyDiscount(code, baseAmount);
    if (!disc.ok) {
      return NextResponse.json({ ok: false, error: disc.error }, { status: 200 });
    }

    // Info kuota (sisa pemakaian) untuk kode "10 orang tercepat".
    let remainingUses: number | null = null;
    try {
      const { data } = await db()
        .from("discount_codes")
        .select("max_uses, used_count")
        .eq("code", normalizeCode(code))
        .maybeSingle();
      if (data && typeof data.max_uses === "number") {
        remainingUses = Math.max(0, data.max_uses - (data.used_count ?? 0));
      }
    } catch {
      // Info kuota opsional — gagal bukan masalah.
    }

    return NextResponse.json({
      ok: true,
      code: disc.code,
      label: disc.label,
      finalAmount: disc.finalAmount,
      free: disc.free === true,
      remainingUses,
    });
  } catch (e) {
    const msg = "Gagal memvalidasi kode.";
    console.error("[api/payments/validate-code] POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
