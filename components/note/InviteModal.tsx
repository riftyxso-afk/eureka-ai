"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Link2, PenTool, Plus, Trash2, X } from "lucide-react";

export interface Collaborator {
  id: string;
  name: string;
  role: "editor" | "viewer";
  invitedAt: string;
  status: "pending" | "accepted";
}

const AVATAR_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function InviteModal({
  noteId,
  notify,
  onClose,
}: {
  noteId: string;
  notify: (msg: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/collab`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators ?? []);
        setInviteLink(data.inviteLink ?? "");
      }
    } catch {
      // abaikan
    }
  }, [noteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInvite = async () => {
    if (!name.trim()) {
      notify("Nama teman tidak boleh kosong! ⚠️");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/collab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", name: name.trim(), role }),
      });
      if (res.ok) {
        const data = await res.json();
        setName("");
        setInviteLink(data.inviteLink);
        notify(
          `${name.trim()} diundang sebagai ${role === "editor" ? "Editor" : "Viewer"} ✅`
        );
        await refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.error ?? "Gagal mengundang ⚠️");
      }
    } catch {
      notify("Gagal mengundang ⚠️");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    try {
      const full = `${window.location.origin}${inviteLink}`;
      await navigator.clipboard.writeText(full);
      notify("Link undangan disalin! 🔗");
    } catch {
      notify("Gagal menyalin link.");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/notes/${noteId}/collab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", collaboratorId: id }),
      });
      await refresh();
    } catch {
      notify("Gagal menghapus kolaborator ⚠️");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card-clay max-h-[85vh] w-full max-w-md overflow-y-auto p-3 sm:!p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
            Undang Teman
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form undang */}
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-clay-muted">
              Nama teman
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Budi Santoso"
              className="input-clay w-full min-h-[44px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-clay-muted">
              Peran
            </label>
            <div className="flex gap-2">
              {(
                [
                  { key: "editor", label: "Editor ✏️" },
                  { key: "viewer", label: "Viewer 👀" },
                ] as const
              ).map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={`btn-clay-ghost flex-1 !min-h-[44px] !px-3 text-sm ${
                    role === r.key
                      ? "!border-clay-primary !bg-clay-primary !text-white !shadow-clay-sm"
                      : ""
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleInvite}
            disabled={sending}
            className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
          >
            <Plus size={18} className="mr-2" />
            {sending ? "Mengundang..." : "Kirim Undangan"}
          </button>
        </div>

        {/* Link undangan */}
        {inviteLink && (
          <div className="mt-4 rounded-2xl border-2 border-clay-shadow/40 bg-clay-beige p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-clay-muted">
              <Link2 size={14} />
              Link undangan (bagikan ke temanmu)
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-xs font-bold text-clay-dark">
                {inviteLink}
              </code>
              <button
                onClick={handleCopy}
                className="btn-clay-ghost shrink-0 !min-h-[44px] !px-3"
                aria-label="Salin link"
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Papan tulis kolaboratif */}
        <div className="mt-4 rounded-2xl border-2 border-clay-shadow/40 bg-clay-beige p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-clay-muted">
            <PenTool size={14} />
            Papan tulis kolaboratif (realtime)
          </div>
          <Link
            href={`/dashboard/note/${noteId}/papan`}
            className="btn-clay-primary flex w-full items-center justify-center !min-h-[42px] text-sm"
          >
            <PenTool size={16} className="mr-2" />
            Buka Papan Tulis
          </Link>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/dashboard/note/${noteId}/papan`
                );
                notify("Link papan tulis disalin! 🔗");
              } catch {
                notify("Gagal menyalin link.");
              }
            }}
            className="btn-clay-ghost mt-2 flex w-full items-center justify-center !min-h-[36px] text-xs"
          >
            <Copy size={14} className="mr-1.5" />
            Salin link papan tulis
          </button>
        </div>

        {/* Daftar kolaborator */}
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-extrabold text-clay-dark">
            Kolaborator ({collaborators.length})
          </h3>
          {collaborators.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 sm:p-4 text-center text-xs sm:text-sm font-semibold text-clay-muted">
              Belum ada kolaborator. Undang temanmu untuk belajar bareng!
            </p>
          ) : (
            <ul className="space-y-2 sm:space-y-2.5">
              {collaborators.map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-clay-shadow/40 bg-white/60 p-3 sm:p-3.5"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                  >
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-clay-dark">
                      {c.name}
                    </div>
                    <div className="text-xs font-semibold text-clay-muted">
                      {c.role === "editor" ? "Editor" : "Viewer"} ·{" "}
                      {c.status === "accepted" ? (
                        <span className="text-green-600">diterima</span>
                      ) : (
                        <span className="text-amber-600">menunggu</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(c.id)}
                    aria-label={`Hapus ${c.name}`}
                    className="btn-clay-ghost !min-h-[44px] !px-2.5"
                  >
                    <Trash2 size={15} className="text-clay-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
