/**
 * Identitas pengguna untuk fitur kolaborasi (client-side).
 * Disinkronkan dari sesi Supabase Auth saat login/register/syncAuthSession.
 */
const ID_KEY = "eureka_user_id";
const NAME_KEY = "eureka_user_name";
/** Kunci sesi auth (lihat lib/auth.ts) — dibaca langsung untuk menghindari circular import. */
const SESSION_KEY = "eureka_session";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // abaikan
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

export function getUserId(): string {
  const id = safeGet(ID_KEY);
  if (id) return id;
  // Fallback offline (mis. demo tanpa login).
  const generated = `user-${Math.random().toString(36).slice(2, 10)}`;
  safeSet(ID_KEY, generated);
  return generated;
}

export function getUserName(): string {
  // Sumber utama: nama dari sesi auth (eureka_session) — cache yang
  // disinkronkan dari database saat login/sync/updateSessionName.
  try {
    const raw = safeGet(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: unknown } | null;
      const name = typeof parsed?.name === "string" ? parsed.name.trim() : "";
      if (name) return name;
    }
  } catch {
    // abaikan — lanjut ke fallback
  }
  // Fallback: nama identity lama, lalu nama generik (bukan nama pengembang).
  return safeGet(NAME_KEY) || "Pengguna";
}

export function setUserName(name: string) {
  safeSet(NAME_KEY, name.trim().slice(0, 60));
}

export function setUserId(id: string) {
  safeSet(ID_KEY, id);
}

export function clearIdentity() {
  safeRemove(ID_KEY);
  safeRemove(NAME_KEY);
}
