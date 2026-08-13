/**
 * Store riwayat chat asisten AI (halaman /home & /chat) — Supabase.
 * Tabel: ai_chat_sessions, ai_chat_messages (lihat supabase_patch_003_ai_chat.sql)
 * Dipakai di server-side (API routes) lewat service role client.
 */
import { db } from "../supabase/admin";
import { aiChat } from "../ai";
import type {
  AssistantChatMessage,
  AssistantChatSession,
  AssistantSource,
} from "./types";

export type { AssistantSource };
export type { AssistantChatMessage, AssistantChatSession };

export async function createSession(userId: string): Promise<AssistantChatSession> {
  const { data, error } = await db()
    .from("ai_chat_sessions")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return mapSession(data);
}

export async function listSessions(userId: string): Promise<AssistantChatSession[]> {
  const { data, error } = await db()
    .from("ai_chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapSession);
}

export async function getSession(
  sessionId: string,
  userId: string
): Promise<AssistantChatSession | null> {
  const { data, error } = await db()
    .from("ai_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

export async function renameSession(
  sessionId: string,
  userId: string,
  title: string
): Promise<void> {
  const { error } = await db()
    .from("ai_chat_sessions")
    .update({ title: title.trim().slice(0, 120) })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const { error } = await db()
    .from("ai_chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getMessages(
  sessionId: string,
  _userId: string
): Promise<AssistantChatMessage[]> {
  // Keamanan akses ditangani pemanggil: route sudah memverifikasi kepemilikan
  // sesi via getSession(sessionId, userId) sebelum memanggil fungsi ini
  // (lihat app/api/assistant/chat dan app/api/assistant/sessions/[sessionId]).
  const { data, error } = await db()
    .from("ai_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

/** Parse kolom JSONB yang mungkin kosong/null/opaque → bentuk array. */
function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") return [raw as T];
  return [];
}

function mapSession(row: Record<string, unknown>): AssistantChatSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? "Percakapan baru"),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapMessage(m: Record<string, unknown>): AssistantChatMessage {
  return {
    id: String(m.id ?? ""),
    sessionId: String(m.session_id ?? ""),
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? ""),
    mentions: asArray<string>(m.mentions),
    sources: asArray<Record<string, unknown>>(m.sources).map((s) => ({
      noteId: String(s.noteId ?? s.note_id ?? ""),
      noteTitle: String(s.noteTitle ?? s.note_title ?? "Catatan"),
      chapterId:
        s.chapterId != null
          ? Number(s.chapterId)
          : s.chapter_id != null
            ? Number(s.chapter_id)
            : null,
      similarity: s.similarity != null ? Number(s.similarity) : undefined,
    })),
    model: m.model ? String(m.model) : null,
    createdAt: String(m.created_at ?? ""),
  };
}

export async function appendMessage(data: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  mentions?: string[];
  sources?: AssistantSource[];
  model?: string | null;
}): Promise<AssistantChatMessage> {
  const { error } = await db().from("ai_chat_messages").insert({
    session_id: data.sessionId,
    role: data.role,
    content: data.content,
    mentions: data.mentions ?? [],
    sources: data.sources ?? [],
    model: data.model ?? null,
  });
  if (error) throw error;

  // Judul otomatis dari pesan user pertama (jika masih default).
  // Fire-and-forget: generate judul via AI tidak menunda stream jawaban.
  if (data.role === "user") {
    void autoTitleIfNeeded(data.sessionId);
  }

  return {
    id: "",
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    mentions: data.mentions ?? [],
    sources: data.sources ?? [],
    model: data.model ?? null,
    createdAt: new Date().toISOString(),
  };
}

/** Pesan user terakhir yang belum dijawab AI (retry tidak boleh menggandakan). */
export async function lastUnansweredUserMessage(
  sessionId: string
): Promise<{ content: string } | null> {
  const { data } = await db()
    .from("ai_chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.role !== "user") return null;
  return { content: String(data.content ?? "") };
}

/**
 * Isi judul sesi dari pesan pertama bila masih "Percakapan baru".
 *
 * Judul di-GENERATE AI: ringkasan singkat topik yang dibahas (bukan potongan
 * prompt mentah) agar riwayat chat rapi. Bila AI gagal/sibuk, fallback ke
 * potongan prompt pertama.
 */
async function autoTitleIfNeeded(sessionId: string): Promise<void> {
  const { data } = await db()
    .from("ai_chat_messages")
    .select("content")
    .eq("session_id", sessionId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.content) return;

  // Sesi sudah punya judul (bukan default) → jangan timpa.
  const { data: session } = await db()
    .from("ai_chat_sessions")
    .select("title")
    .eq("id", sessionId)
    .maybeSingle();
  if (session?.title && session.title !== "Percakapan baru") return;

  const firstPrompt = data.content.replace(/\s+/g, " ").trim();
  if (!firstPrompt) return;

  // 1) Coba generate judul via AI (mode fast — cepat & ringan).
  let title = "";
  try {
    const raw = await aiChat({
      system:
        "Kamu adalah penamai percakapan. Buat judul SINGKAT (3-6 kata) dalam bahasa Indonesia yang merangkum topik utama pesan user. Balas HANYA dengan judul — tanpa tanda kutip, tanpa tanda baca berlebihan, tanpa kata pengantar.",
      user: firstPrompt.slice(0, 800),
      maxTokens: 40,
      temperature: 0.3,
      speedMode: "fast",
    });
    title = raw
      .replace(/["“”'‘’]/g, "")
      .split(/\r?\n/)[0]
      .trim()
      .slice(0, 60);
  } catch (e) {
    console.warn("[assistant/store] AI title gagal — pakai potongan prompt:", e);
  }

  // 2) Fallback: potongan prompt pertama (perilaku lama).
  if (!title) {
    title = firstPrompt.slice(0, 60);
  }

  await db()
    .from("ai_chat_sessions")
    .update({ title })
    .eq("id", sessionId);
}