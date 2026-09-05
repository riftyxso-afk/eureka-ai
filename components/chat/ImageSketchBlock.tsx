"use client";

/**
 * Blok gambar INLINE di alur chat — pengganti modal "Eureka Draw" lama.
 *
 * Loading: dot-matrix sketsa bergelombang diagonal (clay → amber) dengan
 * satu label statis "Eureka lagi gambar…". Saat selesai, gambar hasil
 * crossfade di POSISI YANG SAMA (kontinuitas visual, bukan dua komponen).
 * Error ditangani inline di blok yang sama.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

interface ImageSketchBlockProps {
  /** Permintaan gambar user (mis. "buat gambar siklus air"). */
  prompt: string;
  /** Konteks percakapan — agar gambar sesuai topik yang sedang dibahas. */
  history?: { role: string; content: string }[];
  onClose: () => void;
}

type Phase = "drawing" | "done" | "error";

/** Grid titik — 12×8, gelombang diagonal dari kiri-atas ke kanan-bawah. */
const DOT_COLS = 12;
const DOT_ROWS = 8;
const DOT_STAGGER_MS = 90;

export function ImageSketchBlock({
  prompt,
  history = [],
  onClose,
}: ImageSketchBlockProps) {
  const [phase, setPhase] = useState<Phase>("drawing");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setError("Login dulu untuk membuat gambar ya.");
      setPhase("error");
      return;
    }
    setPhase("drawing");
    setError(null);
    try {
      const res = await apiFetch("/api/assistant/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId, history }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        dataUrl?: string;
        alt?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data?.dataUrl) {
        throw new Error(data?.error || "Gagal membuat gambar. Coba lagi.");
      }
      setDataUrl(data.dataUrl);
      setAlt(data.alt || "Ilustrasi");
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setPhase("error");
    }
  }, [prompt, history]);

  // Auto-mulai sekali saat blok masuk stream (animasi tidak jalan
  // sebelum generate benar-benar dimulai).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void generate();
  }, [generate]);

  return (
    <div className="w-full max-w-[220px] rounded-clay-md border-2 border-clay-borderLight bg-clay-cream p-2.5 shadow-clay-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-extrabold text-clay-muted">
          {phase === "drawing"
            ? "Eureka lagi gambar…"
            : phase === "done"
              ? "Gambarmu jadi ✨"
              : "Gambar gagal dibuat"}
        </p>
        {phase !== "drawing" && (
          <button
            onClick={onClose}
            aria-label="Tutup gambar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset transition-colors hover:text-clay-dark"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Kanvas — loading & hasil di posisi yang sama (crossfade). */}
      <div className="relative aspect-square w-full overflow-hidden rounded-clay-md bg-clay-beige shadow-clay-inset">
        {phase === "drawing" && (
          <div
            className="grid h-full w-full p-5"
            style={{
              gridTemplateColumns: `repeat(${DOT_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${DOT_ROWS}, 1fr)`,
            }}
            aria-hidden
          >
            {Array.from({ length: DOT_COLS * DOT_ROWS }).map((_, i) => {
              const row = Math.floor(i / DOT_COLS);
              const col = i % DOT_COLS;
              return (
                <span
                  key={i}
                  className="eureka-sketch-dot m-auto block h-2.5 w-2.5 rounded-full"
                  style={{ animationDelay: `${(row + col) * DOT_STAGGER_MS}ms` }}
                />
              );
            })}
          </div>
        )}

        {phase === "done" && dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={alt}
            className="eureka-sketch-reveal absolute inset-0 h-full w-full object-cover"
          />
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm font-bold leading-relaxed text-clay-muted">
              {error}
            </p>
            <button
              onClick={() => void generate()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-full bg-clay-secondary px-4 py-2 text-[13px] font-extrabold text-white shadow-clay-btn transition-all duration-75 active:translate-y-1"
            >
              <RefreshCw size={14} /> Coba lagi
            </button>
          </div>
        )}
      </div>

      {phase === "done" && (
        <div className="mt-3 flex gap-2">
          <a
            href={dataUrl ?? "#"}
            download={`eureka-${Date.now()}.png`}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-clay-md bg-clay-secondary px-4 py-2 text-[13px] font-extrabold text-white shadow-clay-btn transition-all duration-75 active:translate-y-1"
          >
            <Download size={15} /> Unduh
          </a>
          <button
            onClick={() => void generate()}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-clay-md border-2 border-clay-borderLight bg-clay-cream px-4 py-2 text-[13px] font-extrabold text-clay-dark shadow-clay-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw size={15} /> Buat Ulang
          </button>
        </div>
      )}
    </div>
  );
}
