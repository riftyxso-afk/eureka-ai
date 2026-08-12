import { NextRequest, NextResponse } from "next/server";

import { listNotes } from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "").trim();
    const notes = await listNotes(userId || undefined);
    return NextResponse.json({ notes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat catatan.";
    console.error("[api/notes]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
