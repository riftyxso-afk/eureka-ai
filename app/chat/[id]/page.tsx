"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Clock, History, Plus, X } from "lucide-react";

import InputClay from "@/components/ui/InputClay";
import ToolCallBadge from "@/components/ui/ToolCallBadge";
import TypewriterText from "@/components/ui/TypewriterText";
import { UploadSourceModal } from "@/components/chat/UploadSourceModal";
import { useOnboarding } from "@/context/OnboardingContext";
import { getUserId } from "@/lib/identity";
import { postProgress } from "@/lib/levelUp";
import {
  clearHistory,
  deleteSession,
  getHistory,
  listSessions,
  saveHistory,
  saveSessionMeta,
  type ChatSessionMeta,
} from "@/lib/chat-store";
import type { Message, ToolCall } from "@/lib/types";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-clay-muted"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

interface MessageRowProps {
  msg: Message;
  isTypingId: string | null;
  onTypeDone: (id: string) => void;
}

function MessageRow({ msg, isTypingId, onTypeDone }: MessageRowProps) {
  const isUser = msg.role === "user";
  const isEureka = msg.content.includes("EUREKA");

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-clay-md rounded-br-[8px] bg-clay-primary px-5 py-4 text-white shadow-clay-sm">
          <p className="whitespace-pre-wrap text-base font-semibold leading-6">
            {msg.content}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <img src="/logo.png" alt="Logo Eureka.AI" className="h-9 w-9 object-contain" />
      <div className="flex max-w-[85%] flex-col gap-2">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2"
          >
            {msg.toolCalls.map((tc: ToolCall, i) => (
              <ToolCallBadge key={i} name={tc.name} status={tc.status} />
            ))}
          </motion.div>
        )}
        <div
          className={`rounded-clay-md border-l-8 px-5 py-4 shadow-clay-sm ${
            isEureka
              ? "border-clay-success bg-clay-success/10"
              : "border-clay-primary bg-white"
          }`}
        >
          {msg.content === "" ? (
            <TypingDots />
          ) : isTypingId === msg.id ? (
            <p className="whitespace-pre-wrap text-base font-semibold leading-6 text-clay-dark">
              <TypewriterText text={msg.content} onDone={() => onTypeDone(msg.id)} />
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-base font-semibold leading-6 text-clay-dark">
              {msg.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { data } = useOnboarding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingId, setTypingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [askNotes, setAskNotes] = useState(false);
  const [showSoalModal, setShowSoalModal] = useState(false);
  const [soalText, setSoalText] = useState("");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [fileMode, setFileMode] = useState<"camera" | "gallery" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Muat history percakapan sesi ini dari localStorage.
  useEffect(() => {
    setMessages(getHistory(sessionId));
    setSessions(listSessions());
    // Muat hanya saat sesi berubah; setSessions/setMessages stabil.
  }, [sessionId]);

  // Simpan history otomatis setiap pesan berubah (setelah muat awal).
  useEffect(() => {
    if (loading || messages.length === 0) return;
    saveHistory(sessionId, messages);
    const meta: ChatSessionMeta = {
      id: sessionId,
      topic:
        messages.find((m) => m.role === "user")?.content.slice(0, 40) ||
        "Percakapan belajar",
      updatedAt: Date.now(),
    };
    saveSessionMeta(meta);
    setSessions(listSessions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingId]);

  // AI langsung: Eureka membuka percakapan dengan pertanyaan pembuka
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], topic: data.weakTopic, userId: getUserId() }),
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const id = `ai-${Date.now()}`;
        setMessages([{ id, role: "assistant", content: "" }]);
        setTypingId(id);
        setTimeout(() => {
          if (!cancelled) {
            setMessages((m) =>
              m.map((x) => (x.id === id ? { ...x, content: json.reply } : x))
            );
          }
        }, 1400);
      } catch {
        // biarkan kosong
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    open();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTypeDone = (id: string) => {
    setMessages((m) =>
      m.map((x) =>
        x.id === id
          ? {
              ...x,
              toolCalls: x.toolCalls?.map((t) => ({ ...t, status: "completed" })),
            }
          : x
      )
    );
    setTypingId(null);
  };

  const newSession = () => {
    clearHistory(sessionId);
    setMessages([]);
    setInput("");
    setShowHistory(false);
  };

  const sendSoal = () => {
    const text = soalText.trim();
    if (!text) return;
    setShowSoalModal(false);
    setSoalText("");
    // Tempel soal sebagai pesan user biasa (tanpa menunggu OCR).
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `[Soal/Tugas dari guru] Tolong bantu jawab soal ini dengan jelas dan lengkap:\n\n${text}`,
    };
    setMessages((m) => [...m, userMsg]);
    void postProgress({
      action: "activity",
      userId: getUserId(),
      xp: 2,
      label: "Mengirim soal ke Eureka",
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || typingId || loading) return;
    setMessages((m) => [
      ...m,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");

    const history: { role: "user" | "assistant"; content: string }[] =
      messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }))
        .filter(
          (m): m is { role: "user" | "assistant"; content: string } =>
            m.role === "user" || m.role === "assistant"
        );
    history.push({ role: "user", content: text });

    const id = `ai-${Date.now()}`;
    setMessages((m) => [...m, { id, role: "assistant", content: "" }]);
    setTypingId(id);

    void postProgress({
      action: "activity",
      userId: getUserId(),
      xp: 2,
      label: "Belajar dengan Eureka",
    });

    const applyReply = (reply: string) => {
      setMessages((m) =>
        m.map((x) => (x.id === id ? { ...x, content: reply } : x))
      );
    };

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          userId: getUserId(),
          askNotes,
        }),
      });
      const json = await res.json();
      const reply =
        json.reply ??
        json.error ??
        "Hmm, AI-nya belum menjawab. Coba tanya lagi ya 🙏";
      setTimeout(() => applyReply(reply), 1200);
    } catch {
      setTimeout(
        () => applyReply("Koneksi terputus. Coba kirim pesanmu lagi ya 🙏"),
        400
      );
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedName(file.name);
    setFileMode(null);
    e.target.value = "";
  };

  const openFilePicker = (kind: "camera" | "gallery") => {
    setFileMode(kind);
    setIsUploadOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 60);
  };

  const handleYouTubeLink = (link: string) => {
    setUploadedName(`▶️ ${link}`);
    setIsUploadOpen(false);
  };

  const handleManual = () => {
    setIsUploadOpen(false);
    setTimeout(() => document.getElementById("chat-input")?.focus(), 100);
  };

  return (
    <div className="flex h-screen flex-col supports-[height:100dvh]:h-dvh">
      <header className="flex items-center justify-between gap-3 border-b-2 border-clay-shadow/30 bg-clay-beige/80 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg font-extrabold shadow-clay-sm transition-all duration-75 active:translate-y-1"
            aria-label="Kembali ke dashboard"
          >
            ←
          </Link>
          <img src="/logo.png" alt="Logo Eureka.AI" className="h-11 w-11 object-contain" />
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">Eureka.AI</p>
            <p className="truncate text-xs font-bold text-clay-muted">
              {data.learningHabit === "coba_sendiri"
                ? "Mode: Kamu pegang kendali 🔥"
                : "Tutor Socratic sabar — nggak ada yang salah ❤️"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Riwayat percakapan"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-clay-sm transition-all duration-75 active:translate-y-1 ${
              showHistory
                ? "bg-clay-primary text-white"
                : "bg-white text-clay-muted"
            }`}
          >
            <History size={18} />
          </button>
          <span className="hidden rounded-full bg-clay-inputBg px-3 py-1.5 text-xs font-extrabold text-clay-muted shadow-clay-inset sm:block sm:px-4">
            {sessionId === "demo" ? "Mode demo" : "Tutor AI · langsung"}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-clay flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.length === 0 && !loading && (
            <div className="card-clay mx-auto mt-4 flex w-full max-w-md flex-col items-center py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                <BookOpen size={28} className="text-clay-muted" />
              </div>
              <h2 className="mt-4 text-lg font-extrabold">
                Mulai belajar bersama Eureka
              </h2>
              <p className="mt-1.5 max-w-xs text-sm font-semibold text-clay-muted">
                Ketik topik, tempel soal dari guru, atau nyalakan{" "}
                <b>Tanya Catatanmu</b> untuk bertanya dari catatan yang sudah
                kamu buat.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              isTypingId={typingId}
              onTypeDone={handleTypeDone}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t-2 border-clay-shadow/30 bg-clay-beige/80 px-4 pb-4 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-clay">
          {uploadedName && (
            <div className="mb-3 flex items-center gap-2 rounded-clay-md bg-clay-inputBg px-4 py-2.5 shadow-clay-inset">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-clay-dark">
                📷 {uploadedName}
              </span>
              <button
                onClick={() => setUploadedName(null)}
                aria-label="Batalkan unggahan"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-clay-muted hover:bg-white/70"
              >
                ✕
              </button>
            </div>
          )}

          {/* Toggle Tanya Catatanmu */}
          <button
            onClick={() => setAskNotes((v) => !v)}
            aria-pressed={askNotes}
            className={`mb-3 flex w-full items-center gap-2 rounded-clay-full border-2 px-4 py-2 text-left transition-all duration-75 sm:w-auto ${
              askNotes
                ? "border-clay-primary bg-clay-primary/10 shadow-clay-sm"
                : "border-clay-shadow/40 bg-clay-inputBg shadow-clay-inset"
            }`}
          >
            <BookOpen
              size={14}
              className={askNotes ? "text-clay-primary" : "text-clay-muted"}
            />
            <span className="text-xs font-extrabold text-clay-dark">
              Tanya Catatanmu
            </span>
            <span
              className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-extrabold sm:ml-1 ${
                askNotes
                  ? "border-clay-primary bg-clay-primary text-white"
                  : "border-clay-shadow/50 text-transparent"
              }`}
            >
              ✓
            </span>
          </button>

          <div className="flex items-end gap-3">
            <button
              onClick={() => setShowSoalModal(true)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-clay-sm transition-all duration-75 active:translate-y-1"
              aria-label="Tempel soal"
              title="Tempel soal dari guru"
            >
              📝
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture={fileMode === "camera" ? "environment" : undefined}
              className="hidden"
              onChange={onFileSelected}
            />
            <InputClay
              id="chat-input"
              placeholder="Ketik topik atau jawabanmu..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || Boolean(typingId) || loading}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-clay-primary text-xl text-white shadow-clay-btn transition-all duration-75 active:translate-y-1 disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Kirim"
            >
              ↑
            </button>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {messages.some((m) => m.content.includes("EUREKA")) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center px-4"
          >
            <div className="rounded-clay-full border-3 border-clay-borderLight bg-clay-success px-8 py-4 text-xl font-extrabold text-white shadow-clay-btn">
              EUREKA! 🎉
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UploadSourceModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onCamera={() => openFilePicker("camera")}
        onGallery={() => openFilePicker("gallery")}
        onYouTubeLink={handleYouTubeLink}
        onManual={handleManual}
      />

      {/* Panel riwayat sesi */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="fixed right-4 top-16 z-30 flex max-h-[70dvh] w-[280px] max-w-[calc(100vw-2rem)] flex-col gap-1 overflow-y-auto rounded-clay border-3 border-clay-borderLight bg-white p-3 shadow-clay-lg"
          >
            <div className="flex items-center justify-between border-b-2 border-clay-shadow/30 pb-2">
              <p className="text-sm font-extrabold text-clay-dark">Riwayat</p>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Tutup riwayat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-clay-muted hover:bg-clay-beige"
              >
                <X size={15} />
              </button>
            </div>
            <button
              onClick={newSession}
              className="mt-2 flex items-center gap-2 rounded-clay-md px-3 py-2.5 text-left text-xs font-extrabold text-clay-primary transition-colors hover:bg-clay-beige"
            >
              <Plus size={14} /> Percakapan baru
            </button>
            {sessions.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs font-semibold text-clay-muted">
                Belum ada riwayat percakapan.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-clay-md px-3 py-2.5 transition-colors hover:bg-clay-beige ${
                    s.id === sessionId ? "bg-clay-primary/10" : ""
                  }`}
                >
                  <button
                    onClick={() => {
                      window.location.href = `/chat/${s.id}`;
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-extrabold text-clay-dark">
                      {s.topic}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-clay-muted">
                      <Clock size={9} />
                      {new Date(s.updatedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      deleteSession(s.id);
                      setSessions(listSessions());
                    }}
                    aria-label="Hapus sesi"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-clay-muted hover:bg-red-100 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal tempel soal */}
      <AnimatePresence>
        {showSoalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSoalModal(false)}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="card-clay m-auto w-full max-w-lg !p-5 sm:!p-6"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold">Tempel Soal 📝</h3>
                  <p className="mt-1 text-xs font-semibold text-clay-muted">
                    Paste soal dari guru/dosen — Eureka akan membantumu
                    menjawabnya langkah demi langkah.
                  </p>
                </div>
                <button
                  onClick={() => setShowSoalModal(false)}
                  aria-label="Tutup"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
                >
                  <X size={16} />
                </button>
              </div>
              <textarea
                value={soalText}
                onChange={(e) => setSoalText(e.target.value)}
                placeholder="Tempel soal lengkap di sini..."
                rows={8}
                autoFocus
                className="mt-4 w-full resize-y rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-4 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[140px]"
              />
              <button
                onClick={sendSoal}
                disabled={soalText.trim().length < 5}
                className="btn-clay-primary mt-4 w-full !min-h-[46px] !px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kirim Soal ke Eureka
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
