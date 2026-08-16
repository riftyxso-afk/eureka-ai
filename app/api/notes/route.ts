import { NextRequest, NextResponse } from "next/server";

import { listNotes } from "@/lib/rag/store";
import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "").trim();
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const notes = await listNotes(userId || undefined);
    return NextResponse.json({ notes });
  } catch (e) {
    const msg = "Gagal memuat catatan.";
    console.error("[api/notes]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}