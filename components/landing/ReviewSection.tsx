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
    <section
      id="ulasan"
      className="border-t-2 border-[#E5E5E5] py-16 sm:py-24"
      aria-label="Ulasan pengguna Eureka.AI"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
            Ulasan Pengguna
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] text-[#13102B]">
            Kata mereka yang sudah belajar di Eureka
          </h2>
        </div>

        {!data ? (
          <p className="mt-10 flex items-center justify-center gap-2 text-sm font-bold text-[#B9B6C7]">
            <Loader2 size={15} className="animate-spin" /> Memuat ulasan...
          </p>
        ) : hasReviews ? (
          <>
            {/* Ringkasan rating */}
            <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-3xl border-2 border-[#E5E5E5] bg-white p-6 shadow-clay-sm sm:flex-row sm:justify-center">
              <p className="text-6xl font-extrabold tracking-tight text-[#13102B]">
                {stats?.average?.toFixed(1).replace(".", ",")}
              </p>
              <div className="flex flex-col items-center gap-1 sm:items-start">
                <Stars value={stats?.average ?? 0} size={20} />
                <p className="text-sm font-bold text-[#5A5670]">
                  {stats?.count} ulasan dari pengguna
                </p>
              </div>
            </div>

            {/* Daftar ulasan */}
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((r) => (
                <article
                  key={r.id}
                  className="flex flex-col rounded-3xl border-2 border-[#E5E5E5] bg-white p-5 shadow-clay-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${avatarColor(r.authorName)}`}
                    >
                      {initials(r.authorName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#13102B]">
                        {r.authorName}
                      </p>
                      <Stars value={r.rating} size={13} />
                    </div>
                  </div>
                  {r.title && (
                    <h3 className="mt-3 text-base font-extrabold text-[#13102B]">
                      {r.title}
                    </h3>
                  )}
                  {r.content && (
                    <p className="mt-1.5 flex-1 break-words text-sm font-medium leading-relaxed text-[#5A5670]">
                      {r.content}
                    </p>
                  )}
                  {r.createdAt && (
                    <p className="mt-3 text-xs font-bold text-[#B9B6C7]">
                      {formatDate(r.createdAt)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mx-auto mt-10 max-w-md rounded-3xl border-2 border-dashed border-[#E5E5E5] p-8 text-center text-sm font-semibold text-[#5A5670]">
            Belum ada ulasan. Jadilah yang pertama berbagi pengalaman
            belajarmu dengan Eureka!
          </p>
        )}

        {/* Tombol aksi */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {loggedIn ? (
            <button
              onClick={() => setOpen(true)}
              className="k-btn-primary text-sm"
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
            <Link href="/register" className="k-btn-primary text-sm">
              Daftar & Beri Ulasan
            </Link>
          )}
          {loggedIn && data?.myReview && (
            <button
              onClick={remove}
              disabled={saving}
              className="k-btn-secondary text-sm !text-red-500"
            >
              <Trash2 size={15} /> Hapus
            </button>
          )}
        </div>
      </div>

      {/* Modal ulasan */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Beri ulasan"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-clay sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-[#13102B]">
                {data?.myReview ? "Ubah ulasan" : "Beri ulasan"}
              </h3>
              <button
                onClick={close}
                aria-label="Tutup"
                className="btn-clay-ghost !min-h-[44px] !min-w-[44px] !rounded-full !px-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pilih bintang */}
            <div className="mt-5 flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${i} bintang`}
                  className="!min-h-[44px] !min-w-[44px] touch-manipulation"
                >
                  <Star
                    size={30}
                    className={
                      i <= (hover || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-[#D8D5E0]"
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
              className="input-clay mt-4 w-full"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Ceritakan pengalaman belajarmu... (opsional)"
              className="input-clay mt-3 w-full resize-none"
            />

            {error && (
              <p className="mt-3 text-sm font-bold text-red-500">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="k-btn-primary mt-5 w-full text-sm"
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
    </section>
  );
}
