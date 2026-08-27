"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
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
    const handleSelection = () => {
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
    
    // Handle both mouse and touch events
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, []);

  // Sembunyikan toolbar saat halaman digulir agar tidak melayang dari teks.
  useEffect(() => {
    const onScroll = () => setState(null);
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
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
    apiFetch(`/api/notes/${noteId}/highlights`, {
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
    notify?.(`Diberi stabilo ${COLORS.find((c) => c.key === color)?.label}.`);
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
      const res = await apiFetch(
        `/api/notes/${noteId}/highlights?chapterId=${state.chapterId}`
      );
      const data = await res.json();
      const match = (data.highlights ?? []).find(
        (h: { text: string }) =>
          h.text.toLowerCase() === state.text.toLowerCase()
      );
      if (match) {
        await apiFetch(`/api/notes/${noteId}/highlights?id=${match.id}`, {
          method: "DELETE",
        });
      }
    } catch {
      // abaikan
    }
    clear();
  };

  if (!state) return null;

  // Calculate position with viewport bounds check for mobile
  const toolbarHeight = 60; // Approximate toolbar height
  const padding = 8;
  const showBelow = state.y - toolbarHeight - padding < 0;
  const top = showBelow ? state.y + padding : state.y - toolbarHeight - padding;

  const calculatePosition = () => {
    const viewportWidth = window.innerWidth;
    const toolbarWidth = 280; // Approximate toolbar width

    let left = state.x;

    // Keep toolbar within horizontal bounds
    if (left - toolbarWidth / 2 < padding) {
      left = toolbarWidth / 2 + padding;
    } else if (left + toolbarWidth / 2 > viewportWidth - padding) {
      left = viewportWidth - toolbarWidth / 2 - padding;
    }

    return { left };
  };

  const { left } = calculatePosition();

  return (
    <div
      className="fixed z-[70]"
      style={{ left, top, transform: "translateX(-50%)" }}
    >
      <div className="flex flex-wrap items-center gap-1.5 rounded-clay-full border-3 border-clay-borderLight bg-clay-cream p-1.5 shadow-clay-lg sm:gap-1 sm:p-1 max-w-[calc(100vw-16px)]">
        <span className="pl-2 pr-1 text-clay-muted sm:pl-2 sm:pr-1">
          <Highlighter className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </span>
        {COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => apply(c.key)}
            title={`Stabilo ${c.label}`}
            aria-label={`Stabilo ${c.label}`}
            className="min-h-[44px] min-w-[44px] rounded-full border-2 border-clay-shadow/30 transition-transform duration-75 hover:scale-110 active:scale-95 sm:min-h-[32px] sm:min-w-[32px] touch-manipulation"
            style={{ backgroundColor: c.swatch }}
          />
        ))}
        <button
          onClick={remove}
          title="Hapus stabilo"
          aria-label="Hapus stabilo"
          className="btn-clay-ghost !min-h-[44px] !min-w-[44px] !rounded-clay-full !px-3 sm:!min-h-[32px] sm:!min-w-[32px] sm:!px-2.5 touch-manipulation"
        >
          <Eraser className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>
    </div>
  );
}
