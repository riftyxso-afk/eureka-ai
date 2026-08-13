"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import MarkdownView from "./MarkdownView";
import SourceChips from "./SourceChips";
import type { AssistantChatMessage } from "@/lib/assistant/types";

interface MessageBubbleProps {
  message: AssistantChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
}

/** Format waktu selesai menjawab, mis. "14:32 WIB". */
function formatDoneTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} WIB`;
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-clay-primary"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/**
 * Satu pesan chat asisten: user (bubble ungu kanan) / asisten (kartu putih kiri)
 * dengan markdown, sumber, state streaming & error.
 */
export default function MessageBubble({
  message,
  isStreaming = false,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const empty = !message.content.trim();

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[70%] break-words rounded-clay-md rounded-br-[8px] bg-clay-primary px-3.5 py-2.5 text-white shadow-clay-sm">
          <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logo Eureka.AI"
        className="mt-1 h-8 w-8 shrink-0 object-contain"
      />
      <div className="flex min-w-0 max-w-[85%] flex-col gap-1.5">
        <div className="break-words rounded-clay-md rounded-tl-[8px] border-2 border-clay-borderLight bg-white px-4 py-3 shadow-clay-sm">
          {isStreaming && empty ? (
            <div className="flex items-center gap-2 py-0.5">
              <ThinkingDots />
              <span className="text-[13px] font-bold text-clay-muted">
                Eureka sedang berpikir…
              </span>
            </div>
          ) : isStreaming ? (
            <div className="space-y-1">
              <MarkdownView content={message.content} className="break-words text-[13.5px] leading-relaxed" />
              <ThinkingDots />
            </div>
          ) : empty ? (
            <div className="flex items-center gap-2 py-0.5">
              <ThinkingDots />
              <span className="text-[13px] font-bold text-clay-muted">
                Eureka sedang berpikir…
              </span>
            </div>
          ) : (
            <MarkdownView content={message.content} className="break-words text-[13.5px] leading-relaxed" />
          )}
        </div>

        {message.model && (
          <span className="self-start rounded-clay-full bg-clay-beige px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-clay-muted">
            via {message.model}
          </span>
        )}

        {!isStreaming && message.sources.length > 0 && (
          <SourceChips sources={message.sources} />
        )}

        {/* Waktu selesai menjawab — hanya saat jawaban sudah lengkap */}
        {!isStreaming && !empty && (
          <span className="self-start pl-1 text-[10px] font-bold text-clay-muted/70">
            Selesai {formatDoneTime(message.createdAt)}
          </span>
        )}

        {!isStreaming && empty && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 self-start rounded-clay-full border-3 border-clay-secondary bg-white px-4 py-1.5 text-xs font-extrabold text-clay-secondary shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            <RefreshCw size={13} /> Coba lagi
          </button>
        )}
      </div>
    </motion.div>
  );
}