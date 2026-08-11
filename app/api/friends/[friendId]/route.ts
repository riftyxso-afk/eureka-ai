import { NextRequest, NextResponse } from "next/server";

import { removeFriend } from "@/lib/friends-store";

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
    await removeFriend(userId, friendId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus teman.";
    console.error("[api/friends/[friendId]] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
