/**
 * Kode diskon (persen & nominal) untuk langganan Pro.
 *
 * Admin membuat kode langsung di tabel `discount_codes` (Supabase):
 *   - type 'percent'  → value 1-100 (persen potongan)
 *   - type 'nominal'  → value potongan Rupiah tetap
 *   - max_uses NULL = tak terbatas; used_count di-increment saat checkout
 *     berhasil dibuat (link Mayar diterbitkan).
 *   - active=false / expires_at lewat → kode tidak berlaku.
 */
import { db } from "./supabase/admin";

export interface DiscountResult {
  ok: boolean;
  error?: string;
  /** Kode yang sudah dinormalisasi (uppercase). */
  code: string;
  /** Harga final setelah diskon (Rupiah). */
  finalAmount: number;
  /** Keterangan diskon untuk ditampilkan user. */
  label: string;
}

export interface DiscountValidation {
  id: string;
  type: "percent" | "nominal";
  value: number;
  label: string;
}

/** Harga minimum yang boleh dikirim ke Mayar (hindari amount 0/negatif). */
export const MIN_AMOUNT = 1000;

/** Normalisasi kode: uppercase, hapus spasi. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Validasi kode diskon di database dan hitung harga final.
 * @param rawCode kode yang diketik user.
 * @param baseAmount harga normal sebelum diskon (Rupiah).
 */
export async function applyDiscount(
  rawCode: string,
  baseAmount: number
): Promise<DiscountResult> {
  const code = normalizeCode(rawCode);
  if (!code) {
    return { ok: false, error: "Masukkan kode diskon.", code, finalAmount: baseAmount, label: "" };
  }

  let client;
  try {
    client = db();
  } catch {
    return { ok: false, error: "Supabase belum dikonfigurasi.", code, finalAmount: baseAmount, label: "" };
  }

  const { data, error } = await client
    .from("discount_codes")
    .select("id, type, value, max_uses, used_count, active, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Kode diskon tidak ditemukan.", code, finalAmount: baseAmount, label: "" };
  }
  if (data.active === false) {
    return { ok: false, error: "Kode diskon sudah tidak aktif.", code, finalAmount: baseAmount, label: "" };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Kode diskon sudah kedaluwarsa.", code, finalAmount: baseAmount, label: "" };
  }
  if (typeof data.max_uses === "number" && (data.used_count ?? 0) >= data.max_uses) {
    return { ok: false, error: "Kode diskon sudah habis dipakai.", code, finalAmount: baseAmount, label: "" };
  }

  const type = data.type as "percent" | "nominal";
  const value = Number(data.value) || 0;
  let discount = 0;
  let label = "";

  if (type === "percent") {
    discount = Math.round((baseAmount * Math.min(100, Math.max(0, value))) / 100);
    label = `Diskon ${value}%`;
  } else {
    discount = Math.round(value);
    label = `Diskon Rp ${value.toLocaleString("id-ID")}`;
  }

  const finalAmount = Math.max(MIN_AMOUNT, baseAmount - discount);
  return { ok: true, code, finalAmount, label };
}

/**
 * Catat pemakaian kode (increment atomik via RPC) — dipanggil SETELAH
 * checkout Mayar berhasil dibuat agar kode tidak dipakai tanpa batas.
 * RPC hanya menambah bila kode masih aktif & kuota tersisa.
 */
export async function consumeDiscount(code: string): Promise<void> {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    await db().rpc("increment_discount_use", { p_code: normalized });
  } catch (e) {
    console.error("[discount] catat pemakaian gagal:", e);
  }
}
