import { NextRequest, NextResponse } from "next/server";

import { getReferralStatus } from "@/lib/referral";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/referral?userId=...
 * Mengembalikan status referral user yang terautentikasi:
 *   { code, count, goal, rewarded, link }
 */
export async function GET(req: NextRequest) {
  try {
    const rawUserId = String(
      req.nextUrl.searchParams.get("userId") ?? ""
    ).trim();
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

    // Origin link: utamakan header request (asal frontend) supaya link
    // menunjuk ke aplikasi — bukan ke backend (localhost:3001 di dev).
    const originHeader = req.headers.get("origin") ?? req.headers.get("referer");
    let origin = "";
    if (originHeader) {
      try {
        origin = new URL(originHeader).origin;
      } catch {
        origin = "";
      }
    }
    if (!origin) {
      origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.eureka-ai.web.id";
    }
    const status = await getReferralStatus(auth.userId, origin);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat status referral.";
    console.error("[api/referral] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
