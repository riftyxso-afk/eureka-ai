/**
 * Auth server-side untuk endpoint asisten AI.
 *
 * Frontend mengirim access token Supabase via header `Authorization: Bearer …`
 * (dilampirkan otomatis oleh apiFetch / streamAssistantChat).
 * Di sini token diverifikasi dan dipaksa cocok dengan userId param —
 * mencegah pemanggil mengaku sebagai user lain hanya dengan menebak UUID.
 *
 * Bila Supabase belum dikonfigurasi (mode dev tanpa DB), verifikasi dilewati
 * dan userId param dipercaya (kompatibilitas demo).
 */
import { db } from "../supabase/admin";

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

/**
 * Verifikasi akses user asisten.
 * @param authHeader nilai header `Authorization` (bisa null/kosong).
 * @param paramUserId userId yang dikirim client (query/body).
 */
export async function authorizeAssistantUser(
  authHeader: string | null,
  paramUserId: string
): Promise<AssistantAuthResult> {
  if (!paramUserId) {
    return { userId: "", error: "userId diperlukan.", status: 400 };
  }

  const token = extractBearer(authHeader);

  // Supabase belum dikonfigurasi → mode dev/demo: percayai param.
  try {
    db();
  } catch {
    return { userId: paramUserId };
  }

  // Tanpa token padahal Supabase aktif → tolak (user wajib login).
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
  if (data.user.id !== paramUserId) {
    return { userId: "", error: "Akses ditolak.", status: 403 };
  }
  return { userId: data.user.id };
}

/**
 * Ambil userId dari token sesi (tanpa memaksa cocok dengan param).
 * Berguna untuk route yang hanya butuh tahu SIAPA user-nya (mis. rate limit).
 * @returns userId, atau "" bila tanpa token / Supabase belum dikonfigurasi / token invalid.
 */
export async function getUserIdFromAuth(authHeader: string | null): Promise<string> {
  const token = extractBearer(authHeader);
  if (!token) return "";
  try {
    db();
  } catch {
    return ""; // mode dev tanpa DB
  }
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return "";
  return data.user.id;
}
