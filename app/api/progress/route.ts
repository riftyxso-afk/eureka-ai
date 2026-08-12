import { NextRequest, NextResponse } from "next/server";

import {
  addCards,
  getStats,
  recordActivity,
  reviewAllCards,
  type ProgressStats,
} from "@/lib/progress-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    const stats = await getStats(userId);
    return NextResponse.json({ stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat progres.";
    console.error("[api/progress] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      userId?: string;
      xp?: number;
      noteId?: string;
      label?: string;
      cards?: { front: string; back: string }[];
    } | null;
    const userId = String(body?.userId ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    const action = String(body?.action ?? "");
    const xp = Math.max(0, Number(body?.xp ?? 0) || 0);
    const noteId = String(body?.noteId ?? "");
    const label = String(body?.label ?? "");

    if (action === "activity") {
      const { levelUp } = await recordActivity(userId, xp, label || undefined);
      const stats: ProgressStats = await getStats(userId);
      return NextResponse.json({ ok: true, stats, levelUp });
    }

    if (action === "cards_add") {
      const cards = Array.isArray(body?.cards) ? body.cards : [];
      await addCards(userId, noteId, cards);
      const { levelUp } = xp > 0
        ? await recordActivity(userId, xp, label || undefined)
        : { levelUp: false };
      const stats: ProgressStats = await getStats(userId);
      return NextResponse.json({ ok: true, added: cards.length, stats, levelUp });
    }

    if (action === "cards_review_all") {
      const reviewed = await reviewAllCards(userId, noteId);
      const { levelUp } = xp > 0
        ? await recordActivity(userId, xp, label || undefined)
        : { levelUp: false };
      const stats: ProgressStats = await getStats(userId);
      return NextResponse.json({ ok: true, reviewed, stats, levelUp });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memproses progres.";
    console.error("[api/progress] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
