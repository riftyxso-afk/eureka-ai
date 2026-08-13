"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import type { AssistantChatSession } from "@/lib/assistant/types";

interface ChatSidebarProps {
  sessions: AssistantChatSession[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Sidebar riwayat sesi chat asisten (versi clay). */
export default function ChatSidebar({
  sessions,
  activeId,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingId(null);
  }, [pathname]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const commitRename = async (id: string) => {
    const title = editValue.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await onRename(id, title);
    } catch {
      // gagal rename — biarkan UI tetap
    }
  };

  return (
    <div className="sticky top-0 hidden max-h-[calc(100vh-2rem)] w-[260px] shrink-0 flex-col gap-2 self-start rounded-clay border-2 border-clay-borderLight bg-white p-3 shadow-clay-sm lg:flex">
      {/* Header + tombol chat baru */}
      <div className="flex items-center justify-between gap-2 border-b-[3px] border-clay-borderLight pb-2.5">
        <span className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-primary/15">
            <Bot size={18} className="text-clay-primary" />
          </span>
          Riwayat Chat
        </span>
        <button
          onClick={onNew}
          className="btn-clay-primary !min-h-[40px] !px-3 !py-2 text-xs"
          aria-label="Chat baru"
          data-testid="asisten-new-chat"
        >
          <Plus size={16} /> <span className="hidden xl:inline">Baru</span>
        </button>
      </div>

      {/* Daftar sesi */}
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {sessions.length === 0 && (
          <p className="px-2 py-6 text-center text-xs font-bold text-clay-muted">
            Belum ada percakapan.
            <br />
            Mulai dengan mengetik pertanyaanmu!
          </p>
        )}

        {sessions.map((s) => {
          const active = s.id === activeId;
          if (editingId === s.id) {
            return (
              <div key={s.id} className="flex items-center gap-1 rounded-clay-md bg-clay-beige p-1.5 shadow-clay-inset">
                <input
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm font-bold text-clay-dark outline-none"
                  maxLength={120}
                />
                <button
                  className="rounded-full bg-clay-primary px-2.5 py-1 text-xs font-extrabold text-white"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitRename(s.id);
                  }}
                >
                  OK
                </button>
              </div>
            );
          }

          return (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-clay-md pr-1.5 transition-all duration-75 ${
                active
                  ? "bg-clay-primary/15 shadow-[inset_4px_0_0_#8B5CF6]"
                  : "hover:bg-clay-beige"
              }`}
            >
              <Link
                href={`/chat/${s.id}`}
                onClick={() => onSelect(s.id)}
                className="min-w-0 flex-1 truncate py-2 pl-3 text-[13.5px] font-extrabold text-clay-dark"
                data-testid={`asisten-session-${s.id}`}
              >
                {s.title || "Percakapan baru"}
              </Link>
              <button
                onClick={() => {
                  setEditingId(s.id);
                  setEditValue(s.title);
                }}
                className="shrink-0 rounded-full p-1.5 text-clay-muted opacity-0 transition-opacity hover:bg-white hover:text-clay-primary group-hover:opacity-100"
                aria-label="Ubah judul"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm("Hapus percakapan ini?")) return;
                  await onDelete(s.id);
                }}
                className="shrink-0 rounded-full p-1.5 text-clay-muted opacity-0 transition-opacity hover:bg-white hover:text-red-500 group-hover:opacity-100"
                aria-label="Hapus"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </nav>

      {/* Tombol buka dashboard (selalu ada) — jadi target tutorial juga */}
      <Link
        href="/dashboard"
        data-tutorial-id="dashboard-nav"
        className="border-t-[3px] border-clay-borderLight pt-2 text-center text-xs font-extrabold text-clay-muted hover:text-clay-primary"
      >
        ← Kembali ke Dashboard
      </Link>
    </div>
  );
}

export function MobileSessionButton({
  sessions,
  onSelect,
}: {
  sessions: AssistantChatSession[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-clay-md bg-white text-clay-primary shadow-clay-sm"
        aria-label="Riwayat chat"
      >
        <MessageSquarePlus size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="absolute left-0 top-12 z-40 max-h-[50vh] w-64 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-clay-md border-2 border-clay-borderLight bg-white p-2 shadow-clay-lg"
            >
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id);
                    setOpen(false);
                  }}
                  className="block w-full truncate rounded-clay-md px-3 py-2.5 text-left text-[13.5px] font-extrabold text-clay-dark hover:bg-clay-beige"
                >
                  {s.title || "Percakapan baru"}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}