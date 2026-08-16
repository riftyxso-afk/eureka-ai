/**
 * Kuis Share & Live Room — server logic (service-role).
 *
 * - quiz_shares: snapshot soal dibagikan via token publik `s_*`
 *   (view-only, tanpa login).
 * - quiz_rooms: ruang live dari sebuah share via token `r_*`;
 *   status lobby → live → ended; host_key = otorisasi host.
 * - quiz_room_participants: nama unik per room; participant_key
 *   = otorisasi submit; satu submit per partisipan (409 bila dobel).
 *
 * Realtime: klien me-refresh room via polling GET /api/quiz-rooms/[token]
 * (postgres_changes tidak dipakai — lihat lib/quizLiveClient).
 */
import { randomBytes } from "crypto";

import { db } from "./supabase/admin";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface ShareRecord {
  id: string;
  token: string;
  noteId: string;
  noteTitle: string;
  questions: QuizQuestion[];
}

export interface RoomParticipant {
  id: string;
  name: string;
  isHost: boolean;
  score: number | null;
  submittedAt: string | null;
}

export interface RoomRecord {
  id: string;
  token: string;
  status: "lobby" | "live" | "ended";
  questions: QuizQuestion[];
  participants: RoomParticipant[];
  createdAt: string;
}

/** Error dengan status HTTP untuk dipetakan route. */
export class QuizLiveError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const TOKEN_PREFIXES = { share: "s_", room: "r_" } as const;

/** Token acak unix: prefix + 22 char base62 (≈ 128 bit entropy). */
function randomToken(prefix: string): string {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return prefix + out;
}

function assertShareToken(token: string): void {
  if (!token.startsWith(TOKEN_PREFIXES.share)) {
    throw new QuizLiveError("Not found.", 404);
  }
}

function assertRoomToken(token: string): void {
  if (!token.startsWith(TOKEN_PREFIXES.room)) {
    throw new QuizLiveError("Not found.", 404);
  }
}

/** Validasi snapshot soal sebelum disimpan (bentuk sama dengan generateQuiz). */
export function validateQuestions(questions: unknown): QuizQuestion[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new QuizLiveError("Soal kuis kosong.", 422);
  }
  return questions.slice(0, 10).map((q, i) => {
    const item = q as Record<string, unknown>;
    if (
      typeof item.question !== "string" ||
      !Array.isArray(item.options) ||
      item.options.length < 2 ||
      typeof item.answer !== "number" ||
      typeof item.explanation !== "string"
    ) {
      throw new QuizLiveError("Soal kuis tidak valid.", 422);
    }
    return {
      id: typeof item.id === "string" && item.id ? item.id : String(i + 1),
      question: String(item.question).trim().slice(0, 500),
      options: (item.options as unknown[]).map((o) => String(o).slice(0, 200)),
      answer: Math.min(
        Math.max(Math.floor(item.answer), 0),
        item.options.length - 1
      ),
      explanation: String(item.explanation).trim().slice(0, 800),
    };
  });
}

/** Simpan share baru; pemilik = userId. Return { id, token }. */
export async function createShare(input: {
  userId: string;
  noteId: string;
  noteTitle: string;
  questions: QuizQuestion[];
}): Promise<{ id: string; token: string }> {
  const { data, error } = await db()
    .from("quiz_shares")
    .insert({
      token: randomToken(TOKEN_PREFIXES.share),
      note_id: input.noteId,
      note_title: input.noteTitle,
      questions: input.questions,
      created_by: input.userId,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[quizLive] createShare:", error);
    throw new QuizLiveError("Gagal menyimpan share.", 500);
  }
  return { id: data.id as string, token: data.token as string };
}

/** Ambil share via token publik. Return null bila tak dikenal. */
export async function getShareByToken(token: string): Promise<ShareRecord | null> {
  assertShareToken(token);
  const { data, error } = await db()
    .from("quiz_shares")
    .select("id, token, note_id, note_title, questions")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    token: data.token as string,
    noteId: data.note_id as string,
    noteTitle: (data.note_title as string) ?? "",
    questions: (data.questions as QuizQuestion[]) ?? [],
  };
}

/** Ambil room + partisipan via token publik. Return null bila tak dikenal. */
export async function getRoomByToken(token: string): Promise<RoomRecord | null> {
  assertRoomToken(token);
  const { data: room, error: roomError } = await db()
    .from("quiz_rooms")
    .select("id, token, status, share_id, created_at")
    .eq("token", token)
    .maybeSingle();
  if (roomError || !room) return null;

  const { data: shareRow, error: shareError } = await db()
    .from("quiz_shares")
    .select("note_title, questions")
    .eq("id", room.share_id)
    .maybeSingle();
  if (shareError || !shareRow) return null;

  const { data: participants, error: partError } = await db()
    .from("quiz_room_participants")
    .select("id, name, is_host, score, submitted_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });
  if (partError) return null;

  return {
    id: room.id as string,
    token: room.token as string,
    status: room.status as RoomRecord["status"],
    questions: (shareRow.questions as QuizQuestion[]) ?? [],
    participants: (participants ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      isHost: Boolean(p.is_host),
      score: (p.score as number | null) ?? null,
      submittedAt: (p.submitted_at as string | null) ?? null,
    })),
    createdAt: room.created_at as string,
  };
}

/** Buat room dari share + partisipan host (host_key = participant_key host). */
export async function createRoom(input: {
  shareToken: string;
  hostName: string;
}): Promise<{ token: string; participantKey: string }> {
  const share = await getShareByToken(input.shareToken);
  if (!share) throw new QuizLiveError("Share tidak ditemukan.", 404);
  const name = input.hostName.trim().slice(0, 40);
  if (!name) throw new QuizLiveError("Nama tidak boleh kosong.", 422);

  const hostKey = randomToken(TOKEN_PREFIXES.room) + randomBytes(4).toString("hex");
  const { data: room, error: roomError } = await db()
    .from("quiz_rooms")
    .insert({
      token: randomToken(TOKEN_PREFIXES.room),
      share_id: share.id,
      host_key: hostKey,
      status: "lobby",
    })
    .select("id, token")
    .single();
  if (roomError || !room) {
    console.error("[quizLive] createRoom:", roomError);
    throw new QuizLiveError("Gagal membuat ruang.", 500);
  }

  const { error: hostError } = await db().from("quiz_room_participants").insert({
    room_id: room.id,
    name,
    participant_key: hostKey,
    is_host: true,
  });
  if (hostError) {
    console.error("[quizLive] createRoom host:", hostError);
    throw new QuizLiveError("Gagal membuat ruang.", 500);
  }
  return { token: room.token as string, participantKey: hostKey };
}

/** Join room publik: nama unik per room → 409 bila sudah dipakai. */
export async function joinRoom(input: {
  roomToken: string;
  name: string;
}): Promise<{ roomId: string; participantKey: string; isHost: boolean }> {
  const room = await getRoomByToken(input.roomToken);
  if (!room) throw new QuizLiveError("Ruang tidak ditemukan.", 404);
  if (room.status === "ended") {
    throw new QuizLiveError("Ruang sudah berakhir.", 409);
  }
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new QuizLiveError("Nama tidak boleh kosong.", 422);

  const participantKey = randomToken(TOKEN_PREFIXES.room) + randomBytes(4).toString("hex");
  const { data, error } = await db()
    .from("quiz_room_participants")
    .insert({ room_id: room.id, name, participant_key: participantKey })
    .select("id, participant_key, is_host")
    .single();
  if (error) {
    const isUniqueViolation =
      typeof error.code === "string" && error.code.startsWith("23");
    if (isUniqueViolation) {
      throw new QuizLiveError("Nama sudah dipakai di ruang ini.", 409);
    }
    console.error("[quizLive] joinRoom:", error);
    throw new QuizLiveError("Gagal bergabung ke ruang.", 500);
  }
  return {
    roomId: room.id,
    participantKey: data.participant_key as string,
    isHost: Boolean(data.is_host),
  };
}

/** Mulai ruang (host_key). Hanya dari lobby. */
export async function startRoom(input: {
  roomToken: string;
  hostKey: string;
}): Promise<void> {
  const room = await getRoomByToken(input.roomToken);
  if (!room) throw new QuizLiveError("Ruang tidak ditemukan.", 404);
  if (room.status !== "lobby") {
    throw new QuizLiveError("Ruang sudah dimulai.", 409);
  }
  const { data, error } = await db()
    .from("quiz_rooms")
    .update({ status: "live" })
    .eq("id", room.id)
    .eq("host_key", input.hostKey)
    .select("id");
  if (error) {
    console.error("[quizLive] startRoom:", error);
    throw new QuizLiveError("Gagal memulai ruang.", 500);
  }
  if (!data || data.length === 0) {
    throw new QuizLiveError("Host key tidak valid.", 409);
  }
}

/** Akhiri ruang (host_key). */
export async function endRoom(input: {
  roomToken: string;
  hostKey: string;
}): Promise<void> {
  const room = await getRoomByToken(input.roomToken);
  if (!room) throw new QuizLiveError("Ruang tidak ditemukan.", 404);
  const { data, error } = await db()
    .from("quiz_rooms")
    .update({ status: "ended" })
    .eq("id", room.id)
    .eq("host_key", input.hostKey)
    .select("id");
  if (error) {
    console.error("[quizLive] endRoom:", error);
    throw new QuizLiveError("Gagal mengakhiri ruang.", 500);
  }
  if (!data || data.length === 0) {
    throw new QuizLiveError("Host key tidak valid.", 409);
  }
}

function scoreAnswers(
  answers: Record<string, number>,
  questions: QuizQuestion[]
): number {
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === q.answer) score++;
  }
  return score;
}

/**
 * Submit jawaban partisipan. Satu submit per partisipan → bila sudah
 * submit sebelumnya, lempar 409. Return { score, total }.
 */
export async function submitRoomAnswers(input: {
  roomToken: string;
  participantKey: string;
  answers: Record<string, number>;
}): Promise<{ score: number; total: number }> {
  const room = await getRoomByToken(input.roomToken);
  if (!room) throw new QuizLiveError("Ruang tidak ditemukan.", 404);
  if (room.status !== "live") {
    throw new QuizLiveError(
      room.status === "lobby"
        ? "Ruang belum dimulai oleh host."
        : "Ruang sudah berakhir.",
      409
    );
  }

  const { data: participant, error: partError } = await db()
    .from("quiz_room_participants")
    .select("id, submitted_at")
    .eq("participant_key", input.participantKey)
    .maybeSingle();
  if (partError || !participant) {
    throw new QuizLiveError("Partisipan tidak ditemukan.", 404);
  }
  if (participant.submitted_at) {
    throw new QuizLiveError("Kamu sudah mengirim jawaban.", 409);
  }

  const answers: Record<string, number> = {};
  for (const q of room.questions) {
    const v = input.answers[q.id];
    if (typeof v === "number" && Number.isFinite(v)) answers[q.id] = v;
  }
  const score = scoreAnswers(answers, room.questions);

  const { error } = await db()
    .from("quiz_room_participants")
    .update({
      answers,
      score,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", participant.id)
    .is("submitted_at", null);
  if (error) {
    console.error("[quizLive] submitRoomAnswers:", error);
    throw new QuizLiveError("Gagal menyimpan jawaban.", 500);
  }
  return { score, total: room.questions.length };
}