/**
 * Klien Kuis Share & Live Room (browser).
 * - apiFetch ke route /api/quiz-* (backend via NEXT_PUBLIC_API_URL)
 * - Supabase Realtime: subscribe perubahan quiz_room_participants
 *   (filter room_id) → leaderboard otomatis.
 * - sessionStorage: participant_key + jawaban dipulihkan saat buka ulang.
 */
import { apiFetch } from "./apiClient";
import { supabase } from "./supabase/client";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface RoomParticipant {
  id: string;
  name: string;
  isHost: boolean;
  score: number | null;
  submittedAt: string | null;
}

export interface RoomInfo {
  id: string;
  token: string;
  status: "lobby" | "live" | "ended";
  createdAt: string;
  questions: QuizQuestion[];
  participants: RoomParticipant[];
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export class QuizClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await readJson(res);
    throw new QuizClientError(
      typeof data.error === "string" ? data.error : "Terjadi kesalahan.",
      res.status
    );
  }
  return (await res.json()) as T;
}

/** URL publik kuis (origin frontend — API bisa di origin lain). */
export function buildQuizUrl(token: string): string {
  return `${window.location.origin}/quiz/${token}`;
}

/** Simpan share kuis (auth). → { token } */
export async function createQuizShare(input: {
  noteId: string;
  noteTitle: string;
  questions: { id: number; question: string; options: string[]; answer: number; explanation: string }[];
}): Promise<{ token: string }> {
  const res = await apiFetch("/api/quiz-shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle(res);
}

/** Ambil share publik. → { title, questions } */
export async function getQuizShare(token: string): Promise<{
  title: string;
  questions: QuizQuestion[];
}> {
  const res = await fetch(`/api/quiz-shares/${encodeURIComponent(token)}`);
  return handle(res);
}

/** Buat ruang live dari share (auth). → { token, participantKey } */
export async function createQuizRoom(input: {
  shareToken: string;
  hostName: string;
}): Promise<{ token: string; participantKey: string }> {
  const res = await apiFetch("/api/quiz-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle(res);
}

/** Ambil info room publik. */
export async function getQuizRoom(token: string): Promise<RoomInfo> {
  const res = await fetch(`/api/quiz-rooms/${encodeURIComponent(token)}`);
  return handle(res);
}

/** Join room publik. → { roomId, participantKey, isHost } */
export async function joinQuizRoom(input: {
  token: string;
  name: string;
}): Promise<{ roomId: string; participantKey: string; isHost: boolean }> {
  const res = await fetch(`/api/quiz-rooms/${encodeURIComponent(input.token)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name }),
  });
  return handle(res);
}

/** Host memulai ruang (hostKey). */
export async function startQuizRoom(input: {
  token: string;
  hostKey: string;
}): Promise<void> {
  const res = await fetch(`/api/quiz-rooms/${encodeURIComponent(input.token)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostKey: input.hostKey }),
  });
  await handle(res);
}

/** Submit jawaban. → { score, total } */
export async function submitQuizRoom(input: {
  token: string;
  participantKey: string;
  answers: Record<string, number>;
}): Promise<{ score: number; total: number }> {
  const res = await fetch(`/api/quiz-rooms/${encodeURIComponent(input.token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantKey: input.participantKey,
      answers: input.answers,
    }),
  });
  return handle(res);
}

/* ─── SessionStorage (restore identitas & jawaban) ─────────── */

const KEY_STORAGE = (token: string) => `eureka_quiz_key_${token}`;
const ANSWERS_STORAGE = (token: string) => `eureka_quiz_answers_${token}`;

export function saveParticipantKey(token: string, key: string): void {
  try {
    sessionStorage.setItem(KEY_STORAGE(token), key);
  } catch {
    // storage tidak tersedia → abaikan
  }
}

const NAME_STORAGE = (token: string) => `eureka_quiz_name_${token}`;

export function saveRoomName(token: string, name: string): void {
  try {
    sessionStorage.setItem(NAME_STORAGE(token), name);
  } catch {
    // abaikan
  }
}

export function loadRoomName(token: string): string {
  try {
    return sessionStorage.getItem(NAME_STORAGE(token)) ?? "";
  } catch {
    return "";
  }
}

export function loadParticipantKey(token: string): string {
  try {
    return sessionStorage.getItem(KEY_STORAGE(token)) ?? "";
  } catch {
    return "";
  }
}

export function clearParticipantKey(token: string): void {
  try {
    sessionStorage.removeItem(KEY_STORAGE(token));
  } catch {
    // abaikan
  }
}

export function saveAnswers(token: string, answers: Record<string, number>): void {
  try {
    sessionStorage.setItem(ANSWERS_STORAGE(token), JSON.stringify(answers));
  } catch {
    // abaikan
  }
}

export function loadAnswers(token: string): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(ANSWERS_STORAGE(token));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function clearAnswers(token: string): void {
  try {
    sessionStorage.removeItem(ANSWERS_STORAGE(token));
  } catch {
    // abaikan
  }
}

/* ─── Realtime leaderboard ─────────────────────────────────── */

export interface RealtimeUnsubscribe {
  unsubscribe: () => void;
}

/**
 * Subscribe perubahan quiz_room_participants (filter room_id).
 * Setiap perubahan (join/submit) memicu onRoomUpdate() → pemanggil
 * me-refetch room via getQuizRoom. Return objek ber-unsubscribe.
 * Tanpa Supabase terkonfigurasi → no-op yang aman.
 */
export function subscribeRoomUpdates(
  roomId: string,
  onRoomUpdate: () => void
): RealtimeUnsubscribe {
  const client = supabase;
  if (!client) {
    return { unsubscribe: () => {} };
  }
  const channel = client
    .channel(`quiz_room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "quiz_room_participants",
        filter: `room_id=eq.${roomId}`,
      },
      () => onRoomUpdate()
    )
    .subscribe();
  return {
    unsubscribe: () => {
      client.removeChannel(channel);
    },
  };
}