import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks, listNotes, saveNoteWithChunks } from "@/lib/rag/store";
import { requireAuth } from "@/lib/assistant/auth";
import { randomUUID } from "node:crypto";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if (!auth.userId) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
    if (!title || title.length > 200 || !summary || summary.length > 1200) {
      return NextResponse.json({ error: "Isi judul hingga 200 karakter dan isi catatan hingga 1.200 karakter." }, { status: 400 });
    }
    ensureRateLimitPrune();
    if (!checkRateLimit(`note-manual:${auth.userId}`, 20, 60 * 60 * 1000).ok) {
      return NextResponse.json({ error: "Terlalu banyak catatan dibuat. Silakan coba lagi nanti." }, { status: 429 });
    }
    const id = body?.id ?? randomUUID();
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "ID catatan tidak valid." }, { status: 400 });
    }
    try {
      const note = await saveNoteWithChunks({
        id, title, summary, subject: "Umum", createdAt: new Date().toISOString(), user_id: auth.userId,
      }, []);
      return NextResponse.json({ note }, { status: 201 });
    } catch (error) {
      if ((error as { code?: string })?.code !== "23505") throw error;
      const existing = (await getNoteWithChunks(id))?.note;
      if (existing?.user_id === auth.userId && existing.title === title && existing.summary === summary) {
        return NextResponse.json({ note: existing });
      }
      return NextResponse.json({ error: "Permintaan ini sudah digunakan. Buka aksi baru untuk membuat catatan lain." }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Catatan belum bisa disimpan." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "").trim();
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (!auth.userId) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });
    }
    const notes = await listNotes(auth.userId);
    return NextResponse.json({ notes });
  } catch (e) {
    const msg = "Gagal memuat catatan.";
    console.error("[api/notes]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
