/**
 * Auth MVP berbasis localStorage (tanpa server/auth provider).
 *
 * NOTE: untuk produksi penuh, ganti dengan Supabase Auth (lib/supabase/client.ts
 * sudah disiapkan) — struktur fungsi di sini dibuat agar mudah di-swap.
 */
import { setUserName } from "./identity";

const USERS_KEY = "eureka_users";
const SESSION_KEY = "eureka_session";

export interface AuthUser {
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface AuthSession {
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

function listUsers(): AuthUser[] {
  return safeGet<AuthUser[]>(USERS_KEY) ?? [];
}

function saveUsers(users: AuthUser[]) {
  safeSet(USERS_KEY, users);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  const users = listUsers();
  return users.find((u) => u.email === session.email) ?? null;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
}

/** Buat akun baru + langsung login. Mengembalikan error bila email sudah terdaftar. */
export function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): AuthResult {
  const name = input.name.trim().slice(0, 60);
  const email = normalizeEmail(input.email);
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

  const users = listUsers();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "Email sudah terdaftar. Silakan masuk." };
  }

  const user: AuthUser = {
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  openSession(user);
  return { ok: true, user };
}

/** Cek kredensial lalu buka sesi. */
export function loginUser(input: {
  email: string;
  password: string;
}): AuthResult {
  const email = normalizeEmail(input.email);
  const users = listUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    return { ok: false, error: "Email belum terdaftar." };
  }
  if (user.password !== input.password) {
    return { ok: false, error: "Kata sandi salah." };
  }
  openSession(user);
  return { ok: true, user };
}

function openSession(user: AuthUser) {
  safeSet(SESSION_KEY, {
    email: user.email,
    loggedInAt: new Date().toISOString(),
  } satisfies AuthSession);
  // Sinkronkan identitas kolaborasi lokal (nama dipakai di catatan & teman).
  try {
    setUserName(user.name);
  } catch {
    // abaikan
  }
}

export function logoutUser() {
  safeRemove(SESSION_KEY);
}
