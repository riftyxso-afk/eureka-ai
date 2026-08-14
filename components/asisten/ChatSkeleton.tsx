"use client";

/**
 * Skeleton loading chat — placeholder bubble user & AI dengan shimmer
 * CSS (reuse @keyframes shimmer di globals.css). Meniru ukuran bubble
 * asli (MessageBubble) agar tidak ada lonjakan layout saat diganti
 * konten. Reduced motion → animasi mati (motion-reduce:animate-none).
 */
export default function ChatSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat percakapan"
      data-testid="chat-skeleton"
      className="mx-auto w-full max-w-3xl space-y-4"
    >
      {/* Bubble user (kanan, kecil — meniru balasan singkat) */}
      <div className="flex justify-end">
        <div className="relative h-10 w-28 overflow-hidden rounded-clay-md rounded-br-[8px] bg-clay-primary/70">
          <span className="skeleton-shimmer motion-reduce:animate-none" />
        </div>
      </div>

      {/* Bubble AI 1 (kiri, multi-baris) */}
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="mt-1 h-8 w-8 shrink-0 object-contain"
        />
        <div className="min-w-0 max-w-[85%] rounded-clay-md rounded-tl-[8px] border-2 border-clay-borderLight bg-white px-4 py-3 shadow-clay-sm">
          <div className="space-y-2">
            <div className="relative h-3.5 w-4/5 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
            <div className="relative h-3.5 w-3/5 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Bubble AI 2 (kiri) */}
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="mt-1 h-8 w-8 shrink-0 object-contain"
        />
        <div className="min-w-0 max-w-[85%] rounded-clay-md rounded-tl-[8px] border-2 border-clay-borderLight bg-white px-4 py-3 shadow-clay-sm">
          <div className="space-y-2">
            <div className="relative h-3.5 w-2/3 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
            <div className="relative h-3.5 w-11/12 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
            <div className="relative h-3.5 w-7/12 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
            <div className="relative h-3.5 w-1/2 overflow-hidden rounded-full bg-clay-beige">
              <span className="skeleton-shimmer motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}