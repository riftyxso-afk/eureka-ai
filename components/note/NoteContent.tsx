"use client";

import { forwardRef, lazy, Suspense } from "react";
import { NotebookPen } from "lucide-react";
import {
  parseNoteContent,
  renderInlineText,
  type ParsedContent,
} from "@/lib/parseNoteContent";
import type { HighlightEntry } from "@/lib/highlights-store";
import { NoteFlow } from "@/components/note/NoteFlow";

// Dynamic import MindMap to avoid loading heavy mermaid library at build time
const MindMap = lazy(() =>
  import("@/components/note/MindMap").then((m) => ({ default: m.MindMap }))
);

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
}

function renderParsed(items: ParsedContent[], highlights: HighlightEntry[]) {
  return items.map((item, index) => {
    const hl = highlights.map((h) => ({ text: h.text, color: h.color }));
    switch (item.type) {
      case "heading1":
        return (
          <h1
            key={index}
            className="mt-6 mb-4 text-2xl font-extrabold text-clay-dark sm:text-3xl"
          >
            {renderInlineText(item.content, hl)}
          </h1>
        );
      case "heading2":
        return (
          <h2
            key={index}
            className="mt-6 mb-3 border-b-2 border-clay-shadow/20 pb-2 text-xl font-bold text-clay-dark sm:text-2xl"
          >
            {renderInlineText(item.content, hl)}
          </h2>
        );
      case "heading3":
        return (
          <h3
            key={index}
            className="mt-4 mb-2 text-lg font-bold text-clay-dark sm:text-xl"
          >
            {renderInlineText(item.content, hl)}
          </h3>
        );
      case "paragraph":
        return (
          <p
            key={index}
            className="mb-4 text-base font-medium leading-relaxed text-clay-dark"
          >
            {renderInlineText(item.content, hl)}
          </p>
        );
      case "bullet":
        return (
          <div
            key={index}
            className="mb-2 flex items-start gap-3 text-base font-medium text-clay-dark"
          >
            <span className="mt-0.5 text-lg font-extrabold leading-none text-clay-primary">
              •
            </span>
            <span>{renderInlineText(item.content, hl)}</span>
          </div>
        );
      case "quote":
        return (
          <blockquote
            key={index}
            className="mb-4 rounded-clay-md border-l-4 border-clay-primary bg-clay-beige p-4"
          >
            <p className="text-base font-medium italic text-clay-dark">
              “{renderInlineText(item.content, hl)}”
            </p>
          </blockquote>
        );
      case "image":
        return (
          <figure key={index} className="my-5">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.content.url}
                alt={item.content.alt || "Ilustrasi materi"}
                loading="lazy"
                className="max-h-[380px] w-full max-w-[560px] rounded-clay-md border-2 border-clay-shadow/20 object-cover shadow-clay-sm"
              />
            </div>
            {item.content.alt && (
              <figcaption className="mt-2 text-center text-sm font-bold italic text-clay-muted">
                {item.content.alt}
              </figcaption>
            )}
          </figure>
        );
      case "table":
        return (
          <div key={index} className="my-6 overflow-x-auto rounded-clay-md border-2 border-clay-shadow/20 shadow-clay-sm">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-clay-primary text-white">
                  {item.content.headers.map((h, i) => (
                    <th
                      key={i}
                      className="border border-clay-primary/30 px-4 py-3 text-left text-sm font-extrabold"
                    >
                      {renderInlineText(h, hl)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.content.rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-clay-beige/50" : "bg-clay-beige/30 hover:bg-clay-beige/70"}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="border border-clay-shadow/20 px-4 py-3 text-sm font-medium text-clay-dark"
                      >
                        {renderInlineText(cell, hl)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "mindmap":
        return (
          <Suspense
            key={index}
            fallback={
              <div className="my-6 flex items-center justify-center rounded-clay-md border-2 border-clay-shadow/20 bg-white p-6">
                <p className="text-sm font-bold text-clay-muted">Memuat mind map...</p>
              </div>
            }
          >
            <MindMap content={item.content} />
          </Suspense>
        );
      default:
        return null;
    }
  });
}

/** Satu bab lengkap: header bab + konten terformat. */
export const NoteContent = forwardRef<HTMLDivElement, NoteContentProps>(
  function NoteContent({ chapter, onOpenNotepad, highlights = [] }, ref) {
    const items = parseNoteContent(chapter.content);

    return (
      <div
        ref={ref}
        id={`chapter-${chapter.id}`}
        className="scroll-mt-28 rounded-clay bg-white p-5 shadow-clay-sm sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-clay-shadow/20 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-full bg-clay-primary/10 text-sm font-extrabold text-clay-primary">
              {chapter.id}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-clay-dark sm:text-xl">
                {chapter.title}
              </h2>
              {chapter.timestamp && (
                <span className="text-xs font-bold text-clay-muted">
                  🕐 {chapter.timestamp}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenNotepad(chapter)}
            className="btn-clay-ghost !min-h-[44px] !px-3 !py-1.5 text-xs"
          >
            <NotebookPen size={14} className="mr-1.5" />
            Buka catatan
          </button>
        </div>

        {items.length > 0 ? (
          <div>{renderParsed(items, highlights)}</div>
        ) : (
          <p className="text-sm font-medium text-clay-muted">
            Bab ini belum memiliki isi.
          </p>
        )}

        <NoteFlow flow={chapter.flow ?? []} />
      </div>
    );
  }
);
