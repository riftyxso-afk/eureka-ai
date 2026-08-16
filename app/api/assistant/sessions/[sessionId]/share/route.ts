import { NextRequest, NextResponse } from "next/server";

import {
  createShare,
  getMessages,
  getSession,
} from "@/lib/assistant/store";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";

/**
 * Buat share publik (snapshot) dari sesi chat milik user.
 * Hanya pemilik sesi yang bisa — diverifikasi via token + kepemilikan sesi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
    if (!rawUserId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    const auth = await authorizeAssistantUser(
      req.headers.get("authorization"),
      rawUserId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }
    const session = await getSession(sessionId, auth.userId);
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak ditemukan." },
        { status: 404 }
      );
    }
    const messages = await getMessages(sessionId, auth.userId);
    const share = await createShare(
      sessionId,
      auth.userId,
      session.title,
      messages
    );
    // Link publik harus mengarah ke FRONTEND, bukan origin request (yang di
    // backend Hono = domain API). Pakai NEXT_PUBLIC_SITE_URL + fallback.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.eureka-ai.web.id";
    const url = `${siteUrl.replace(/\/+$/, "")}/share/${share.token}`;
    return NextResponse.json({ token: share.token, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat link share.";
    console.error("[api/assistant/sessions/[sessionId]/share] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
