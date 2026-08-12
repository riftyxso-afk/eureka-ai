/**
 * POST /api/notifications/push-subscribe
 * Simpan push subscription browser user (dikirim dari lib/push.ts) agar
 * backend bisa mengirim Web Push saat job background selesai.
 *
 * Body: { userId: string, subscription: PushSubscriptionJSON }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  savePushSubscription,
  type PushSubscriptionRecord,
} from "@/lib/push-store";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
      subscription?: PushSubscriptionRecord;
    } | null;

    const userId = (body?.userId ?? "").trim().slice(0, 80);
    const sub = body?.subscription;
    if (!userId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json(
        { error: "Data subscription tidak valid." },
        { status: 400 }
      );
    }

    savePushSubscription(userId, {
      endpoint: sub.endpoint,
      expirationTime: sub.expirationTime ?? null,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/notifications/push-subscribe] Gagal:", e);
    return NextResponse.json(
      { error: "Gagal menyimpan subscription." },
      { status: 500 }
    );
  }
}
