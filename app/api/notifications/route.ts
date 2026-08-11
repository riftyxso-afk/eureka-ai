import { NextRequest, NextResponse } from "next/server";

import {
  countUnread,
  listNotifications,
  markNotificationsRead,
  pushNotification,
  type NotificationType,
} from "@/lib/notifications-store";

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
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(userId),
      countUnread(userId),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat notifikasi.";
    console.error("[api/notifications] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      userId?: string;
      ids?: string[];
      type?: NotificationType;
      title?: string;
      message?: string;
      link?: string;
    } | null;
    const userId = String(body?.userId ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    const action = String(body?.action ?? "");

    if (action === "mark_read") {
      const changed = await markNotificationsRead(
        userId,
        Array.isArray(body?.ids) ? body.ids : undefined
      );
      const unreadCount = await countUnread(userId);
      return NextResponse.json({ ok: true, changed, unreadCount });
    }

    if (action === "push") {
      const type = body?.type ?? "achievement";
      const title = String(body?.title ?? "").trim();
      const message = String(body?.message ?? "").trim();
      if (!title || !message) {
        return NextResponse.json(
          { error: "title dan message diperlukan." },
          { status: 400 }
        );
      }
      await pushNotification(userId, {
        type,
        title,
        message,
        link: body?.link ? String(body.link) : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memproses notifikasi.";
    console.error("[api/notifications] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
