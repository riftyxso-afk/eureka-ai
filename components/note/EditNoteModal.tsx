"use client";

import { useState } from "react";
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
      notify("Judul tidak boleh kosong! ⚠️");
      return;
    }
    setSaving(true);
    try {
      // Simpan versi lama (sebelum edit) agar bisa direstore
      await fetch(`/api/notes/${noteId}/versions`, {
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
        fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), summary: summary.trim() }),
        }),
        fetch(`/api/notes/${noteId}/versions`, {
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
        notify("Catatan berhasil diperbarui ✅");
        onSaved();
        onClose();
      } else {
        notify("Gagal menyimpan perubahan ⚠️");
      }
    } catch {
      notify("Gagal menyimpan perubahan ⚠️");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card-clay max-h-[85vh] w-full max-w-md overflow-y-auto !p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-clay-primary" />
            <h2 className="text-lg font-extrabold text-clay-dark">Ubah Catatan</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[36px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-clay-muted">
              Judul
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-clay w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-clay-muted">
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
            className="btn-clay-primary w-full !min-h-[46px] disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
