import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    String((e as { code?: unknown }).code) === "23505"
  );
}

/**
 * Survey performa Eureka — sekali per user (satu baris per user di DB).
 *
 * GET  → { answered, earliestNoteCreatedAt } untuk jadwal klien:
 *        - answered = sudah ada baris note_feedback (submit ATAU dismiss)
 *        - earliestNoteCreatedAt = created_at catatan PERTAMA user
 *          (dasar perhitungan jeda 1 menit; null bila belum pernah buat)
 * POST → simpan jawaban; rating 1-5 WAJIB saat submit; dismiss menyimpan
 *        baris (rating NULL, dismissed=true). Submit kedua ditolak 409.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    const auth = await authorizeAssistantUser(
      req.headers.get("authorization"),
      userId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }

    const client = db();
    const [{ data: feedback }, { data: firstNote }] = await Promise.all([
      client
        .from("note_feedback")
        .select("id")
        .eq("user_id", auth.userId)
        .maybeSingle(),
      client
        .from("notes")
        .select("created_at")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      answered: Boolean(feedback),
      earliestNoteCreatedAt: firstNote?.created_at
        ? String(firstNote.created_at)
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat status survey.";
    console.error("[api/feedback/note] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
      rating?: number;
      suggestion?: string;
      dismissed?: boolean;
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

    const dismissed = body?.dismissed === true;
    if (!dismissed) {
      const rating = Number(body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Pilih rating 1-5 dulu ya!" },
          { status: 400 }
        );
      }
    }
    const suggestion = String(body?.suggestion ?? "")
      .trim()
      .slice(0, 2000);

    const { error } = await db().from("note_feedback").insert({
      user_id: auth.userId,
      rating: dismissed ? null : Number(body?.rating),
      suggestion: suggestion || null,
      dismissed,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: "Survey sudah pernah diisi. Terima kasih! 💚" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Gagal menyimpan jawaban survey.";
    console.error("[api/feedback/note] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}