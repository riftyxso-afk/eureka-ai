/**
 * Auth — Supabase Auth (email & password).
 *
 * Fungsi yang membaca sesi (isLoggedIn/getSession/getCurrentUser) bersifat
 * sinkron dari cache localStorage agar komponen UI tidak perlu refactor.
 * Sesi di-refresh oleh syncAuthSession() (dipanggil di guard dashboard).
 */
import { supabase, isSupabaseConfigured } from "./supabase/client";
import { apiFetch } from "@/lib/apiClient";
import { setUserName, setUserId, clearIdentity } from "./identity";

const SESSION_KEY = "eureka_session";

export interface AuthUser {
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  name: string;
  email: string;
  loggedInAt: string;
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage penuh / tidak tersedia — abaikan
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // abaikan
  }
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

export function getSession(): AuthSession | null {
  return safeGet<AuthSession>(SESSION_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const session = getSession();
  if (!session) return null;
  return {
    name: session.name,
    email: session.email,
    password: "",
    createdAt: session.loggedInAt,
  };
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  /** True bila pendaftaran butuh verifikasi email (konfirmasi diaktifkan). */
  needsConfirmation?: boolean;
}

function cacheSession(userId: string, name: string, email: string) {
  safeSet(SESSION_KEY, {
    userId,
    name,
    email,
    loggedInAt: new Date().toISOString(),
  } satisfies AuthSession);
  setUserId(userId);
  setUserName(name);
}

/** Buat akun via Supabase Auth. */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const name = input.name.trim().slice(0, 60);
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (name.length < 2) {
    return { ok: false, error: "Nama minimal 2 huruf." };
  }
  if (!isEmailValid(email)) {
    return { ok: false, error: "Format email tidak valid." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Kata sandi minimal 6 karakter." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase belum dikonfigurasi. Isi kunci asli di .env.local lalu jalankan supabase_schema.sql.",
    };
  }

  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "email_taken" || error.message.includes("already registered")
          ? "Email sudah terdaftar. Silakan masuk."
          : error.message,
    };
  }

  const authUser = data.user;
  if (!authUser) {
    return { ok: false, error: "Gagal membuat akun. Coba lagi." };
  }

  const user: AuthUser = {
    name,
    email,
    password: "",
    createdAt: authUser.created_at,
  };

  if (data.session) {
    // Verifikasi email nonaktif → langsung login.
    cacheSession(authUser.id, name, email);
    return { ok: true, user };
  }

  // Verifikasi email aktif → beri tahu user untuk cek email.
  return { ok: true, user, needsConfirmation: true };
}

/** Masuk via Supabase Auth. */
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (!isEmailValid(email)) {
    return { ok: false, error: "Format email tidak valid." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase belum dikonfigurasi. Isi kunci asli di .env.local lalu jalankan supabase_schema.sql.",
    };
  }

  const { data, error } = await supabase!.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error:
        error?.code === "invalid_credentials"
          ? "Email atau kata sandi salah."
          : error?.message || "Gagal masuk. Coba lagi.",
    };
  }

  const name =
    String(data.user.user_metadata?.name ?? "").trim().slice(0, 60) ||
    email.split("@")[0] ||
    "Pengguna";

  cacheSession(data.user.id, name, email);

  return {
    ok: true,
    user: {
      name,
      email,
      password: "",
      createdAt: data.user.created_at,
    },
  };
}

/**
 * Kirim kode OTP ke email via Resend (server-side di /api/auth/otp).
 * `name` opsional — dipakai saat akun baru dibuat.
 */
export async function requestOtpLogin(
  email: string,
  name?: string
): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();

  if (!isEmailValid(clean)) {
    return { ok: false, error: "Format email tidak valid." };
  }

  try {
    const res = await apiFetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", email: clean, name: name ?? "" }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error ?? "Gagal mengirim kode. Coba lagi." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server. Coba lagi." };
  }
}

/**
 * Verifikasi kode OTP yang dikirim via Resend.
 * Server memastikan akun Supabase Auth ada & terkonfirmasi (tanpa email konfirmasi),
 * lalu mengembalikan token magic-link yang ditukar di sini menjadi sesi aktif.
 */
export async function verifyOtpLogin(
  email: string,
  code: string,
  name?: string
): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase belum dikonfigurasi. Isi kunci asli di .env.local lalu jalankan supabase_schema.sql.",
    };
  }

  let tokenHash = "";
  let displayName = "";
  let createdAt = "";
  try {
    const res = await apiFetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        email: clean,
        code: code.trim(),
        name: name ?? "",
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error ?? "Gagal memverifikasi kode. Coba lagi." };
    }
    tokenHash = String(json.tokenHash ?? "");
    displayName = String(json.user?.name ?? "").slice(0, 60);
    createdAt = String(json.user?.createdAt ?? "");
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server. Coba lagi." };
  }

  if (!tokenHash) {
    return { ok: false, error: "Gagal memverifikasi kode. Coba lagi." };
  }

  const { data, error } = await supabase!.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message || "Gagal membuka sesi. Coba lagi.",
    };
  }

  const userName =
    String(data.user.user_metadata?.name ?? "").trim().slice(0, 60) ||
    displayName ||
    clean.split("@")[0] ||
    "Pengguna";

  cacheSession(data.user.id, userName, clean);

  return {
    ok: true,
    user: {
      name: userName,
      email: clean,
      password: "",
      createdAt: createdAt || data.user.created_at,
    },
  };
}

/**
 * Sinkronkan cache sesi dengan Supabase Auth (mis. setelah refresh halaman).
 * Panggil sekali dari guard dashboard.
 */
export async function syncAuthSession(): Promise<void> {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return;

  const { data } = await supabase!.auth.getSession();
  const session = data.session;

  if (session?.user) {
    const name =
      String(session.user.user_metadata?.name ?? "").trim().slice(0, 60) ||
      session.user.email?.split("@")[0] ||
      "Pengguna";
    cacheSession(session.user.id, name, session.user.email ?? "");
  } else {
    safeRemove(SESSION_KEY);
    clearIdentity();
  }
}

/** Keluar dari Supabase Auth. Sesi lokal dibersihkan segera;
 * signOut Supabase berjalan best-effort tanpa menahan navigasi. */
export async function logoutUser(): Promise<void> {
  safeRemove(SESSION_KEY);
  clearIdentity();
  // Hapus sesi Supabase yang tersimpan (sb-<ref>-auth-token) secara sinkron
  // agar tidak ter-restore oleh onAuthStateChange setelah navigasi.
  if (typeof window !== "undefined") {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("sb-")) window.localStorage.removeItem(key);
      }
    } catch {
      // abaikan
    }
  }
  if (typeof window !== "undefined" && isSupabaseConfigured() && supabase) {
    void supabase.auth.signOut().catch(() => undefined);
  }
}

/**
 * True bila user belum menyelesaikan onboarding (profil belum ada / belum lengkap).
 * Dipakai untuk mengarahkan user ke /onboarding setelah masuk.
 */
export async function needsOnboarding(): Promise<boolean> {
  const session = getSession();
  if (!session?.userId) return false;
  try {
    const res = await apiFetch(
      `/api/profile?userId=${encodeURIComponent(session.userId)}`
    );
    // Profil belum ada (404) → wajib onboarding. Kegagalan lain → biarkan masuk
    // (halaman onboarding akan mengoreksi sendiri lewat cek profilnya).
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const payload = await res.json();
    return !payload?.user?.onboardingCompleted;
  } catch {
    return false;
  }
}
