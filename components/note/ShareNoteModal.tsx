"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  Users,
  X,
} from "lucide-react";

interface ShareNoteModalProps {
  noteId: string;
  notify: (msg: string) => void;
  onClose: () => void;
  /** Buka modal kolaborasi per-akun (InviteModal). */
  onOpenCollaborators: () => void;
}

/** Modal share catatan — link publik read-only + kolaborasi. */
export default function ShareNoteModal({
  noteId,
  notify,
  onClose,
  onOpenCollaborators,
}: ShareNoteModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const createLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/notes/${noteId}/share`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        notify(data?.error ?? "Gagal membuat link share.");
        return;
      }
      setUrl(data.url ?? null);
    } catch {
      notify("Gagal membuat link share. Coba lagi ya.");
    } finally {
      setLoading(false);
    }
  }, [noteId, notify]);

  useEffect(() => {
    void createLink();
  }, [createLink]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("Tidak bisa menyalin — salin manual dari kotak link.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="card-clay w-full max-w-md rounded-clay p-5 shadow-clay-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-clay-dark">
            <Link2 size={18} className="text-clay-primary" />
            Bagikan Catatan
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-clay-md border-2 border-clay-primary/30 bg-clay-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-clay-primary">
            <Lock size={13} />
            Link publik — hanya baca
          </p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-clay-muted">
            Siapa pun dengan link ini bisa membaca catatanmu tanpa login. Mereka
            tidak bisa mengedit atau menghapus — kamu tetap punya akses penuh.
          </p>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex min-h-[44px] items-center gap-2 rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 text-sm font-bold text-clay-muted">
              <Loader2 size={16} className="animate-spin text-clay-primary" />
              Membuat link...
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                readOnly
                value={url ?? ""}
                onFocus={(e) => e.target.select()}
                placeholder="Link belum tersedia"
                className="min-w-0 flex-1 rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={copy}
                disabled={!url}
                className="btn-clay-primary shrink-0 !min-h-[44px] !px-4 text-sm"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Tersalin!" : "Salin"}
              </button>
            </div>
          )}
        </div>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-clay-primary underline underline-offset-2 hover:text-clay-dark"
          >
            <ExternalLink size={13} />
            Buka halaman share (pratinjau)
          </a>
        )}

        <div className="mt-5 border-t-2 border-clay-shadow/20 pt-4">
          <button
            type="button"
            onClick={onOpenCollaborators}
            className="flex w-full items-center justify-center gap-2 rounded-clay-md border-2 border-clay-shadow/40 bg-white px-4 py-2.5 text-sm font-extrabold text-clay-dark transition-colors hover:border-clay-primary hover:text-clay-primary"
          >
            <Users size={16} />
            Kelola kolaborator (edit bersama)
          </button>
        </div>
      </div>
    </div>
  );
}
