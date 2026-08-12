"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { ImageAlignment, ImageSize } from "@/lib/note-images-store";

interface ChapterOption {
  id: number;
  title: string;
}

export default function AddImageModal({
  noteId,
  chapters,
  onClose,
  onAdded,
}: {
  noteId: string;
  chapters: ChapterOption[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [alignment, setAlignment] = useState<ImageAlignment>("center");
  const [size, setSize] = useState<ImageSize>("medium");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Pilih gambar dulu.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("caption", caption);
      form.append("alignment", alignment);
      form.append("size", size);
      form.append("chapterId", chapterId || "");
      const res = await apiFetch(`/api/notes/${noteId}/images`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah gambar.");
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-clay m-auto w-full max-w-md max-h-[85vh] overflow-y-auto p-3 sm:!p-6 rounded-t-clay sm:rounded-clay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
            Tambah Gambar
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <button
            onClick={() => inputRef.current?.click()}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-clay-md border-3 border-dashed px-4 sm:px-5 py-6 sm:py-8 text-xs sm:text-sm font-extrabold transition-all duration-75 active:translate-y-1 min-h-[100px] ${
              file
                ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                : "border-clay-shadow/60 text-clay-muted hover:border-clay-primary"
            }`}
          >
            <ImagePlus size={26} />
            {file ? file.name : "Pilih gambar (PNG, JPG, WEBP — maks 5 MB)"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-clay-muted">
                Keterangan (caption)
              </span>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Contoh: Ilustrasi apel jatuh dari pohon"
                className="input-clay !h-12 sm:!h-11"
              />
            </label>

          {chapters.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-clay-muted">
                Letakkan setelah bab
              </span>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-4 py-3 sm:py-2.5 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
              >
                <option value="">— Bagian Ilustrasi (akhir) —</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    Bab {c.id}: {c.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-clay-muted">
                Posisi
              </span>
              <div className="flex gap-1.5">
                {(["left", "center", "right"] as ImageAlignment[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAlignment(a)}
                    className={`flex-1 rounded-clay-md border-2 py-2.5 sm:py-2 text-[11px] font-extrabold transition-all duration-75 min-h-[44px] ${
                      alignment === a
                        ? "border-clay-primary bg-clay-primary text-white"
                        : "border-clay-shadow/40 bg-white text-clay-muted"
                    }`}
                  >
                    {a === "left" ? "Kiri" : a === "center" ? "Tengah" : "Kanan"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-clay-muted">
                Ukuran
              </span>
              <div className="flex gap-1.5">
                {(["small", "medium", "large"] as ImageSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`flex-1 rounded-clay-md border-2 py-2.5 sm:py-2 text-[11px] font-extrabold transition-all duration-75 min-h-[44px] ${
                      size === s
                        ? "border-clay-primary bg-clay-primary text-white"
                        : "border-clay-shadow/40 bg-white text-clay-muted"
                    }`}
                  >
                    {s === "small" ? "Kecil" : s === "medium" ? "Sedang" : "Besar"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Mengunggah...
              </>
            ) : (
              "Simpan Gambar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
