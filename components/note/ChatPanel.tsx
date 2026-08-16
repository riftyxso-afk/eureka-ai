"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { CornerUpLeft, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { getUserId, getUserName } from "@/lib/identity";
import { postProgress } from "@/lib/levelUp";

interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  parentId?: string;
  createdAt: string;
  isAI?: boolean;
  mentions?: string[];
}

interface FriendSuggestion {
  id: string;
  name: string;
}

const AVATAR_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

const POLL_MS = 4000;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function colorIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % AVATAR_COLORS.length;
}

/** Pecah teks jadi segmen; segmen @mention ditandai. */
function splitWithMentions(text: string): { part: string; isMention: boolean }[] {
  const parts = text.split(/(@[^\s@]+(?:\s+[^\s@]+)?)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ part: p, isMention: p.startsWith("@") }));
}

export default function ChatPanel({
  noteId,
  userName,
}: {
  noteId: string;
  userName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState<FriendSuggestion[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [newMentions, setNewMentions] = useState(0);
  const lastTs = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialLoad = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mountedAt = useRef(Date.now());

  // Muat daftar teman untuk saran @mention
  useEffect(() => {
    const userId = getUserId();
    const userName = getUserName();
    apiFetch(`/api/friends?userId=${userId}&name=${encodeURIComponent(userName)}`)
      .then((r) => r.json())
      .then((data) => {
        setFriends(
          (data.users ?? []).filter(
            (u: FriendSuggestion & { relation: string }) =>
              u.relation === "friend"
          )
        );
      })
      .catch(() => {});
  }, []);

  const mentionCandidates = useMemo(() => {
    const q = (mentionQuery ?? "").trim().toLowerCase();
    const pool = [
      ...friends.map((f) => f.name),
      ...Array.from(new Set(messages.map((m) => m.senderName))),
    ];
    return Array.from(new Set(pool))
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 6);
  }, [friends, messages, mentionQuery]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const loadMessages = async (initial: boolean) => {
    try {
      const q = initial
        ? ""
        : `?after=${encodeURIComponent(lastTs.current)}`;
      const res = await apiFetch(`/api/notes/${noteId}/chat${q}`);
      if (!res.ok) return;
      const data = await res.json();
      const newMessages: ChatMessage[] = data.messages ?? [];
      if (newMessages.length === 0) return;
      lastTs.current = Math.max(
        ...newMessages.map((m) => Date.parse(m.createdAt)),
        lastTs.current
      );
      if (!initial) {
        const userName = getUserName();
        const mentionedCount = newMessages.filter(
          (m) =>
            m.mentions?.includes(userName) &&
            m.senderName !== userName &&
            Date.parse(m.createdAt) > mountedAt.current
        ).length;
        if (mentionedCount > 0) {
          setNewMentions((n) => n + mentionedCount);
        }
      }
      setMessages((prev) => {
        const merged = initial ? newMessages : [...prev, ...newMessages];
        const seen = new Set<string>();
        return merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
      });
      if (initial || initialLoad.current) scrollToBottom();
      initialLoad.current = false;
    } catch {
      // abaikan
    }
  };

  useEffect(() => {
    loadMessages(true);
    const timer = setInterval(() => loadMessages(false), POLL_MS);
    return () => clearInterval(timer);
  }, [noteId]);

  const handleInputChange = (value: string) => {
    setInput(value);
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const prefix = value.slice(0, cursor);
    const atIdx = prefix.lastIndexOf("@");
    if (atIdx >= 0 && cursor === value.length) {
      setMentionQuery(prefix.slice(atIdx + 1));
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (name: string) => {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const prefix = input.slice(0, cursor);
    const atIdx = prefix.lastIndexOf("@");
    const base = atIdx >= 0 ? input.slice(0, atIdx) : input;
    const suffix = atIdx >= 0 ? input.slice(cursor) : "";
    setInput(`${base}@${name} ${suffix}`);
    setMentionQuery(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/notes/${noteId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: userName,
          content,
          parentId: replyTo?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        lastTs.current = Math.max(
          lastTs.current,
          Date.parse(data.message.createdAt)
        );
        setMessages((prev) => [...prev, data.message]);
        setInput("");
        setReplyTo(null);
        scrollToBottom();
        notifyMentions(content);
        trackActivity();
      }
    } catch {
      // abaikan
    } finally {
      setSending(false);
    }
  };

  /** Kirim notifikasi ke teman yang disebut via @Nama. */
  const notifyMentions = (content: string) => {
    for (const friend of friends) {
      const pattern = new RegExp(`@${friend.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      if (!pattern.test(content)) continue;
      apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push",
          userId: friend.id,
          type: "mention",
          title: "Kamu disebut dalam diskusi",
          message: `${userName} menyebutmu di catatan: "${content.slice(0, 60)}"`,
          link: `/dashboard/note/${noteId}`,
        }),
      }).catch(() => {});
    }
  };

  /** Catat aktivitas chat (+2 XP) ke progres. */
  const trackActivity = () => {
    const userId = getUserId();
    void postProgress({
      action: "activity",
      userId,
      xp: 2,
      label: "Diskusi di catatan",
    });
  };

  return (
    <div className="card-clay !p-3 sm:!p-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle size={18} className="text-clay-primary shrink-0" />
        <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
          Diskusi{" "}
          <span className="text-xs sm:text-sm font-bold text-clay-muted">
            ({messages.length})
          </span>
        </h2>
        {newMentions > 0 && (
          <span className="ml-auto rounded-full bg-clay-primary px-2 sm:px-2.5 py-0.5 text-xs font-extrabold text-white shadow-clay-sm shrink-0">
            @ Kamu {newMentions}
          </span>
        )}
      </div>

      {/* Daftar pesan */}
      <div
        ref={listRef}
        className="max-h-[280px] sm:max-h-[320px] space-y-2.5 sm:space-y-3 overflow-y-auto pr-1 -mr-1"
      >
        {messages.length === 0 ? (
          <p className="rounded-xl sm:rounded-2xl border-2 border-dashed border-clay-shadow/40 p-4 sm:p-5 text-center text-xs sm:text-sm font-semibold text-clay-muted">
            Belum ada diskusi. Mulai chat untuk belajar bareng!
          </p>
        ) : (
          messages.map((m) => {
            const parent = messages.find((p) => p.id === m.parentId);
            const mine = m.senderName === userName;
            return (
              <div
                key={m.id}
                className={`flex gap-2 sm:gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-[11px] font-extrabold ${AVATAR_COLORS[colorIndex(m.senderName)]}`}
                >
                  {initials(m.senderName)}
                </span>
                <div className={`max-w-[80%] sm:max-w-[75%] min-w-0 ${mine ? "text-right" : ""}`}>
                  {m.isAI && (
                    <span className="mb-0.5 inline-block rounded-full bg-violet-100 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-violet-700">
                      <Sparkles size={13} className="mr-1 text-clay-primary" />
                      AI
                    </span>
                  )}
                  <div className="mb-0.5 flex items-baseline gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-clay-muted">
                    <span className="truncate">{mine ? "Kamu" : m.senderName}</span>
                    <span className="shrink-0">{formatTime(m.createdAt)}</span>
                  </div>
                  {parent && (
                    <div className="mb-1 rounded-lg sm:rounded-xl border-l-4 border-clay-primary/40 bg-white/70 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-clay-muted">
                      <span className="font-extrabold">{parent.senderName}:</span>{" "}
                      {parent.content.slice(0, 40)}
                      {parent.content.length > 40 ? "..." : ""}
                    </div>
                  )}
                  <div
                    className={`inline-block rounded-xl sm:rounded-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-left text-[13px] sm:text-sm font-medium leading-relaxed break-words ${
                      mine
                        ? "rounded-tr-sm bg-clay-primary text-white"
                        : "rounded-tl-sm bg-clay-beige text-clay-dark"
                    }`}
                  >
                    {splitWithMentions(m.content).map((seg, i) =>
                      seg.isMention ? (
                        <span
                          key={i}
                          className={
                            mine
                              ? "rounded-md bg-white/20 px-1 font-extrabold text-white"
                              : "rounded-md bg-clay-primary/15 px-1 font-extrabold text-clay-primary"
                          }
                        >
                          {seg.part}
                        </span>
                      ) : (
                        <span key={i}>{seg.part}</span>
                      )
                    )}
                  </div>
                  <div className="mt-0.5">
                    <button
                      onClick={() => setReplyTo(m)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-clay-muted hover:text-clay-primary active:text-clay-primary min-h-[44px] sm:min-h-0 -my-2 sm:my-0 py-2 sm:py-0"
                      aria-label={`Balas pesan dari ${m.senderName}`}
                    >
                      <CornerUpLeft size={11} />
                      Balas
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply bar */}
      {replyTo && (
        <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-clay-shadow/40 bg-white/70 px-2.5 sm:px-3 py-2">
          <span className="truncate text-[11px] sm:text-xs font-semibold text-clay-muted min-w-0 pr-2">
            Membalas <b>{replyTo.senderName}</b>: {replyTo.content.slice(0, 30)}
            {replyTo.content.length > 30 ? "..." : ""}
          </span>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="Batal balas"
            className="btn-clay-ghost !min-h-[44px] !min-w-[44px] !px-2 shrink-0 flex items-center justify-center"
          >
            <X size={14} className="sm:w-[13px] sm:h-[13px]" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="relative mt-3">
        {mentionQuery !== null && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-xl sm:rounded-2xl border-2 border-clay-shadow/40 bg-white p-1.5 sm:p-2 shadow-clay max-h-48 overflow-y-auto">
            {mentionCandidates.map((name) => (
              <button
                key={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(name);
                }}
                className="flex w-full items-center gap-2 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-2.5 sm:py-2 text-left text-sm font-bold text-clay-dark transition-all duration-75 hover:bg-clay-beige active:bg-clay-beige min-h-[44px] sm:min-h-0"
              >
                <span
                  className={`flex h-6 w-6 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${AVATAR_COLORS[colorIndex(name)]}`}
                >
                  {initials(name)}
                </span>
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (mentionQuery !== null && e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onBlur={() => {
              setMentionQuery(null);
            }}
            placeholder="Tulis pesan... (ketik @ untuk menyebut teman)"
            className="input-clay min-w-0 flex-1 !min-h-[44px] text-sm sm:text-base"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            aria-label="Kirim pesan"
            className="btn-clay-primary !min-h-[44px] !min-w-[44px] !px-3 sm:!px-4 disabled:opacity-60 shrink-0 flex items-center justify-center"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
