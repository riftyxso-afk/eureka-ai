import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/assistant/auth";
import { getMessages, getSession } from "@/lib/assistant/store";
import { readStudyFile } from "@/lib/study-files";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const input = z.object({ sessionId: z.string().uuid(), fileId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Permintaan file tidak valid." }, { status: 400 });
  ensureRateLimitPrune();
  if (!checkRateLimit("study-files:" + auth.userId, 100, 15 * 60000).ok) return NextResponse.json({ error: "Terlalu banyak unduhan. Coba lagi sebentar." }, { status: 429 });
  const { sessionId, fileId } = input.data;
  try {
    if (!await getSession(sessionId, auth.userId)) return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
    const messages = await getMessages(sessionId, auth.userId);
    const file = messages.flatMap(message => message.study?.files || []).find(file => file.id === fileId);
    if (!file) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    const blob = await readStudyFile(auth.userId, sessionId, fileId);
    return new Response(await blob.arrayBuffer(), { headers: {
      "Content-Type": file.mime, "Content-Length": String(blob.size), "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox",
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
    } });
  } catch { return NextResponse.json({ error: "File belum bisa diunduh. Coba lagi." }, { status: 503 }); }
}
