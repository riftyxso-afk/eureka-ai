import { NextRequest, NextResponse } from "next/server";

import { removeFriend } from "@/lib/friends-store";
import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const { friendId } = await params;
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    // Wajib login; userId dari query harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await removeFriend(userId, friendId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal menghapus teman.";
    console.error("[api/friends/[friendId]] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
