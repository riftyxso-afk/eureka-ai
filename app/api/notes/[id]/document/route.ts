import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import type { NoteChapter } from "@/lib/types";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import { serializeNoteEmbedding } from "@/lib/rag/vector";

export const runtime = "nodejs";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (typeof body?.content !== "string" || body.content.length > 200000 || typeof body.original !== "string" || typeof body.title !== "string" || !body.title.trim() || body.title.length > 200 || typeof body.originalTitle !== "string") return NextResponse.json({ error: "Isi atau judul catatan tidak valid." }, { status: 400 });
  ensureRateLimitPrune();
  if (!checkRateLimit(`document-save:${auth.userId}`, 60, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Terlalu banyak penyimpanan. Coba lagi nanti." }, { status: 429 });
  const { id } = await params;
  const { data: current, error } = await db().from("notes").select("title, summary, chapters, updated_at").eq("id", id).eq("user_id", auth.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Catatan belum bisa dibaca." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
  const chapters: NoteChapter[] = current.chapters ?? [];
  const summary = body.chapterId == null;
  const index = chapters.findIndex(chapter => chapter.id === body.chapterId);
  if (!summary && index < 0) return NextResponse.json({ error: "Bab tidak ditemukan." }, { status: 404 });
  const previous = summary ? current.summary ?? "" : chapters[index].content;
  if (previous !== body.original || current.title !== body.originalTitle) return NextResponse.json({ error: "Catatan berubah di tempat lain. Salin perubahanmu sebelum memuat ulang." }, { status: 409 });
  const patch = summary ? { summary: body.content } : { chapters: chapters.map((chapter, item) => item === index ? { ...chapter, content: body.content } : chapter) };
  const update = db().from("notes").update({ ...patch, title: body.title.trim(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", auth.userId);
  const result = await (current.updated_at == null ? update.is("updated_at", null) : update.eq("updated_at", current.updated_at)).select("id").maybeSingle();
  if (result.error) return NextResponse.json({ error: "Perubahan belum tersimpan. Coba lagi." }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Catatan berubah saat disimpan. Salin perubahanmu sebelum memuat ulang." }, { status: 409 });
  let warning: string | undefined;
  if (!summary) {
    try {
      const parts = chunkText(body.content);
      const vectors = parts.length ? await embedTexts(parts) : [];
      const old = await db().from("chunks").select("id").eq("note_id", id).eq("chapter_id", body.chapterId);
      if (old.error) throw old.error;
      if (parts.length) {
        const inserted = await db().from("chunks").insert(parts.map((text, item) => ({ note_id: id, chapter_id: body.chapterId, text, embedding: serializeNoteEmbedding(vectors[item]) })));
        if (inserted.error) throw inserted.error;
      }
      if (old.data?.length) {
        const deleted = await db().from("chunks").delete().eq("note_id", id).in("id", old.data.map(row => row.id));
        if (deleted.error) throw deleted.error;
      }
    } catch { warning = "Isi tersimpan. Indeks pencarian AI belum diperbarui; jawaban AI mungkin belum mengikuti perubahan terbaru."; }
  }
  return NextResponse.json({ saved: true, title: body.title.trim(), content: body.content, warning });
}
