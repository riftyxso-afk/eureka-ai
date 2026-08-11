"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import AvatarClay from "@/components/ui/AvatarClay";
import InputClay from "@/components/ui/InputClay";
import ToolCallBadge from "@/components/ui/ToolCallBadge";
import TypewriterText from "@/components/ui/TypewriterText";
import { UploadSourceModal } from "@/components/chat/UploadSourceModal";
import { useOnboarding } from "@/context/OnboardingContext";
import { getUserId } from "@/lib/identity";
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
      <AvatarClay name="Eureka" size={36} />
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
  const { data } = useOnboarding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingId, setTypingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [fileMode, setFileMode] = useState<"camera" | "gallery" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingId]);

  // AI langsung: Eureka membuka percakapan dengan pertanyaan pembuka
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], topic: data.weakTopic }),
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

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activity",
        userId: getUserId(),
        xp: 2,
        label: "Belajar dengan Eureka",
      }),
    }).catch(() => {});

    const applyReply = (reply: string) => {
      setMessages((m) =>
        m.map((x) => (x.id === id ? { ...x, content: reply } : x))
      );
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const json = await res.json();
      const reply =
        json.reply ?? "Hmm, AI-nya belum menjawab. Coba tanya lagi ya 🙏";
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-clay-shadow/30 bg-clay-beige/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg font-extrabold shadow-clay-sm transition-all duration-75 active:translate-y-1"
            aria-label="Kembali ke dashboard"
          >
            ←
          </Link>
          <AvatarClay name="Eureka" size={44} />
          <div>
            <p className="text-lg font-extrabold leading-tight">Eureka.AI</p>
            <p className="text-xs font-bold text-clay-muted">
              {data.learningHabit === "coba_sendiri"
                ? "Mode: Kamu pegang kendali 🔥"
                : "Tutor Socratic sabar — nggak ada yang salah ❤️"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-clay-inputBg px-4 py-1.5 text-xs font-extrabold text-clay-muted shadow-clay-inset">
          {params.id === "demo" ? "Mode demo" : "Tutor AI · langsung"}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-clay flex-col gap-6 px-4 py-6 sm:px-6">
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
            <div className="mb-3 flex items-center justify-between rounded-clay-md bg-clay-inputBg px-4 py-2.5 shadow-clay-inset">
              <span className="text-sm font-bold text-clay-dark">
                📷 {uploadedName} — menunggu OCR...
              </span>
              <button
                onClick={() => setUploadedName(null)}
                className="text-sm font-extrabold text-clay-muted"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-clay-sm transition-all duration-75 active:translate-y-1"
              aria-label="Tambah soal"
            >
              📷
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
              placeholder="Ketik jawabanmu..."
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
    </div>
  );
}
