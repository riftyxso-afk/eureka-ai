"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Star, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId, getUserName } from "@/lib/identity";
import type { ProductReview, ReviewStats } from "@/lib/reviews-store";

export interface ReviewData {
  reviews: ProductReview[];
  stats: ReviewStats;
  myReview: ProductReview | null;
}

/** Bintang 1–5 (fill sesuai nilai). */
function Stars({
  value,
  size = 16,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-[#D8D5E0]"
          }
        />
      ))}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface ReviewSectionProps {
  data: ReviewData | null;
  loggedIn: boolean;
  onRefresh: () => void;
}

/**
 * Seksi "Ulasan Pengguna" di halaman landing — bukti sosial nyata
 * (data dari /api/reviews). User login bisa memberi/mengubah ulasan.
 */
export function ReviewSection({ data, loggedIn, onRefresh }: ReviewSectionProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Isi form dari ulasan yang sudah ada (mode ubah).
  useEffect(() => {
    if (open && data?.myReview) {
      setRating(data.myReview.rating);
      setTitle(data.myReview.title ?? "");
      setContent(data.myReview.content ?? "");
    }
  }, [open, data?.myReview]);

  const close = () => {
    setOpen(false);
    setError("");
  };

  const submit = async () => {
    if (rating < 1) {
      setError("Pilih dulu rating bintangnya ya.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: getUserId(),
          authorName: getUserName(),
          rating,
          title,
          content,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Gagal menyimpan ulasan.");
      }
      close();
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan ulasan.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Hapus ulasan kamu?")) return;
    setSaving(true);
    try {
      const res = await apiFetch(
        `/api/reviews?userId=${encodeURIComponent(getUserId() ?? "")}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Gagal menghapus ulasan.");
      }
      onRefresh();
    } catch {
      setError("Gagal menghapus ulasan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const stats = data?.stats;
  const reviews = data?.reviews ?? [];
  const hasReviews = (stats?.count ?? 0) > 0;

  return (
    <div
      className="w-full pt-6"
      aria-label="Ulasan pengguna Eureka.AI"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#7C3AED] dark:text-violet-400">
            Ulasan Pengguna Nyata
          </p>
          <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1A2E] dark:text-white">
            Kata mereka yang sudah belajar di Eureka
          </h3>
        </div>

        {!data ? (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-gray-400">
            <Loader2 size={15} className="animate-spin" /> Memuat ulasan...
          </p>
        ) : hasReviews ? (
          <>
            {/* Ringkasan rating */}
            <div className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161528] p-5 shadow-sm sm:flex-row sm:justify-center">
              <p className="text-5xl font-extrabold tracking-tight text-[#1A1A2E] dark:text-white">
                {stats?.average?.toFixed(1).replace(".", ",")}
              </p>
              <div className="flex flex-col items-center gap-1 sm:items-start">
                <Stars value={stats?.average ?? 0} size={18} />
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                  {stats?.count} ulasan terverifikasi
                </p>
              </div>
            </div>

            {/* Daftar ulasan */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((r) => (
                <article
                  key={r.id}
                  className="flex flex-col rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161528] p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${avatarColor(r.authorName)}`}
                    >
                      {initials(r.authorName)}
                    </span>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-xs sm:text-sm font-bold text-[#1A1A2E] dark:text-white">
                        {r.authorName}
                      </p>
                      <Stars value={r.rating} size={12} />
                    </div>
                  </div>
                  {r.title && (
                    <h4 className="mt-3 text-sm font-bold text-[#1A1A2E] dark:text-white text-left">
                      {r.title}
                    </h4>
                  )}
                  {r.content && (
                    <p className="mt-1 flex-1 break-words text-xs sm:text-sm font-normal leading-relaxed text-gray-600 dark:text-gray-300 text-left">
                      {r.content}
                    </p>
                  )}
                  {r.createdAt && (
                    <p className="mt-3 text-[11px] font-medium text-gray-400 text-left">
                      {formatDate(r.createdAt)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-6 text-center text-xs sm:text-sm font-medium text-gray-500">
            Belum ada ulasan. Jadilah yang pertama berbagi pengalaman belajarmu dengan Eureka!
          </p>
        )}

        {/* Tombol aksi */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {loggedIn ? (
            <button
              onClick={() => setOpen(true)}
              className="h-10 px-6 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              {data?.myReview ? (
                <>
                  <Pencil size={15} /> Ubah ulasan kamu
                </>
              ) : (
                "Beri Ulasan"
              )}
            </button>
          ) : (
            <Link
              href="/register"
              className="h-10 px-6 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold flex items-center justify-center shadow-sm transition-colors"
            >
              Daftar & Beri Ulasan
            </Link>
          )}
          {loggedIn && data?.myReview && (
            <button
              onClick={remove}
              disabled={saving}
              className="h-10 px-4 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={15} /> Hapus
            </button>
          )}
        </div>
      </div>

      {/* Modal ulasan */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Beri ulasan"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white dark:bg-[#161528] p-6 shadow-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A1A2E] dark:text-white">
                {data?.myReview ? "Ubah ulasan" : "Beri ulasan"}
              </h3>
              <button
                onClick={close}
                aria-label="Tutup"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pilih bintang */}
            <div className="mt-5 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${i} bintang`}
                  className="p-1 touch-manipulation focus:outline-none"
                >
                  <Star
                    size={28}
                    className={
                      i <= (hover || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300 dark:text-gray-600"
                    }
                  />
                </button>
              ))}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Judul singkat (opsional)"
              className="mt-4 w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-[#1A1A2E] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Ceritakan pengalaman belajarmu... (opsional)"
              className="mt-3 w-full p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-[#1A1A2E] dark:text-white placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />

            {error && (
              <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="mt-5 w-full h-11 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                "Kirim Ulasan"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
