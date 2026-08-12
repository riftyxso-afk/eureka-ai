"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  CheckCheck,
  FileText,
  Trophy,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { getUserId } from "@/lib/identity";
import type { NotificationType } from "@/lib/notifications-store";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 5000;

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  mention: AtSign,
  achievement: Trophy,
  note_ready: FileText,
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (d.toDateString() === new Date().toDateString()) {
    return `Hari ini, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`;
}

export const NotificationBell = () => {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const userId = getUserId();
      const res = await apiFetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // biarkan
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    try {
      const userId = getUserId();
      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", userId }),
      });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // biarkan
    }
  };

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) markAllRead();
  };

  const handleItemClick = (n: NotificationItem) => {
    if (n.link) router.push(n.link);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={handleOpen}
        aria-label="Notifikasi"
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
      >
        <Bell size={20} className="text-clay-dark" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-extrabold text-white shadow-clay-btn">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-3 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-clay border-3 border-clay-borderLight bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[320px] sm:max-h-none sm:max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between border-b-2 border-clay-shadow/30 px-4 py-3">
            <p className="text-sm font-extrabold text-clay-dark">
              Notifikasi {unread > 0 && `· ${unread} baru`}
            </p>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-clay-primary disabled:opacity-50"
            >
              <CheckCheck size={13} />
              Tandai dibaca
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[340px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <Bell size={24} className="text-clay-muted" />
                <p className="mt-3 text-sm font-bold text-clay-muted">
                  Belum ada notifikasi
                </p>
                <p className="mt-1 text-xs font-semibold text-clay-muted/80">
                  Permintaan teman, sebutan @, dan pencapaianmu muncul di sini
                </p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Trophy;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="flex w-full items-start gap-3 border-b border-clay-shadow/20 px-4 py-3 text-left transition-all duration-75 hover:bg-clay-beige"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                      <Icon size={15} className="text-clay-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`flex items-center gap-2 text-xs font-extrabold ${
                          n.read ? "text-clay-dark/70" : "text-clay-dark"
                        }`}
                      >
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                        <span className="truncate">{n.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-clay-muted">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold text-clay-muted/70">
                        {formatRelative(n.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
