/**
 * Identitas pengguna untuk fitur kolaborasi (client-side).
 * Tanpa sistem auth — identitas disimpan di localStorage.
 */
const ID_KEY = "eureka_user_id";
const NAME_KEY = "eureka_user_name";

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

export function getUserId(): string {
  let id = safeGet(ID_KEY);
  if (!id) {
    id = `user-${Math.random().toString(36).slice(2, 10)}`;
    safeSet(ID_KEY, id);
  }
  return id;
}

export function getUserName(): string {
  return safeGet(NAME_KEY) || "Riftyxso";
}

export function setUserName(name: string) {
  safeSet(NAME_KEY, name.trim().slice(0, 60));
}
