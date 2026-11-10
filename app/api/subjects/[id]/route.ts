import { NextRequest, NextResponse } from "next/server";

import { deleteSubject } from "@/lib/subjects-store";
import { requirePro } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePro(req.headers.get("authorization"));
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }
    const { id } = await params;
    await deleteSubject(id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal menghapus mata pelajaran.";
    console.error("[api/subjects/[id]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
