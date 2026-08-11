"use client";

import { useEffect, useState } from "react";
import { Eraser, Highlighter } from "lucide-react";
import { getUserId } from "@/lib/identity";
import type { HighlightColor } from "@/lib/highlights-store";

const COLORS: { key: HighlightColor; label: string; swatch: string }[] = [
  { key: "yellow", label: "Kuning", swatch: "#FDE047" },
  { key: "pink", label: "Pink", swatch: "#F472B6" },
  { key: "blue", label: "Biru", swatch: "#93C5FD" },
];

interface ToolbarState {
  x: number;
  y: number;
  chapterId: number;
  text: string;
}

/** Toolbar mengambang saat teks diseleksi di dalam bab catatan. */
export default function HighlightToolbar({
  noteId,
  notify,
  onSaved,
}: {
  noteId: string;
  notify?: (msg: string) => void;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<ToolbarState | null>(null);

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!sel || sel.isCollapsed || !text) {
        setState(null);
        return;
      }
      const anchor = sel.anchorNode as Node;
      const el =
        anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
      const chapterEl = el?.closest?.('[id^="chapter-"]') as HTMLElement | null;
      if (!chapterEl) {
        setState(null);
        return;
      }
      const chapterId = Number(chapterEl.id.replace("chapter-", ""));
      if (!Number.isFinite(chapterId)) {
        setState(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setState({ x: rect.left + rect.width / 2, y: rect.top, chapterId, text });
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  const clear = () => {
    window.getSelection()?.removeAllRanges();
    setState(null);
  };

  const apply = (color: HighlightColor) => {
    if (!state) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        span.className = `hl-${color}`;
        span.dataset.hl = "1";
        span.appendChild(range.extractContents());
        range.insertNode(span);
      } catch {
        // abaikan (seleksi melintasi elemen kompleks)
      }
    }
    fetch(`/api/notes/${noteId}/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: state.chapterId,
        text: state.text,
        color,
        userId: getUserId(),
      }),
    })
      .then((res) => (res.ok ? onSaved?.() : undefined))
      .catch(() => {});
    notify?.(`Diberi stabilo ${COLORS.find((c) => c.key === color)?.label}. ✨`);
    clear();
  };

  const remove = async () => {
    if (!state) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const anchor = sel.anchorNode as Node;
      const el =
        anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
      const span = el?.closest?.(".hl-yellow, .hl-pink, .hl-blue") as HTMLElement | null;
      if (span && span.parentElement) {
        span.replaceWith(...Array.from(span.childNodes));
      }
    }
    try {
      const res = await fetch(
        `/api/notes/${noteId}/highlights?chapterId=${state.chapterId}`
      );
      const data = await res.json();
      const match = (data.highlights ?? []).find(
        (h: { text: string }) =>
          h.text.toLowerCase() === state.text.toLowerCase()
      );
      if (match) {
        await fetch(`/api/notes/${noteId}/highlights?id=${match.id}`, {
          method: "DELETE",
        });
      }
    } catch {
      // abaikan
    }
    clear();
  };

  if (!state) return null;

  return (
    <div
      className="fixed z-[70] -translate-x-1/2 -translate-y-[calc(100%+8px)]"
      style={{ left: state.x, top: state.y }}
    >
      <div className="flex items-center gap-1 rounded-clay-full border-3 border-clay-borderLight bg-white p-1 shadow-clay-lg">
        <span className="pl-2 pr-1 text-clay-muted">
          <Highlighter size={14} />
        </span>
        {COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => apply(c.key)}
            title={`Stabilo ${c.label}`}
            aria-label={`Stabilo ${c.label}`}
            className="h-8 w-8 rounded-full border-2 border-clay-shadow/30 transition-transform duration-75 hover:scale-110 active:scale-95"
            style={{ backgroundColor: c.swatch }}
          />
        ))}
        <button
          onClick={remove}
          title="Hapus stabilo"
          aria-label="Hapus stabilo"
          className="btn-clay-ghost !min-h-[32px] !min-w-[32px] !rounded-clay-full !px-2.5"
        >
          <Eraser size={14} />
        </button>
      </div>
    </div>
  );
}
