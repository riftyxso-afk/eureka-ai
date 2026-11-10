import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import { getSubjects } from "@/lib/subjects-store";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
type SavedCard = { id: string; front: string; back: string; review_count: number };
const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
const publicCards = (cards: SavedCard[]) => cards.map(({ id, front, back }) => ({ id, front, back }));

async function authorize(req: NextRequest, context: Context, noteId: unknown) {
  const auth = await requirePro(req.headers.get("authorization"));
  if ("error" in auth) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (typeof noteId !== "string" || !noteId.trim() || noteId.length > 100) {
    return { response: NextResponse.json({ error: "Catatan tidak valid." }, { status: 400 }) };
  }
  const { id } = await context.params;
  const [found, subjects] = await Promise.all([getNoteWithChunks(noteId), getSubjects(auth.userId)]);
  const subject = subjects.find((item) => item.id === id);
  if (!subject || !found || found.note.user_id !== auth.userId || normalize(found.note.subject ?? "") !== normalize(subject.name)) {
    return { response: NextResponse.json({ error: "Catatan tidak ditemukan dalam pelajaran ini." }, { status: 404 }) };
  }
  return { userId: auth.userId, noteId };
}

async function loadCards(userId: string, noteId: string): Promise<SavedCard[]> {
  const { data, error } = await db().from("flashcards")
    .select("id, front, back, review_count").eq("user_id", userId).eq("note_id", noteId)
    .order("created_at").order("id");
  if (error) throw error;
  return data ?? [];
}

// Serialize this process's duplicate clicks without changing the shared progress routes.
const pending = new Set<string>();

export async function GET(req: NextRequest, context: Context) {
  try {
    const access = await authorize(req, context, req.nextUrl.searchParams.get("noteId"));
    if (access.response) return access.response;
    return NextResponse.json({ cards: publicCards(await loadCards(access.userId!, access.noteId!)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[subjects/practice GET]", error);
    return NextResponse.json({ error: "Kartu tersimpan belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Context) {
  let lock: string | undefined;
  let updatedCount = 0;
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 }); }
    if (!body || typeof body !== "object" || !["prepare", "review"].includes(body.action)) {
      return NextResponse.json({ error: "Aktivitas tidak valid." }, { status: 400 });
    }
    const access = await authorize(req, context, body.noteId);
    if (access.response) return access.response;
    const userId = access.userId!;
    const noteId = access.noteId!;
    const key = `${userId}:${noteId}`;
    if (pending.has(key)) return NextResponse.json({ error: "Aktivitas sedang disimpan. Coba lagi sebentar." }, { status: 409 });
    pending.add(key);
    lock = key;
    const existing = await loadCards(userId, noteId);
    if (body.action === "prepare") {
      if (!Array.isArray(body.cards) || body.cards.length < 1 || body.cards.length > 30 || body.cards.some((card: unknown) => {
        if (!card || typeof card !== "object") return true;
        const c = card as Record<string, unknown>;
        return typeof c.front !== "string" || !c.front.trim() || c.front.length > 2000 || typeof c.back !== "string" || !c.back.trim() || c.back.length > 5000;
      })) return NextResponse.json({ error: "Isi kartu tidak valid (maksimal 30 kartu)." }, { status: 400 });
      if (existing.length) return NextResponse.json({ cards: publicCards(existing) });
      const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { data, error } = await db().from("flashcards").insert(body.cards.map((card: { front: string; back: string }) => ({
        user_id: userId, note_id: noteId, front: card.front.trim(), back: card.back.trim(), due_date: due, review_count: 0,
      }))).select("id, front, back, review_count");
      if (error || !data?.length) throw error ?? new Error("No cards saved");
      return NextResponse.json({ cards: publicCards(data) });
    }
    const ids: unknown = body.cardIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Daftar kartu tidak valid." }, { status: 400 });
    }
    const selected = new Set(ids);
    if (existing.length !== ids.length || existing.some((card) => !selected.has(card.id))) {
      return NextResponse.json({ error: "Kartu tersimpan telah berubah. Muat ulang latihan sebelum menyimpan." }, { status: 409 });
    }
    const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    for (const card of existing) {
      const { data, error } = await db().from("flashcards")
        .update({ review_count: card.review_count + 1, due_date: due })
        .eq("id", card.id).eq("user_id", userId).eq("note_id", noteId)
        .eq("review_count", card.review_count).select("id");
      if (error) throw error;
      if (data?.length !== 1) return NextResponse.json({ error: "Kartu berubah saat disimpan. Sebagian aktivitas mungkin sudah tersimpan. Muat ulang latihan." }, { status: 409 });
      updatedCount++;
    }
    return NextResponse.json({ saved: true, reviewed: existing.length, dueDate: due, xpAwarded: 0 });
  } catch (error) {
    console.error("[subjects/practice POST]", error);
    return NextResponse.json({ error: updatedCount > 0 ? "Sebagian aktivitas mungkin sudah tersimpan. Muat ulang latihan; tidak ada XP yang diberikan." : "Aktivitas belum berhasil disimpan. Coba lagi; tidak ada XP yang diberikan." }, { status: 500 });
  } finally {
    if (lock) pending.delete(lock);
  }
}
