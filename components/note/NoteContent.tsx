"use client";

import { forwardRef } from "react";
import { ChevronDown, ChevronRight, Clock, NotebookPen } from "lucide-react";
import {
  parseNoteContent,
  type ParsedContent as ParsedContentItem,
} from "@/lib/parseNoteContent";
import type { HighlightEntry } from "@/lib/highlights-store";
import { NoteFlow } from "@/components/note/NoteFlow";
import { ParsedContent } from "@/components/note/ParsedContent";

interface Chapter {
  id: number;
  title: string;
  content: string;
  timestamp?: string;
  flow?: string[];
}

interface NoteContentProps {
  chapter: Chapter;
  onOpenNotepad: (chapter: Chapter) => void;
  highlights?: HighlightEntry[];
  /** Saat true, isi bab disembunyikan dan hanya pratinjau singkat yang tampil. */
  collapsed?: boolean;
  /** Dipanggil saat header/pratinjau diklik untuk memperluas/meringkas bab. */
  onToggle?: () => void;
}

/** Ambil beberapa baris pertama konten untuk pratinjau bab yang terlipat. */
function previewText(items: ParsedContentItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (parts.length >= 3) break;
    if (
      item.type === "paragraph" ||
      item.type === "bullet" ||
      item.type === "heading1" ||
      item.type === "heading2" ||
      item.type === "heading3"
    ) {
      parts.push(item.content);
    }
  }
  return parts.join(" ").trim() || "Klik untuk membuka bab ini.";
}

/** Satu bab lengkap: header bab + konten terformat (bisa terlipat). */
export const NoteContent = forwardRef<HTMLDivElement, NoteContentProps>(
  function NoteContent(
    { chapter, onOpenNotepad, highlights = [], collapsed = false, onToggle },
    ref
  ) {
    const items = parseNoteContent(chapter.content);
    const toggleable = typeof onToggle === "function";

    return (
      <div
        ref={ref}
        id={`chapter-${chapter.id}`}
        className="scroll-mt-28 rounded-clay bg-white p-5 shadow-clay-sm sm:p-6"
      >
        <div className="mb-4 border-b-2 border-clay-shadow/20 pb-4">
          {/* Mobile: judul paling atas (nomor bab di samping kiri), lalu tombol aksi di bawahnya. */}
          {/* Desktop: tetap sejajar dalam satu baris. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Buka bab ${chapter.id}` : `Ciutkan bab ${chapter.id}`}
              className="group flex w-full items-start gap-3 text-left sm:w-auto sm:flex-1"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-full bg-clay-primary/10 text-sm font-extrabold text-clay-primary">
                {chapter.id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-extrabold leading-snug text-clay-dark sm:text-xl">
                  {chapter.title}
                </span>
                {chapter.timestamp && (
                  <span className="mt-0.5 block text-xs font-bold text-clay-muted">
                    <Clock size={13} className="mr-1 inline text-clay-muted" />
                    {chapter.timestamp}
                  </span>
                )}
              </span>
              {toggleable && (
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-full bg-clay-beige text-clay-muted transition-colors group-hover:bg-clay-primary/15 group-hover:text-clay-primary">
                  {collapsed ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </span>
              )}
            </button>
            <div className="flex sm:shrink-0">
              <button
                onClick={() => onOpenNotepad(chapter)}
                className="btn-clay-ghost !min-h-[44px] !px-3 !py-1.5 text-xs"
              >
                <NotebookPen size={14} className="mr-1.5" />
                Buka catatan
              </button>
            </div>
          </div>
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="block w-full rounded-clay-md text-left transition-colors hover:bg-clay-beige/40"
          >
            <p className="line-clamp-3 text-sm font-medium leading-relaxed text-clay-muted">
              {previewText(items)}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-clay-primary">
              Klik untuk membuka bab ini
              <ChevronDown size={14} />
            </span>
          </button>
        ) : items.length > 0 ? (
          <div>
            <ParsedContent items={items} highlights={highlights} />
            <NoteFlow flow={chapter.flow ?? []} />
          </div>
        ) : (
          <p className="text-sm font-medium text-clay-muted">
            Bab ini belum memiliki isi.
          </p>
        )}
      </div>
    );
  }
);
