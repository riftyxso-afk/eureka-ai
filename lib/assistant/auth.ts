/**
 * Auth server-side untuk endpoint API.
 *
 * Frontend mengirim access token Supabase via header `Authorization: Bearer …`
 * (dilampirkan otomatis oleh apiFetch / streamAssistantChat).
 * Di sini token diverifikasi dan dipaksa cocok dengan userId param —
 * mencegah pemanggil mengaku sebagai user lain hanya dengan menebak UUID.
 *
 * Kebijakan FAIL-CLOSED: bila Supabase tidak terkonfigurasi, permintaan
 * DITOLAK (503) — userId dari client tidak pernah dipercaya. Satu-satunya
 * pengecualian adalah mode dev eksplisit via env ALLOW_INSECURE_DEV_AUTH=true
 * (hanya untuk pengembangan lokal, tidak pernah aktif di produksi).
 */
import { db, CONFIG_ERROR_MSG, isSupabaseConfigured } from "../supabase/admin";

export interface AssistantAuthResult {
  userId: string;
  error?: string;
  status?: number;
}

function extractBearer(authHeader: string | null): string {
  if (!authHeader) return "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : "";
}

/** Mode dev lokal eksplisit: percayai userId param (JANGAN dipakai di produksi). */
function isInsecureDevAuthEnabled(): boolean {
  return process.env.ALLOW_INSECURE_DEV_AUTH === "true";
}

/**
 * Verifikasi akses user — helper tunggal untuk SEMUA endpoint data pengguna.
 * @param authHeader nilai header `Authorization` (bisa null/kosong).
 * @param paramUserId userId yang dikirim client (query/body) — bila diisi,
 *        wajib cocok dengan token.
 */
export async function requireAuth(
  authHeader: string | null,
  paramUserId?: string
): Promise<AssistantAuthResult> {
  if (paramUserId === "") {
    return { userId: "", error: "userId diperlukan.", status: 400 };
  }

  // Supabase belum dikonfigurasi → tolak, KECUALI mode dev eksplisit.
  if (!isSupabaseConfigured()) {
    if (isInsecureDevAuthEnabled() && paramUserId) {
      return { userId: paramUserId };
    }
    return {
      userId: "",
      error: "Autentikasi tidak tersedia saat ini. Silakan coba lagi nanti.",
      status: 503,
    };
  }

  const token = extractBearer(authHeader);

  // Tanpa token → tolak (user wajib login).
  if (!token) {
    return {
      userId: "",
      error: "Autentikasi diperlukan. Silakan masuk ulang.",
      status: 401,
    };
  }

  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) {
    return {
      userId: "",
      error: "Sesi tidak valid. Silakan masuk ulang.",
      status: 401,
    };
  }
  if (paramUserId && data.user.id !== paramUserId) {
    return { userId: "", error: "Akses ditolak.", status: 403 };
  }
  return { userId: data.user.id };
}

/**
 * Verifikasi akses user asisten (interface lama — endpoint yang sudah ada).
 * @param authHeader nilai header `Authorization` (bisa null/kosong).
 * @param paramUserId userId yang dikirim client (query/body) — wajib cocok.
 */
export async function authorizeAssistantUser(
  authHeader: string | null,
  paramUserId: string
): Promise<AssistantAuthResult> {
  return requireAuth(authHeader, paramUserId);
}

/**
 * Ambil userId dari token sesi (tanpa memaksa cocok dengan param).
 * Berguna untuk route yang hanya butuh tahu SIAPA user-nya (mis. rate limit).
 * @returns userId, atau "" bila tanpa token / Supabase belum dikonfigurasi / token invalid.
 *          Endpoint yang mewajibkan login TIDAK boleh memakai helper ini tanpa
 *          menolak saat hasilnya "".
 */
export async function getUserIdFromAuth(authHeader: string | null): Promise<string> {
  const token = extractBearer(authHeader);
  if (!token) return "";
  if (!isSupabaseConfigured()) return ""; // fail-closed: jangan pernah percaya param
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return "";
  return data.user.id;
}
