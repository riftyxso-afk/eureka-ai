import { NextRequest, NextResponse } from "next/server";

import { getShare } from "@/lib/assistant/store";

export const runtime = "nodejs";

/**
 * Ambil snapshot share publik via token — TANPA auth.
 * Token tidak dikenal → 404 (bukan 403) agar tidak mengungkap
 * keberadaan token yang ditebak.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const trimmed = token.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const share = await getShare(trimmed);
    if (!share) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      title: share.title,
      messages: share.messages,
    });
  } catch (e) {
    console.error("[api/shares/[token]] GET", e);
    return NextResponse.json({ error: "Gagal memuat share." }, { status: 500 });
  }
}
