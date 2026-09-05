import { NextRequest, NextResponse } from "next/server";

import { isSafetyAdmin } from "@/lib/safety/safety-config";
import { getSafetyEvents, getSafetyMetrics } from "@/lib/safety/safety-log";

/**
 * GET /api/safety/metrics?userId=… — metrik + event keamanan.
 * Hanya untuk admin (SAFETY_ADMIN_USER_IDS). Tanpa itu → 403.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!isSafetyAdmin(userId)) {
    return NextResponse.json({ ok: false, error: "Akses ditolak." }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    metrics: getSafetyMetrics(),
    events: getSafetyEvents(50),
  });
}
