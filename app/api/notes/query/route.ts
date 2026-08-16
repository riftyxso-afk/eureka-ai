import { NextRequest, NextResponse } from "next/server";

import { embedTexts } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/store";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }
    const userId = String(body?.userId ?? "").trim();

    // Wajib login; userId dari body harus cocok dengan token sesi — RAG
    // hanya boleh berjalan atas data milik pemilik sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Rate limit per user (proteksi biaya embedding + RAG): maks 30/jam.
    ensureRateLimitPrune();
    const rl = checkRateLimit(`notes-query:${userId}`, 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak pencarian dalam 1 jam. Tunggu sebentar ya." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const [embedding] = await embedTexts([query], "query");
    const results = await searchChunks(
      embedding,
      Number(body?.topK) || 3,
      body?.noteId ? String(body.noteId) : undefined,
      userId || undefined
    );

    return NextResponse.json({ results });
  } catch (e) {
    const msg = "Gagal mencari di catatan.";
    console.error("[api/notes/query]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
