/**
 * History chat belajar (halaman /chat/[id]).
 *
 * - Pesan per sesi disimpan di localStorage (eureka_chat_<sessionId>).
 * - Daftar sesi disimpan di eureka_chat_sessions agar user bisa kembali
 *   ke percakapan sebelumnya.
 */
import type { Message } from "@/lib/types";

const SESSIONS_KEY = "eureka_chat_sessions";

export interface ChatSessionMeta {
  id: string;
  topic: string;
  updatedAt: number;
}

export function historyKey(sessionId: string): string {
  return `eureka_chat_${sessionId}`;
}

export function getHistory(sessionId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(sessionId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? (parsed as Message[]).filter((m) => m && typeof m.content === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveHistory(sessionId: string, messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      historyKey(sessionId),
      JSON.stringify(messages.slice(-200))
    );
  } catch {
    // abaikan (quota penuh)
  }
}

export function clearHistory(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(historyKey(sessionId));
  } catch {
    // abaikan
  }
}

export function listSessions(): ChatSessionMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as ChatSessionMeta[]) : [];
  } catch {
    return [];
  }
}

export function saveSessionMeta(meta: ChatSessionMeta): void {
  if (typeof window === "undefined") return;
  try {
    const list = listSessions().filter((s) => s.id !== meta.id);
    list.unshift(meta);
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // abaikan
  }
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = listSessions().filter((s) => s.id !== id);
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
    window.localStorage.removeItem(historyKey(id));
  } catch {
    // abaikan
  }
}
