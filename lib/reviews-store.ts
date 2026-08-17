/**
 * Store Review Produk Eureka.AI — Supabase.
 * Tabel: reviews (lihat supabase_patch_018_reviews.sql)
 *
 * Ulasan dipakai untuk JSON-LD aggregateRating & review di halaman
 * landing & pricing (syarat "Cuplikan produk" Google). Hanya data
 * NYATA dari pengguna — tidak ada rating palsu.
 */
import { db } from "./supabase/admin";

export interface ProductReview {
  id: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string | null;
  createdAt: string;
}

export interface ReviewStats {
  count: number;
  /** Rata-rata 0–5 (null bila belum ada ulasan). */
  average: number | null;
  /** Distribusi per bintang, diurutkan 5 → 1. */
  distribution: { rating: number; count: number }[];
}

const REVIEW_COLUMNS =
  "id, user_id, author_name, rating, title, content, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReview(row: any): ProductReview {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    authorName: String(row.author_name ?? "Pengguna"),
    rating: Number(row.rating) || 0,
    title: row.title ? String(row.title) : null,
    content: row.content ? String(row.content) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

/** Ulasan terbaru (publik) — untuk tampilan & JSON-LD. */
export async function listReviews(limit = 12): Promise<ProductReview[]> {
  try {
    const { data, error } = await db()
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapReview);
  } catch (e) {
    console.error("[reviews] listReviews", e);
    return [];
  }
}

/** Statistik agregat (count, rata-rata, distribusi). */
export async function getReviewStats(): Promise<ReviewStats> {
  try {
    const { data, error } = await db().from("reviews").select("rating");
    if (error) throw error;
    const rows = (data ?? []) as { rating: number }[];
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of rows) {
      const k = Math.round(Number(r.rating));
      if (k >= 1 && k <= 5) {
        distribution[k]++;
        sum += k;
      }
    }
    const count = rows.length;
    return {
      count,
      average:
        count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      distribution: Object.entries(distribution)
        .map(([rating, c]) => ({ rating: Number(rating), count: c }))
        .sort((a, b) => b.rating - a.rating),
    };
  } catch (e) {
    console.error("[reviews] getReviewStats", e);
    return { count: 0, average: null, distribution: [] };
  }
}

/** Ulasan milik satu user (untuk mode "sudah menilai"). */
export async function getMyReview(userId: string): Promise<ProductReview | null> {
  if (!userId) return null;
  try {
    const { data, error } = await db()
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReview(data) : null;
  } catch (e) {
    console.error("[reviews] getMyReview", e);
    return null;
  }
}

/** Simpan / perbarui ulasan user (satu ulasan per user — upsert). */
export async function submitReview(input: {
  userId: string;
  authorName: string;
  rating: number;
  title?: string;
  content?: string;
}): Promise<ProductReview | null> {
  try {
    const { data, error } = await db()
      .from("reviews")
      .upsert(
        {
          user_id: input.userId,
          author_name: String(input.authorName ?? "")
            .trim()
            .slice(0, 60) || "Pengguna",
          rating: input.rating,
          title:
            String(input.title ?? "")
              .trim()
              .slice(0, 80) || null,
          content:
            String(input.content ?? "")
              .trim()
              .slice(0, 1000) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select(REVIEW_COLUMNS)
      .single();
    if (error) throw error;
    return data ? mapReview(data) : null;
  } catch (e) {
    console.error("[reviews] submitReview", e);
    return null;
  }
}

/** Hapus ulasan milik user. */
export async function deleteReview(userId: string): Promise<boolean> {
  try {
    const { error } = await db().from("reviews").delete().eq("user_id", userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("[reviews] deleteReview", e);
    return false;
  }
}
