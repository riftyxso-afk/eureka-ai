import { NextRequest, NextResponse } from "next/server";

import { deleteSubject } from "@/lib/subjects-store";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSubject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus mata pelajaran.";
    console.error("[api/subjects/[id]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
