import { studyFileSchema } from "@/lib/study-file-types";
import { studyBrowserContextSchema, studyInteractionSchema, type SavedStudyResponse } from "@/lib/study-interaction";
/**
 * Store riwayat chat asisten AI (halaman /home & /chat) — Supabase.
 * Tabel: ai_chat_sessions, ai_chat_messages (lihat supabase_patch_003_ai_chat.sql)
 * Dipakai di server-side (API routes) lewat service role client.
 */
import { randomBytes } from "crypto";
import { db } from "../supabase/admin";
import { aiChat } from "../ai";
import { normalizeWebResults } from "./webSources";
import type {
  AssistantChatMessage,
  AssistantChatSession,
  AssistantSource,
  ShareMessage,
  ShareRecord,
} from "./types";

export type { AssistantSource };
export type { AssistantChatMessage, AssistantChatSession, ShareRecord };

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

export async function updateArtifactMessage(
  sessionId: string, messageId: string, previousContent: string, content: string
): Promise<boolean> {
  const { data, error } = await db().from("ai_chat_messages")
    .update({ content })
    .eq("id", messageId).eq("session_id", sessionId).eq("role", "assistant")
    .eq("content", previousContent).select("id");
  if (error) throw error;
  return (data?.length ?? 0) === 1;
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
  const saved = asArray<Record<string, unknown>>(m.sources).find(source => source.type === "study");
  const parsed = studyInteractionSchema.safeParse(saved?.interaction);
  const browser = studyBrowserContextSchema.safeParse(saved?.browser);
  return {
    study: saved && parsed.success ? {
      title: typeof saved.title === "string" ? saved.title.slice(0, 120) : "Belajar bersama Momo",
      document: saved.document === true,
      interaction: parsed.data,
      files: asArray<unknown>(saved.files).flatMap(file => { const parsed = studyFileSchema.safeParse(file); return parsed.success ? [parsed.data] : []; }),
      fileErrors: asArray<unknown>(saved.fileErrors).filter((message): message is string => typeof message === "string").slice(0, 3),
      browser: browser.success ? browser.data : undefined,
      computerUse: typeof saved.computerUse === "boolean" ? saved.computerUse : undefined,
    } : undefined,
    id: String(m.id ?? ""),
    sessionId: String(m.session_id ?? ""),
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? ""),
    mentions: asArray<string>(m.mentions),
    sources: asArray<Record<string, unknown>>(m.sources).filter(s => s.type !== "web" && s.type !== "study").map((s) => ({
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
    webResults: normalizeWebResults(asArray<Record<string, unknown>>(m.sources).filter(s => s.type === "web")),
    model: m.model ? String(m.model) : null,
    createdAt: String(m.created_at ?? ""),
  };
}

export async function appendMessage(data: {
  study?: SavedStudyResponse;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  mentions?: string[];
  sources?: AssistantSource[];
  webResults?: AssistantChatMessage["webResults"];
  model?: string | null;
}): Promise<AssistantChatMessage> {
  const { error } = await db().from("ai_chat_messages").insert({
    session_id: data.sessionId,
    role: data.role,
    content: data.content,
    mentions: data.mentions ?? [],
    sources: [...(data.study ? [{ type: "study", ...data.study }] : []), ...(data.sources ?? []), ...normalizeWebResults(data.webResults).map(source => ({ type: "web", ...source }))],
    model: data.model ?? null,
  });
  if (error) throw error;

  // Judul dibuat setelah jawaban selesai agar panggilannya tidak bersaing
  // dengan stream jawaban utama pada provider yang sama.
  if (data.role === "assistant") {
    void autoTitleIfNeeded(data.sessionId);
  }

  return {
    id: "",
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    mentions: data.mentions ?? [],
    sources: data.sources ?? [],
    study: data.study,
    webResults: normalizeWebResults(data.webResults),
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
  //    Model fast kadang mengeluarkan preamble thinking
  //    ("Here's a thinking process: ...") sebelum jawaban — ambil baris
  //    TERAKHIR yang berarti, lalu validasi; kalau masih mirip sampah,
  //    anggap AI gagal → fallback potongan prompt (perilaku lama).
  let title = "";
  try {
    const raw = await aiChat({
      system:
        "Kamu adalah penamai percakapan. Buat judul SINGKAT (3-6 kata) dalam bahasa Indonesia yang merangkum topik utama pesan user. Balas HANYA dengan judul — tanpa tanda kutip, tanpa tanda baca berlebihan, tanpa kata pengantar.",
      user: firstPrompt.slice(0, 800),
      maxTokens: 120,
      temperature: 0.3,
      speedMode: "fast",
      reasoning: false,
      model: "gpt-4o",
    });
    title = sanitizeAiTitle(raw);
  } catch (e) {
    console.warn("[assistant/store] AI title gagal — pakai potongan prompt:", e);
  }

  // 2) Fallback: potongan prompt pertama (perilaku lama).
  if (!title) {
    title = firstPrompt.slice(0, 60);
  }

  try {
    const { error } = await db()
      .from("ai_chat_sessions")
      .update({ title })
      .eq("id", sessionId);
    if (error) console.warn("[assistant/store] simpan judul gagal:", error.message);
  } catch (e) {
    console.warn("[assistant/store] simpan judul gagal:", e);
  }
}

/**
 * Bersihkan keluaran model penamai: buang baris preamble thinking, ambil
 * baris non-kosong terakhir (jawaban selalu setelah penalaran), validasi
 * bentuk judul. Return "" bila hasil tidak layak → pemanggil fallback.
 */
export function sanitizeAiTitle(raw: string): string {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>*-]+/, "").trim())
    .filter(Boolean);
  // Buang baris preamble thinking & langkah bernomor ("1. Analisis ...")
  // apa pun posisinya — keduanya bukan judul.
  const PREAMBLE_RE =
    /^(here'?s?\b|thinking|process|analisis|analysi|langkah|step|user.?s? (request|message)|pertama|kedua|marilah|i.?ll|i must|tentu,?|baik,?|\d+[.)]\s)/i;
  const candidates = lines.filter((l) => !PREAMBLE_RE.test(l));
  let title = (candidates[candidates.length - 1] ?? "").trim();
  // Potong sisa kalimat penjelas: "Judul: X" → "X".
  title = title.replace(/^(?:judul|title)\s*[:\-]\s*/i, "");
  title = title.replace(/["“”'‘’]/g, "").replace(/[.!?;:,\s]+$/, "").trim();
  if (!title) return "";
  // Validasi: 1-10 kata, ≤60 char, bukan meta-preamble yang lolos regex.
  const words = title.split(/\s+/).length;
  if (words > 10 || title.length > 60) return "";
  if (/thinking|process|preamble|instruction/i.test(title)) return "";
  return title;
}

/**
 * Buat snapshot share dari sesi: simpan salinan pesan (role + content)
 * beserta token acak 128-bit. Snapshot BEBAS — tidak terhubung ke sesi,
 * jadi pesan berikutnya / hapus sesi tidak mengubah halaman share.
 */
export async function createShare(
  sessionId: string,
  userId: string,
  title: string,
  messages: AssistantChatMessage[]
): Promise<ShareRecord> {
  const token = randomBytes(16).toString("hex");
  const snapshot: ShareMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const { data, error } = await db()
    .from("ai_chat_shares")
    .insert({
      session_id: sessionId,
      user_id: userId,
      title: title.trim().slice(0, 120),
      token,
      snapshot,
    })
    .select()
    .single();
  if (error) throw error;
  return mapShare(data);
}

/** Ambil share publik via token; null bila token tidak dikenal. */
export async function getShare(
  token: string
): Promise<Pick<ShareRecord, "title" | "messages"> | null> {
  const { data, error } = await db()
    .from("ai_chat_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    title: String(data.title ?? "Percakapan"),
    messages: mapSnapshot(data.snapshot),
  };
}

function mapShare(row: Record<string, unknown>): ShareRecord {
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    userId: row.user_id ? String(row.user_id) : null,
    title: String(row.title ?? "Percakapan"),
    token: String(row.token),
    messages: mapSnapshot(row.snapshot),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapSnapshot(raw: unknown): ShareMessage[] {
  return asArray<Record<string, unknown>>(raw).map((s) => ({
    role: s.role === "assistant" ? "assistant" : "user",
    content: String(s.content ?? ""),
  }));
}
