"use client";

import { List } from "lucide-react";

export interface TOCChapter {
  id: number;
  title: string;
}

interface NoteTOCProps {
  chapters: TOCChapter[];
  activeChapterId: number;
  onChapterClick: (id: number) => void;
}

/** Daftar isi: sidebar sticky di desktop, chip scroll horizontal di mobile. */
export const NoteTOC = ({
  chapters,
  activeChapterId,
  onChapterClick,
}: NoteTOCProps) => {
  if (chapters.length === 0) return null;

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="sticky top-24 hidden h-[calc(100vh-120px)] w-[280px] shrink-0 overflow-y-auto rounded-clay bg-white p-4 shadow-clay-sm lg:block">
        <div className="mb-4 flex items-center gap-2">
          <List size={16} className="text-clay-primary" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
            Daftar Isi
          </h3>
        </div>
        <nav className="space-y-1">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`w-full rounded-clay-md py-2 pl-3 pr-2 text-left text-sm font-bold transition-all duration-75 ${
                activeChapterId === chapter.id
                  ? "border-l-4 border-clay-primary bg-clay-primary/10 text-clay-primary"
                  : "border-l-4 border-transparent text-clay-dark hover:bg-clay-beige"
              }`}
            >
              <span className="mr-2 text-xs font-extrabold text-clay-muted">
                {chapter.id}.
              </span>
              <span className="break-words">{chapter.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Chip bar (mobile) */}
      <div className="flex flex-wrap gap-2 pb-2 lg:hidden">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => onChapterClick(chapter.id)}
            className={`max-w-full break-words rounded-clay-full px-4 py-2 text-xs font-extrabold transition-all duration-75 ${
              activeChapterId === chapter.id
                ? "bg-clay-primary text-white shadow-clay-sm"
                : "bg-white text-clay-dark shadow-clay-sm hover:bg-clay-beige"
            }`}
          >
            {chapter.id}. {chapter.title}
          </button>
        ))}
      </div>
    </>
  );
};
