import { NextRequest, NextResponse } from "next/server";

import {
  acceptFriendRequest,
  declineFriendRequest,
  ensureUser,
  listIncomingRequests,
  listOutgoingRequests,
} from "@/lib/friends-store";
import { pushNotification } from "@/lib/notifications-store";
import { requireAuth } from "@/lib/assistant/auth";

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
    // Wajib login; userId dari query harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const [incoming, outgoing] = await Promise.all([
      listIncomingRequests(userId),
      listOutgoingRequests(userId),
    ]);
    return NextResponse.json({
      incoming: incoming.map((u) => ({ id: u.id, name: u.name })),
      outgoing: outgoing.map((u) => ({ id: u.id, name: u.name })),
    });
  } catch (e) {
    const msg = "Gagal memuat permintaan.";
    console.error("[api/friends/requests] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      userId?: string;
      fromId?: string;
      name?: string;
    } | null;
    const userId = String(body?.userId ?? "");
    const fromId = String(body?.fromId ?? "");
    if (!userId || !fromId) {
      return NextResponse.json(
        { error: "userId dan fromId diperlukan." },
        { status: 400 }
      );
    }
    // Wajib login; userId (akseptor) harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (body?.action === "accept") {
      const ok = await acceptFriendRequest(userId, fromId);
      if (ok) {
        const accepter = await ensureUser(userId, String(body?.name ?? ""));
        await pushNotification(fromId, {
          type: "friend_accepted",
          title: "Permintaan diterima",
          message: `${accepter.name} menerima permintaan pertemananmu`,
          link: "/dashboard/teman",
        });
      }
      return NextResponse.json({ ok });
    }
    if (body?.action === "decline") {
      const ok = await declineFriendRequest(userId, fromId);
      return NextResponse.json({ ok });
    }
    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = "Gagal memproses permintaan.";
    console.error("[api/friends/requests] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
