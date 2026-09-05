"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookMarked, Check, Copy, Paperclip, RefreshCw, Zap } from "lucide-react";
import MarkdownView from "./MarkdownView";
import SourceChips from "./SourceChips";
import EurekaOrb from "@/components/ui/EurekaOrb";
import EurekaBlobAvatar from "@/components/asisten/EurekaBlobAvatar";
import { YoutubeEmbed } from "@/components/video/YoutubeEmbed";
import { modelDisplayName } from "@/lib/modelCatalog";
import { copyText } from "@/lib/assistant/clipboard";
import { markdownToPlainText } from "@/lib/assistant/plainText";
import { findYoutubeLink } from "@/lib/assistant/videoUrl";
import type { AssistantChatMessage } from "@/lib/assistant/types";
import ThinkingState from "@/components/thinking/ThinkingState";
import LoadingState from "@/components/thinking/LoadingState";
import StreamingText from "@/components/streaming/StreamingText";

interface MessageBubbleProps {
  message: AssistantChatMessage;
  isStreaming?: boolean;
  thinking?: string | null;
  onRetry?: () => void;
  /** Pesan user sebelumnya — dipakai hitung lama AI menjawab. */
  prevMessage?: AssistantChatMessage | null;
  /** Klik "View" pada embed video → buka tampilan expand (overlay di halaman). */
  onViewVideo?: (url: string) => void;
  /** Fitur video (embed + View) hanya untuk beta tester — default true agar
   *  pemanggil lama tidak berubah; halaman chat mengirim status beta. */
  videoEnabled?: boolean;
}

/**
 * Tombol copy isi pesan dalam teks bersih (markdown di-strip).
 * Sembunyi saat konten kosong; feedback "Tersalin" ±2 detik.
 */
function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  if (!content.trim()) return null;

  const handleCopy = async () => {
    const ok = await copyText(markdownToPlainText(content));
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Salin pesan"
      title="Salin pesan sebagai teks bersih"
      className="inline-flex min-h-[26px] items-center gap-1 self-start rounded-clay-full border-2 border-clay-borderLight bg-clay-cream px-2 py-0.5 text-[11px] font-bold text-clay-muted shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 hover:text-clay-primary active:translate-y-1"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Tersalin" : "Salin"}
    </button>
  );
}

/** Format durasi: "12 detik" / "1 mnt 20 dtk" / "3 mnt". */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} detik`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (sec === 0) return `${min} mnt`;
  return `${min} mnt ${sec} dtk`;
}

/**
 * Lama AI mengerjakan jawaban: selisih createdAt pesan asisten dengan
 * pesan user sebelumnya (pertanyaan yang memicunya).
 */
function answerDurationMs(
  message: AssistantChatMessage,
  prevMessage?: AssistantChatMessage | null
): number | null {
  if (!prevMessage) return null;
  const end = Date.parse(message.createdAt);
  const start = Date.parse(prevMessage.createdAt);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return end - start;
}

function ThinkingDots({ prevText, thinking, working }: { prevText?: string | null; thinking?: string | null; working?: boolean }) {
  const isLink = prevText ? /https?:\/\//.test(prevText) : false;
  let reasoningOn = true;
  try {
    const v = localStorage.getItem("eureka_reasoning");
    if (v !== null) reasoningOn = v === "true";
  } catch {}
  if (!reasoningOn) {
    return <LoadingState variant={isLink ? "Search" : "Drive"} />;
  }
  return <ThinkingState variant={isLink ? "Search" : "Steps"} thinking={thinking ?? undefined} working={working} />;
}

/**
 * Satu pesan chat asisten: user (bubble ungu kanan) / asisten (kartu putih kiri)
 * dengan markdown, sumber, state streaming & error.
 */
export default function MessageBubble({
  message,
  isStreaming = false,
  thinking,
  onRetry,
  prevMessage,
  onViewVideo,
  videoEnabled = true,
}: MessageBubbleProps & { thinking?: string | null }) {
  const isUser = message.role === "user";
  const empty = !message.content.trim();
  const duration = isUser
    ? null
    : answerDurationMs(message, prevMessage);
  // Link YouTube pesan user → tampilkan embed di bawah teks. Field videoUrl
  // hanya ada di pesan optimis; setelah reload di-detect ulang dari content.
  const userVideoUrl =
    (isUser && (message.videoUrl || findYoutubeLink(message.content)?.url)) ||
    null;

  // Thinking terakhir yang sempat tampil — dipertahankan saat prop thinking
  // hilang (mis. jawaban selesai) agar tidak kedip. Disimpan via state di
  // efek (bukan mutasi ref saat render — bug + warning react-hooks/refs).
  // Hooks WAJIB di atas early return agar urutannya stabil tiap render.
  const [lastThinking, setLastThinking] = useState<string | null>(null);
  useEffect(() => {
    if (thinking) setLastThinking(thinking);
  }, [thinking]);
  const displayThinking = thinking ?? lastThinking;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="flex items-end gap-1.5">
          <CopyButton content={message.content} />
          <div className="max-w-[70%] break-words rounded-clay-md rounded-br-[8px] bg-clay-primary px-3.5 py-2.5 text-white shadow-clay-sm">
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">
              {message.content}
            </p>
            {/* Indikasi lampiran: catatan @ & dokumen yang ikut terkirim */}
            {(message.mentions.length > 0 || message.attachmentName) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.mentions.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-clay-full bg-clay-cream/20 px-2 py-0.5 text-[10.5px] font-extrabold">
                    <BookMarked size={11} />
                    {message.mentions.length} catatan
                  </span>
                )}
                {message.attachmentName && (
                  <span className="inline-flex items-center gap-1 rounded-clay-full bg-clay-cream/20 px-2 py-0.5 text-[10.5px] font-extrabold">
                    <Paperclip size={11} />
                    {message.attachmentName.slice(0, 40)}
                  </span>
                )}
              </div>
            )}
            {videoEnabled && userVideoUrl && (
              <div className="mt-2.5">
                <YoutubeEmbed url={userVideoUrl} onView={onViewVideo} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Thinking terakhir yang sempat tampil — dipertahankan saat prop thinking
  // hilang (mis. jawaban selesai) agar tidak kedip. Ditulis di efek, bukan
  // saat render (mutasi ref saat render = bug + warning react-hooks/refs).
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5"
    >
      <EurekaBlobAvatar size={32} className="mt-1 shrink-0" />
      <div className="flex min-w-0 max-w-[85%] flex-col gap-1.5">
        {/* Thinking di paling atas saat sudah dijawab — biar keliatan hasil thinking */}
        {!isStreaming && !empty && displayThinking && (
          <div className="break-words rounded-clay-md border border-clay-borderLight/60 bg-clay-beige/20 px-3 py-2">
            <ThinkingDots prevText={prevMessage?.content ?? null} thinking={displayThinking} working={false} />
          </div>
        )}
        <div className="break-words rounded-clay-md rounded-tl-[8px] border-2 border-clay-borderLight bg-clay-cream px-4 py-3 shadow-clay-sm">
          {isStreaming && empty ? (
            <ThinkingDots prevText={prevMessage?.content ?? null} thinking={thinking} working={isStreaming} />
          ) : isStreaming ? (
            <StreamingText content={message.content} sources={[]} followUps={[]} loop={false} fill />
          ) : empty ? (
            <ThinkingDots prevText={prevMessage?.content ?? null} thinking={thinking} working={false} />
          ) : (
            <MarkdownView content={message.content} className="break-words text-[13.5px] leading-relaxed" />
          )}
        </div>

        {/* Meta: model + salin — hanya saat jawaban lengkap (bukan streaming) */}
        <div className="flex items-center gap-1.5 self-start">
          {message.model && (
            <span className="rounded-clay-full bg-clay-beige px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-clay-muted">
              via {modelDisplayName(message.model)}
            </span>
          )}
          {!isStreaming && !empty && <CopyButton content={message.content} />}
        </div>

        {!isStreaming && message.sources.length > 0 && (
          <SourceChips sources={message.sources} />
        )}

        {/* Lama AI menjawab — hanya saat jawaban sudah lengkap */}
        {!isStreaming && !empty && duration !== null && duration >= 0 && (
          <span className="self-start pl-1 text-[10px] font-bold text-clay-muted/70">
            <Zap size={13} className="-mt-0.5 mr-1 inline text-clay-primary" />
            AI menjawab dalam {formatDuration(duration)}
          </span>
        )}

        {!isStreaming && empty && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 self-start rounded-clay-full border-3 border-clay-secondary bg-clay-cream px-4 py-1.5 text-xs font-extrabold text-clay-secondary shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            <RefreshCw size={13} /> Coba lagi
          </button>
        )}
      </div>
    </motion.div>
  );
}