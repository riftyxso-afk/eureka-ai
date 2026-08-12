"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import {
  renderInlineText,
  type ParsedContent as ParsedContentItem,
} from "@/lib/parseNoteContent";
import type { HighlightEntry } from "@/lib/highlights-store";

// Dynamic import MindMap to avoid loading heavy mermaid library at build time
const MindMap = lazy(() =>
  import("@/components/note/MindMap").then((m) => ({ default: m.MindMap }))
);

interface ParsedContentProps {
  items: ParsedContentItem[];
  highlights?: HighlightEntry[];
}

/**
 * Tabel markdown dari AI: scroll horizontal saat kolom melebihi layar
 * (min-w agar kolom tidak remuk), plus indikator "geser" di layar sempit.
 */
function TableBlock({
  headers,
  rows,
  highlights,
}: {
  headers: string[];
  rows: string[][];
  highlights: HighlightEntry[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 2);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="my-6">
      <div
        ref={wrapRef}
        className="overflow-x-auto rounded-clay-md border-2 border-clay-shadow/20 shadow-clay-sm"
      >
        <table className="w-full min-w-[min(100%,420px)] border-collapse bg-white">
          <thead>
            <tr className="bg-clay-primary text-white">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="border border-clay-primary/30 px-4 py-3 text-left text-sm font-extrabold"
                >
                  {renderInlineText(h, highlights)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={
                  i % 2 === 0
                    ? "bg-white hover:bg-clay-beige/50"
                    : "bg-clay-beige/30 hover:bg-clay-beige/70"
                }
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="border border-clay-shadow/20 px-4 py-3 text-sm font-medium text-clay-dark"
                  >
                    {renderInlineText(cell, highlights)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canScroll && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-clay-muted">
          <MoveHorizontal size={12} />
          Geser tabel ke samping untuk melihat semua kolom
        </div>
      )}
    </div>
  );
}

/** Render konten terstruktur hasil parseNoteContent (heading, tabel, kutipan, dll). */
export function ParsedContent({ items, highlights = [] }: ParsedContentProps) {
  return (
    <>
      {items.map((item, index) => {
        switch (item.type) {
          case "heading1":
            return (
              <h1
                key={index}
                className="mt-6 mb-4 text-2xl font-extrabold text-clay-dark sm:text-3xl"
              >
                {renderInlineText(item.content, highlights)}
              </h1>
            );
          case "heading2":
            return (
              <h2
                key={index}
                className="mt-6 mb-3 border-b-2 border-clay-shadow/20 pb-2 text-xl font-bold text-clay-dark sm:text-2xl"
              >
                {renderInlineText(item.content, highlights)}
              </h2>
            );
          case "heading3":
            return (
              <h3
                key={index}
                className="mt-4 mb-2 text-lg font-bold text-clay-dark sm:text-xl"
              >
                {renderInlineText(item.content, highlights)}
              </h3>
            );
          case "paragraph":
            return (
              <p
                key={index}
                className="mb-4 text-base font-medium leading-relaxed text-clay-dark"
              >
                {renderInlineText(item.content, highlights)}
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
                <span>{renderInlineText(item.content, highlights)}</span>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="mb-4 rounded-clay-md border-l-4 border-clay-primary bg-clay-beige p-4"
              >
                <p className="text-base font-medium italic text-clay-dark">
                  “{renderInlineText(item.content, highlights)}”
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
                    className="max-h-[380px] w-full max-w-[560px] rounded-clay-md border-2 border-clay-shadow/20 object-contain shadow-clay-sm"
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
              <TableBlock
                key={index}
                headers={item.content.headers}
                rows={item.content.rows}
                highlights={highlights}
              />
            );
          case "mindmap":
            return (
              <Suspense
                key={index}
                fallback={
                  <div className="my-6 flex items-center justify-center rounded-clay-md border-2 border-clay-shadow/20 bg-white p-6">
                    <p className="text-sm font-bold text-clay-muted">
                      Memuat mind map...
                    </p>
                  </div>
                }
              >
                <MindMap content={item.content} />
              </Suspense>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
