import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import {
  deleteReview,
  getMyReview,
  getReviewStats,
  listReviews,
  submitReview,
} from "@/lib/reviews-store";

export const runtime = "nodejs";

/**
 * GET /api/reviews — publik (tanpa login).
 * Mengembalikan daftar ulasan terbaru + statistik agregat.
 * Bila query ?userId= diisi, sertakan juga ulasan milik user itu (myReview).
 */
export async function GET(req: NextRequest) {
  try {
    const userId = String(
      req.nextUrl.searchParams.get("userId") ?? ""
    ).trim();
    const [reviews, stats, myReview] = await Promise.all([
      listReviews(),
      getReviewStats(),
      userId ? getMyReview(userId) : Promise.resolve(null),
    ]);
    return NextResponse.json({ reviews, stats, myReview });
  } catch (e) {
    console.error("[api/reviews] GET", e);
    return NextResponse.json({ error: "Gagal memuat ulasan." }, { status: 500 });
  }
}

/**
 * POST /api/reviews — wajib login.
 * Body: { userId, authorName, rating (1–5), title?, content? }
 * Satu ulasan per user (submit ulang = perbarui).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? "").trim();
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating harus berupa angka 1 sampai 5." },
        { status: 400 }
      );
    }
    const authorName = String(body?.authorName ?? "")
      .trim()
      .slice(0, 60);
    const title = String(body?.title ?? "").trim().slice(0, 80);
    const content = String(body?.content ?? "").trim().slice(0, 1000);

    const review = await submitReview({
      userId,
      authorName: authorName || "Pengguna",
      rating,
      title,
      content,
    });
    if (!review) {
      return NextResponse.json(
        { error: "Gagal menyimpan ulasan. Coba lagi." },
        { status: 500 }
      );
    }
    const stats = await getReviewStats();
    return NextResponse.json({ ok: true, review, stats });
  } catch (e) {
    console.error("[api/reviews] POST", e);
    return NextResponse.json(
      { error: "Gagal menyimpan ulasan." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews?userId=... — wajib login, hapus ulasan sendiri.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = String(
      req.nextUrl.searchParams.get("userId") ?? ""
    ).trim();
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await deleteReview(userId);
    const stats = await getReviewStats();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    console.error("[api/reviews] DELETE", e);
    return NextResponse.json({ error: "Gagal menghapus ulasan." }, { status: 500 });
  }
}
