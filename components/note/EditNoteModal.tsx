"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Pencil, X } from "lucide-react";

export default function EditNoteModal({
  noteId,
  userName,
  initialTitle,
  initialSummary,
  notify,
  onClose,
  onSaved,
}: {
  noteId: string;
  userName: string;
  initialTitle: string;
  initialSummary: string;
  notify: (msg: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      notify("Judul tidak boleh kosong! âš ï¸");
      return;
    }
    setSaving(true);
    try {
      // Simpan versi lama (sebelum edit) agar bisa direstore
      await apiFetch(`/api/notes/${noteId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: initialTitle,
          summary: initialSummary,
          changedBy: userName,
        }),
      });

      // Update catatan + simpan versi baru
      const [patchRes, versionRes] = await Promise.all([
        apiFetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), summary: summary.trim() }),
        }),
        apiFetch(`/api/notes/${noteId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            summary: summary.trim(),
            changedBy: userName,
          }),
        }),
      ]);

      if (patchRes.ok && versionRes.ok) {
        notify("Catatan berhasil diperbarui âœ…");
        onSaved();
        onClose();
      } else {
        notify("Gagal menyimpan perubahan âš ï¸");
      }
    } catch {
      notify("Gagal menyimpan perubahan âš ï¸");
    } finally {
      setSaving(false);
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
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-clay-primary" />
            <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">Ubah Catatan</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-clay-muted">
              Judul
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-clay w-full min-h-[44px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-clay-muted">
              Ringkasan
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              className="input-clay w-full resize-y"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
