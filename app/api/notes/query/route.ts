import { NextRequest, NextResponse } from "next/server";

import { embedTexts } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    if (!query) {
      return NextResponse.json({ error: "Query kosong." }, { status: 400 });
    }

    const [embedding] = await embedTexts([query], "query");
    const results = await searchChunks(
      embedding,
      Number(body?.topK) || 3,
      body?.noteId ? String(body.noteId) : undefined,
      body?.userId ? String(body.userId) : undefined
    );

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mencari di catatan.";
    console.error("[api/notes/query]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
