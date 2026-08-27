"use client";

import Link from "next/link";
import { createElement, type CSSProperties } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { subjectAccent, subjectIconFor } from "@/lib/palette";

interface NoteItemProps {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  pinned?: boolean;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onDelete?: (id: string) => void;
}

export const NoteItem = ({
  id,
  title,
  subject,
  updatedAt,
  pinned = false,
  onTogglePin,
  onDelete,
}: NoteItemProps) => {
  // Sampul deterministik per mata pelajaran — warna khas + ikon.
  const accent = subjectAccent(subject);
  const cssVar = `var(--subject-${accent.id})`;
  const coverStyle: CSSProperties = {
    background: `linear-gradient(135deg, rgb(${cssVar} / 0.26), rgb(${cssVar} / 0.10))`,
  };
  const accentColor: CSSProperties = { color: `rgb(${cssVar})` };

  return (
    <Link href={`/dashboard/note/${id}`} className="block h-full">
      <div className="card-clay group relative flex aspect-square flex-col overflow-hidden !p-0 transition-all duration-75 hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgb(var(--clay-shadow-dark))] active:translate-y-1">
        {/* Sampul berwarna sesuai mata pelajaran */}
        <div
          className="relative flex h-[36%] shrink-0 items-center justify-between gap-2 px-4"
          style={coverStyle}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-md bg-white/70 shadow-sm"
            style={accentColor}
          >
            {createElement(subjectIconFor(subject), { size: 18 })}
          </span>
          <span
            className="min-w-0 truncate rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={accentColor}
          >
            {subject || "Catatan"}
          </span>
        </div>

        {/* Isi kartu */}
        <div className="flex min-h-0 flex-1 flex-col justify-between p-4">
          <p className="line-clamp-3 text-sm font-extrabold leading-snug text-clay-dark">
            {title}
          </p>
          <p className="text-xs font-bold text-clay-muted">{updatedAt}</p>
        </div>

        {onTogglePin && (
          <button
            type="button"
            aria-label={pinned ? "Lepas sematan catatan" : "Sematkan catatan"}
            title={pinned ? "Lepas sematan" : "Sematkan"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin(id, !pinned);
            }}
            className={`absolute right-2.5 top-[38%] mt-1.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              pinned
                ? "bg-clay-primary/15 text-clay-primary"
                : "text-clay-muted opacity-0 hover:bg-clay-beige group-hover:opacity-100"
            }`}
          >
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            aria-label="Hapus catatan"
            title="Hapus catatan"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(id);
            }}
            className="absolute bottom-3 right-2.5 flex h-8 w-8 items-center justify-center rounded-full text-clay-muted opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </Link>
  );
};
