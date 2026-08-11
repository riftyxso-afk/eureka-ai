import { NextRequest, NextResponse } from "next/server";

import {
  ensureUser,
  searchUsers,
  sendFriendRequest,
  type FriendRelation,
} from "@/lib/friends-store";
import { pushNotification } from "@/lib/notifications-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    const name = String(req.nextUrl.searchParams.get("name") ?? "").slice(0, 60);
    const q = String(req.nextUrl.searchParams.get("q") ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    await ensureUser(userId, name);
    const results = await searchUsers(userId, q);
    return NextResponse.json({
      users: results.map(({ user, relation }) => ({
        id: user.id,
        name: user.name,
        relation,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mencari pengguna.";
    console.error("[api/friends] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      userId?: string;
      name?: string;
      targetName?: string;
    } | null;
    const userId = String(body?.userId ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }

    if (body?.action === "register") {
      await ensureUser(userId, String(body?.name ?? ""));
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "add") {
      const targetName = String(body?.targetName ?? "").trim();
      if (!targetName) {
        return NextResponse.json(
          { error: "Nama teman tidak boleh kosong." },
          { status: 400 }
        );
      }
      const fromUser = await ensureUser(userId, String(body?.name ?? ""));
      const result = await sendFriendRequest(userId, targetName);
      const relation: FriendRelation = result.relation;
      if (result.ok && relation === "outgoing" && result.target) {
        await pushNotification(result.target.id, {
          type: "friend_request",
          title: "Permintaan pertemanan",
          message: `${fromUser.name} ingin berteman denganmu`,
          link: "/dashboard/teman",
        });
      }
      return NextResponse.json({
        ok: result.ok,
        relation,
        target: result.target
          ? { id: result.target.id, name: result.target.name }
          : null,
      });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memproses teman.";
    console.error("[api/friends] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
