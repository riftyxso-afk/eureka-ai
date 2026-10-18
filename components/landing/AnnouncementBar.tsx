"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";

export function AnnouncementBar() {
  const { dict } = useI18n();
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <aside
      aria-label="Pengumuman"
      className="relative w-full bg-[#7C3AED] text-white py-2 px-8 text-center text-xs sm:text-sm font-medium tracking-wide flex items-center justify-center gap-2 transition-all duration-200"
    >
      <span>{dict.nav.announcement}</span>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Tutup pengumuman"
        className="anim-press absolute right-3 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={14} />
      </button>
    </aside>
  );
}
