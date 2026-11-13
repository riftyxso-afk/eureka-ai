"use client";
import TrainingContribution from "@/components/dashboard/TrainingContribution";
import dynamic from "next/dynamic";
import {boardMap} from "@/lib/meetBoard";
import Network from "kubai-icons-react/icons/network";
const ConceptMap=dynamic(()=>import("@/components/dashboard/StudyMindmap"));
import DocumentLogo from "@/components/ui/DocumentLogo";

import { useMemo, useState } from "react";
import { parseArtifactMessage } from "@/lib/assistant/artifacts";
import { motion } from "framer-motion";
import ArrowUpRight from "kubai-icons-react/icons/arrow-up-right";
import BookMarked from "kubai-icons-react/icons/book-marked";
import Copy from "kubai-icons-react/icons/copy";
import FileText from "kubai-icons-react/icons/file-text";
import Info from "kubai-icons-react/icons/info";
import Check from "kubai-icons-react/icons/circle-check";
import RefreshCw from "kubai-icons-react/icons/sync";
import MarkdownView from "./MarkdownView";
import SourceChips from "./SourceChips";
import { citedNoteSources } from "@/lib/assistant/citedSources";
import MomoMessageAvatar from "@/components/asisten/MomoMessageAvatar";
import ResponseActivity from "@/components/asisten/ResponseActivity";
import WebSearchPipeline from "./WebSearchPipeline";
import WebSources from "./WebSources";
import { YoutubeEmbed } from "@/components/video/YoutubeEmbed";
import { modelDisplayName } from "@/lib/modelCatalog";
import { copyText } from "@/lib/assistant/clipboard";
import { markdownToPlainText } from "@/lib/assistant/plainText";
import { findYoutubeLink } from "@/lib/assistant/videoUrl";
import type { AssistantChatMessage, WebSearchStage } from "@/lib/assistant/types";

interface MessageBubbleProps {
  avatar?: import("react").ReactNode;
  activity?: import("@/lib/loading-stage").LoadingStage;
  message: AssistantChatMessage;
  isStreaming?: boolean;
  thinking?: string | null;
  webStage?: WebSearchStage | null;
  webQuery?: string;
  webNotice?: string | null;
  onRetry?: () => void;
  onOpenArtifacts?: (id: string) => void;
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
 * Muncul on-hover bubble (group-hover) — tetap tap-able di mobile.
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
      className="chat-message-copy inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-clay-full text-clay-muted transition-opacity duration-100 hover:bg-clay-beige hover:text-clay-primary focus-visible:opacity-100 active:scale-95"
    >
      {copied ? <Check trigger="parent" size={13} className="text-clay-success" /> : <Copy trigger="parent" size={13} />}
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

/**
 * Satu pesan chat asisten: user (bubble ungu kanan) / asisten (kartu putih kiri)
 * dengan markdown, sumber, state streaming & error.
 */
export default function MessageBubble({
  message,
  avatar,
  isStreaming = false,
  thinking,
  activity = "thinking",
  webStage,
  webQuery,
  webNotice,
  onRetry,
  onOpenArtifacts,
  prevMessage,
  onViewVideo,
  videoEnabled = true,
}: MessageBubbleProps & { thinking?: string | null }) {
  const [mapOpen,setMapOpen]=useState(false);
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

  // Bersihkan tag <artifact ...>...</artifact> dari tampilan bubble pesan chat
  // agar isi artifact hanya tampil di panel Artifact Canvas terpisah.
  const parsedContent = useMemo(
    () => isUser ? null : parseArtifactMessage(message.content, isStreaming),
    [isUser, message.content, isStreaming]
  );
  const displayContent = isUser ? message.content : (parsedContent?.chat ?? "").trim();

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="group chat-message chat-message--user"
      >
        <div className="chat-message-user-stack">
          <div className="momo-message-user chat-message-user-content px-3.5 py-2.5">
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">
              {message.content}
            </p>
            {/* Indikasi lampiran: catatan @ & dokumen yang ikut terkirim */}
            {(message.mentions.length > 0 || message.attachmentName) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.mentions.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-clay-full bg-clay-cream/20 px-2 py-0.5 text-[10.5px] font-extrabold">
                    <BookMarked trigger="parent" size={11} />
                    {message.mentions.length} catatan
                  </span>
                )}
                {message.attachmentName && (
                  <span className="document-attachment inline-flex max-w-full items-center gap-2 px-2 py-1 text-xs">
                    <DocumentLogo name={message.attachmentName} />
                    <span className="min-w-0 truncate" title={message.attachmentName}>{message.attachmentName}</span>
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
          <div className="chat-message-actions self-end">
            <CopyButton content={message.content} />
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
      className="group chat-message chat-message--assistant"
    >
      {avatar ?? <MomoMessageAvatar question={prevMessage?.role === "user" ? prevMessage.content : ""} response={message.content} thinking={isStreaming} />}
      <div className="chat-message-assistant-content flex min-w-0 flex-col gap-1.5">
        {isStreaming && webStage && <WebSearchPipeline stage={webStage} results={message.webResults ?? []} query={webQuery} notice={webNotice} />}
        {isStreaming && <ResponseActivity thinking={thinking} stage={displayContent ? "combining" : activity} showIndicator={!webStage} />}
        {/* Thinking di paling atas saat sudah dijawab — biar keliatan hasil thinking */}
        <div className="break-words text-clay-dark">
          {empty || !displayContent ? (
            null
          ) : (
            <MarkdownView content={displayContent} className="break-words text-[14px] leading-relaxed" />
          )}
        </div>

        {!isStreaming && onOpenArtifacts && parsedContent?.artifacts.map((artifact, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onOpenArtifacts(`${message.id}:artifact:${index}`)}
            className="flex min-h-11 max-w-full items-center gap-2 self-start border-b border-clay-primary/20 py-2 text-start text-sm font-bold text-clay-dark hover:text-clay-primary focus-visible:outline-2 focus-visible:outline-clay-primary"
          >
            <FileText trigger="parent" size={17} className="shrink-0 text-clay-primary" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{artifact.title || "Buka artifact"}</span>
            <ArrowUpRight trigger="parent" size={15} className="shrink-0 text-clay-muted" aria-hidden="true" />
          </button>
        ))}

        {!isStreaming && !!message.webResults?.length && <WebSources results={message.webResults} />}

        {/* Meta: salin muncul on-hover; model & durasi jadi tooltip ikon info
            (metadata teknis tidak tampil default — chat-visual-hierarchy). */}
        {!isStreaming && (!empty || displayContent) && (
          <div className="flex items-center gap-1 self-start">
            {message.model && (
              <span
                className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-clay-full text-clay-muted/50 opacity-0 transition-opacity duration-100 hover:text-clay-muted group-hover:opacity-100"
                title={
                  duration !== null && duration >= 0
                    ? `${modelDisplayName(message.model)} · AI menjawab dalam ${formatDuration(duration)}`
                    : modelDisplayName(message.model)
                }
              >
                <Info trigger="parent" size={13} />
              </span>
            )}
            {displayContent && <CopyButton content={displayContent} />}
            {displayContent&&message.model!=="eureka-study"&&<button aria-label="Petakan jawaban ini" title="Peta konsep" aria-expanded={mapOpen} onClick={()=>setMapOpen(!mapOpen)} className="chat-message-copy inline-flex h-8 w-8 items-center justify-center text-clay-muted"><Network size={15}/></button>}
          </div>
        )}

        {!isStreaming&&message.model!=="eureka-study"&&message.sessionId&&<TrainingContribution sessionId={message.sessionId} answer={message.content}/>}
        {mapOpen&&<div className="chat-concept-map"><ConceptMap nodes={boardMap(displayContent,"Peta jawaban")} disabled onExplore={()=>{}}/></div>}
        {!isStreaming && message.sources.length > 0 && (
          <SourceChips sources={citedNoteSources(message.content, message.sources)} />
        )}

        {!isStreaming && empty && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 self-start rounded-clay-full border-3 border-clay-secondary bg-clay-cream px-4 py-1.5 text-xs font-extrabold text-clay-secondary shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            <RefreshCw trigger="parent" size={13} /> Coba lagi
          </button>
        )}
      </div>
    </motion.div>
  );
}
