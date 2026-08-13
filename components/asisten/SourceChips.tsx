"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { AssistantSource } from "@/lib/assistant/types";

interface SourceChipsProps {
  sources: AssistantSource[];
}

/**
 * Chip sumber materi yang dipakai AI menjawab — klik → buka catatan terkait.
 */
export default function SourceChips({ sources }: SourceChipsProps) {
  if (!sources || sources.length === 0) return null;
  const unique = Array.from(
    new Map(sources.map((s) => [s.noteId, s])).values()
  ).slice(0, 4);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
        Sumber:
      </span>
      {unique.map((s) => (
        <Link
          key={s.noteId}
          href={`/dashboard/note/${s.noteId}${s.chapterId != null && s.chapterId > 0 ? `/bab/${s.chapterId}` : ""}`}
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-clay-full border-2 border-clay-primary/30 bg-clay-primary/10 px-3 py-1 text-[11.5px] font-extrabold text-clay-primary transition-all duration-75 hover:-translate-y-0.5 hover:shadow-[0_3px_0_#C4B5FD]"
          title={`${s.noteTitle}${s.chapterId != null && s.chapterId > 0 ? ` · Bab ${s.chapterId}` : ""}`}
        >
          <BookOpen size={12} className="shrink-0" />
          <span className="truncate">{s.noteTitle}</span>
        </Link>
      ))}
    </div>
  );
}