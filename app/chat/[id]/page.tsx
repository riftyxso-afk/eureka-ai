"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useAssistantChat } from "@/lib/assistant/useAssistantChat";
import { useAssistantSuggestions } from "@/lib/assistant/useAssistantSuggestions";
import { getUserId } from "@/lib/identity";
import {
  PENDING_PROMPT_KEY,
  type PendingPrompt,
} from "@/lib/assistant/pendingPrompt";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { detectImageIntent } from "@/lib/assistant/imageIntent";
import { detectStudyCommand } from "@/lib/assistant/studyContext";
import NoteActions from "@/components/asisten/NoteActions";
import TaskActions from "@/components/asisten/TaskActions";
import { mayManageNote, parseNoteCommand, proposeNoteCommand, type NoteCommand } from "@/lib/assistant/noteCommands";
import { mayManageTask, parseTaskCommand, proposeTaskCommand, type TaskCommand } from "@/lib/assistant/taskCommands";
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageSketchBlock } from "@/components/chat/ImageSketchBlock";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar, { MobileSessionButton } from "@/components/asisten/ChatSidebar";
import MessageBubble from "@/components/asisten/MessageBubble";
import ResponseActivity from "@/components/asisten/ResponseActivity";
import FollowUpActions from "@/components/asisten/FollowUpActions";
import MomoCompanion, { type MomoMode } from "@/components/asisten/MomoCompanion";
import ChatSkeleton from "@/components/asisten/ChatSkeleton";
import ClarificationCard from "@/components/asisten/ClarificationCard";
import ShareModal from "@/components/asisten/ShareModal";
import ChatQuizModal from "@/components/asisten/ChatQuizModal";
import ChatFlashcardModal from "@/components/asisten/ChatFlashcardModal";
import FeedbackSurveyModal from "@/components/asisten/FeedbackSurveyModal";
import { apiFetch } from "@/lib/apiClient";
import {
  isFeedbackDismissedLocally,
  markFeedbackDismissedLocally,
} from "@/lib/assistant/feedback";
import WebSearchPipeline from "@/components/asisten/WebSearchPipeline";
import StepLog from "@/components/asisten/StepLog";
import AiErrorPopup from "@/components/asisten/AiErrorPopup";
import Composer from "@/components/asisten/Composer";
import ArtifactCanvas from "@/components/asisten/ArtifactCanvas";
import { VideoViewOverlay } from "@/components/video/VideoViewOverlay";
import AiCallModal from "@/components/assistant/AiCallModal";
import { useBeta } from "@/lib/useBeta";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { useI18n } from "@/context/LocaleContext";
import TutorialHost from "@/components/tutorial/TutorialHost";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import { isDashboardV2 } from "@/lib/v2Navigation";
import PageTutorial from "@/components/tutorial/PageTutorial";
import type { ChatAttachment } from "@/lib/assistant/types";
import { copyText } from "@/lib/assistant/clipboard";
import { markdownToPlainText } from "@/lib/assistant/plainText";
import Copy from "kubai-icons-react/icons/copy";
import Crown from "kubai-icons-react/icons/crown";
import FileText from "kubai-icons-react/icons/file-text";
import Hand from "kubai-icons-react/icons/hand";
import LayoutDashboard from "kubai-icons-react/icons/grid";
import Share2 from "kubai-icons-react/icons/share";
import Sparkles from "kubai-icons-react/icons/sparkles";
import Check from "kubai-icons-react/icons/circle-check";
import Ellipsis from "kubai-icons-react/icons/more-horizontal";
import Plus from "kubai-icons-react/icons/circle-plus";
import Link from "next/link";

export default function ChatPage() {
  const reduceMotion = useReducedMotion();
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const inV2 = isDashboardV2(usePathname());
  const chatPath = inV2 ? "/dashboard-v2/tanya-momo" : "/chat";
  const homePath = inV2 ? "/dashboard-v2" : "/dashboard";
  const router = useRouter();
  const searchParams = useSearchParams();
  // Catatan yang di-import lewat URL (?note=xxx, mis. tombol "Tanya AI" di
  // halaman note) → langsung ter-lampirkan sebagai mention di composer.
  const importedNoteId = searchParams.get("note") ?? undefined;

  // Baca prompt yang diteruskan /home (sekali di mount). Baca TANPA menghapus
  // di sini karena useState initializer bisa jalan dua kali di StrictMode.
  const [initialSend] = useState<{
    question: string;
    mentions: string[];
    webSearch?: boolean;
    attachment?: ChatAttachment | null;
    speedMode?: "fast" | "normal" | "deep";
    model?: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PROMPT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingPrompt;
      if (!parsed.prompt || (parsed.sessionId && parsed.sessionId !== sessionId)) return null;
      return {
        question: parsed.prompt,
        mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [],
        webSearch: parsed.webSearch === true,
        attachment:
          parsed.attachment && typeof parsed.attachment === "object"
            ? {
                filename: String(parsed.attachment.filename ?? "").slice(0, 200),
                mimeType: String(parsed.attachment.mimeType ?? "").slice(0, 100),
                dataUrl: String(parsed.attachment.dataUrl ?? ""),
              }
            : null,
        speedMode:
          parsed.speedMode === "fast" || parsed.speedMode === "deep"
            ? parsed.speedMode
            : "normal",
        model: typeof parsed.model === "string" && parsed.model ? parsed.model : undefined,
      };
    } catch {
      return null;
    }
  });
  const [momoMode, setMomoMode] = useState<MomoMode>(initialSend?.speedMode ?? "normal");
  const [modelMenuHeight, setModelMenuHeight] = useState(0);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [initialPending, setInitialPending] = useState(!!initialSend);

  // Hapus dari sessionStorage setelah dibaca (efek, aman untuk StrictMode).
  useEffect(() => {
    if (initialSend) sessionStorage.removeItem(PENDING_PROMPT_KEY);
  }, [initialSend]);

  const [notePrompt, setNotePrompt] = useState<string | null>(null);
  const [wizardPrompt, setWizardPrompt] = useState<string | null>(null);
  const [notePrefs, setNotePrefs] = useState<NoteCreatePrefs | null>(null);
  // Riwayat percakapan saat user minta "buat catatan" — jadi materi sumber
  // catatan (topik yang sedang dibahas di chat), lihat NoteProgressOverlay.
  const [noteHistory, setNoteHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  // Naik tiap permintaan gambar baru — paksa remount blok walau prompt sama.
  const [imageNonce, setImageNonce] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [noteCommand, setNoteCommand] = useState<NoteCommand | null>(null);
  const [taskCommand, setTaskCommand] = useState<TaskCommand | null>(null);
  const [planningAction, setPlanningAction] = useState(false);
  const planningLock = useRef(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  // Video yang sedang dilihat via tombol "View" pada embed (expand + poin).
  const [viewVideo, setViewVideo] = useState<{ url: string; title?: string } | null>(null);
  const { isBeta } = useBeta();
  const { dict, locale } = useI18n();
  const l = dict.chat;
  // Pop-up error AI — muncul saat model down; "Tutup" menyembunyikan sampai
  // error BARU datang (di-reset lewat useEffect di bawah).
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Survey performa Eureka — sekali per user, ~1 menit setelah catatan
  // PERTAMA selesai dibuat. Kebenaran "sekali saja" di server (note_feedback);
  // jadwal dihitung dari created_at catatan pertama di DB (tahan tutup halaman).
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFeedbackSurvey = useCallback(async () => {
    if (isFeedbackDismissedLocally()) return;
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    try {
      const res = await apiFetch(
        `/api/feedback/note?userId=${encodeURIComponent(getUserId())}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        answered?: boolean;
        earliestNoteCreatedAt?: string | null;
      };
      if (data.answered) return;
      const created = data.earliestNoteCreatedAt
        ? new Date(data.earliestNoteCreatedAt).getTime()
        : null;
      if (!created || Number.isNaN(created)) return;
      // Jeda 1 menit setelah catatan pertama; bila sudah lewat (kunjungan
      // berikutnya), tampilkan setelah jeda singkat agar tidak mengejutkan.
      const remaining = created + 60_000 - Date.now();
      const delay = remaining > 0 ? remaining + 500 : 1500;
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackOpen(true);
      }, Math.min(delay, 60_000));
    } catch {
      // Gagal cek status — biarkan lewat, coba lagi pada kunjungan berikutnya.
    }
  }, []);

  useEffect(() => {
    void scheduleFeedbackSurvey();
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [scheduleFeedbackSurvey]);

  // Catatan baru selesai dibuat (overlay ditutup) → cek kelayakan survey.
  const prevNotePromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevNotePromptRef.current !== null && notePrompt === null) {
      void scheduleFeedbackSurvey();
    }
    prevNotePromptRef.current = notePrompt;
  }, [notePrompt, scheduleFeedbackSurvey]);

  // "Salin chat": seluruh percakapan dalam teks bersih, label peran per pesan,
  // tanpa metadata lain (timestamp/sumber/model). Nonaktif saat AI menulis
  // supaya jawaban setengah jalan tidak ikut tersalin.
  const handleCopyAll = async () => {
    const transcript = chat.renderedMessages
      .filter((m) => m.content.trim())
      .map(
        (m) =>
          `${m.role === "user" ? l.you : l.eureka}:\n${markdownToPlainText(m.content)}`
      )
      .join("\n\n");
    if (!transcript.trim()) return;
    const ok = await copyText(transcript);
    if (!ok) return;
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const chat = useAssistantChat({
    sessionId,
    onSessionCreated: (id) => router.replace(`${chatPath}/${id}`),
    initialSend,
  });
  const suggestions = useAssistantSuggestions(sessionId, chat.renderedMessages, chat.sending, chat.hasError);
  useEffect(() => {
    if (chat.sending || chat.hasError) setInitialPending(false);
  }, [chat.sending, chat.hasError]);

  // Reset dismiss saat error baru muncul (hasError berubah false → true),
  // agar pop-up tampil lagi untuk error berikutnya.
  useEffect(() => {
    if (chat.hasError) setErrorDismissed(false);
  }, [chat.hasError]);

  // Fitur flag Mode "Eureka Multi Agent" — env NEXT_PUBLIC (baca sekali).
  // Server tetap menolak bila flag backend FEATURE_MULTI_AGENT mati.
  const multiAgentAvailable =
    process.env.NEXT_PUBLIC_FEATURE_MULTI_AGENT === "1" || isBeta;

  const activeSession = chat.sessions.find((s) => s.id === sessionId);
  const latestAnswer = [...chat.renderedMessages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const latestQuestion = [...chat.renderedMessages].reverse().find((message) => message.role === "user")?.content ?? "";

  return (
    <div className={`momo-session flex h-dvh overflow-hidden bg-clay-beige p-0 ${chat.sending ? "is-generating" : ""}`}>
      <div className="flex h-full w-full overflow-hidden border-t border-clay-borderLight/60 sm:border-t-0">
        <ChatSidebar
          sessions={chat.sessions}
          activeId={sessionId}
          onNew={() => router.push(chatPath)}
          onSelect={() => {}}
          onRename={chat.renameSession}
          onDelete={async (id) => {
            const remaining = await chat.deleteSession(id);
            if (id === sessionId) {
              router.replace(
                remaining.length > 0 ? `${chatPath}/${remaining[0].id}` : chatPath
              );
            }
          }}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-clay-cream">
        {/* Header tetap di luar area scroll agar tidak mengubah posisi pesan. */}
        <header className="chat-session-header shrink-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3">
                  {inV2 && <V2MobileSidebar sessions={chat.sessions} />}
                  <div className={inV2 ? "contents v2-chat-old-mobile-nav" : "contents"}><MobileSessionButton
                    sessions={chat.sessions}
                    onSelect={(id) => router.push(`${chatPath}/${id}`)}
                  />
                  {/* Tombol Dashboard — khusus mobile (desktop ada di sidebar) */}
                  <Link
                    href={homePath}
                    data-tutorial-id="dashboard-nav"
                    aria-label={l.openDashboard}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-clay-primary hover:bg-clay-primary/10 lg:hidden"
                  >
                    <LayoutDashboard trigger="parent" size={18} />
                  </Link></div>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-extrabold text-clay-dark sm:text-base">
                      {activeSession?.title ?? l.title}
                    </h1>
                  </div>
                  {/* Indikator loop "Eureka Multi Agent" — "Iterasi x/8".
                      Muncul hanya saat loop aktif; hilang otomatis saat
                      keputusan exit tercapai (PRD §5.1). */}
                  {multiAgentAvailable && chat.loop.toggleOn && chat.loop.status === "active" && (
                    <span
                      className="hidden shrink-0 items-center gap-1 rounded-clay-full bg-[rgb(var(--accent-coral))]/15 px-2.5 py-1 text-[10.5px] font-extrabold text-[rgb(var(--accent-coral))] sm:inline-flex"
                      data-testid="loop-iteration-indicator"
                    >
                      <Sparkles trigger="parent" size={11} className="fill-current" />
                      Iterasi {Math.max(1, chat.loop.iteration)}/{chat.loop.maxIterations}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                  <ThemeSwitch /><PageTutorial guideId="chat" />
                  {chat.renderedMessages.length > 0 && (
                    <>
                      {/* Ikon Canvas — ghost minimal dengan badge count kecil
                          (bukan pill berwarna; satu aksi primer = Bagikan). */}
                      {chat.canvas.artifacts.length > 0 && (
                        <button
                          onClick={() => {
                            if (chat.canvas.open) chat.closeCanvas();
                            else chat.openCanvas();
                          }}
                          disabled={chat.sending}
                          title={chat.canvas.open ? "Sembunyikan Canvas" : "Buka Canvas"}
                          aria-label="Toggle Artifact Canvas"
                          data-testid="chat-toggle-canvas"
                          className="relative flex min-h-11 w-11 items-center justify-center rounded-xl text-clay-primary hover:bg-clay-primary/10 disabled:opacity-50"
                        >
                          <FileText trigger="parent" size={16} />
                          <span
                            className={`absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold ${
                              chat.canvas.open
                                ? "bg-[rgb(var(--accent-coral))] text-white"
                                : "bg-clay-primary/15 text-clay-primary"
                            }`}
                          >
                            {chat.canvas.artifacts.length}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={handleCopyAll}
                        disabled={chat.sending}
                        title={l.copyAllTitle}
                        aria-label={l.copyAll}
                        data-testid="chat-copy-all"
                        className="hidden min-h-11 w-11 items-center justify-center rounded-xl text-clay-muted hover:bg-clay-beige hover:text-clay-dark disabled:opacity-50 sm:flex"
                      >
                        {copiedAll ? <Check trigger="parent" size={16} className="text-clay-success" /> : <Copy trigger="parent" size={16} />}
                      </button>
                      {/* Aksi primer header — satu-satunya tombol solid. */}
                      <button
                        onClick={() => setShareOpen(true)}
                        disabled={chat.sending}
                        title={l.shareTitle}
                        aria-label={l.share}
                        data-testid="chat-share"
                        className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-violet-800 disabled:opacity-50 sm:inline-flex"
                      >
                        <Share2 trigger="parent" size={14} />
                        <span>{l.share}</span>
                      </button>
                      <details className="chat-mobile-actions sm:hidden" onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}>
                        <summary aria-label="Opsi percakapan"><Ellipsis trigger="parent" size={20} aria-hidden="true" /></summary>
                        <div className="chat-mobile-action-list">
                          <button type="button" disabled={chat.sending} onClick={(event) => {
                            const menu = event.currentTarget.closest("details");
                            if (menu) {
                              menu.open = false;
                              menu.querySelector("summary")?.focus();
                            }
                            void handleCopyAll();
                          }}><Copy trigger="parent" size={16} aria-hidden="true" /> {l.copyAll}</button>
                          <button type="button" disabled={chat.sending} onClick={(event) => {
                            event.currentTarget.closest("details")?.removeAttribute("open");
                            setShareOpen(true);
                          }}><Share2 trigger="parent" size={16} aria-hidden="true" /> {l.share}</button>
                        </div>
                      </details>
                    </>
                  )}
                  <button
                    onClick={() => router.push(chatPath)}
                    title={l.newChat}
                    aria-label={l.newChat}
                    data-testid="chat-new-top"
                    className="flex min-h-11 w-11 items-center justify-center rounded-xl text-clay-primary hover:bg-clay-primary/10"
                  >
                    <Plus trigger="parent" size={16} />
                  </button>
                </div>
              </div>
        </header>

        {/* Area pesan — scroll di sini */}
        <div className="chat-session-messages min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3.5 py-5 sm:px-6 sm:py-6">
          {initialSend && (initialPending || chat.loading || chat.sending) && chat.renderedMessages.length === 0 && !chat.hasError && !chat.clarification ? (
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <MessageBubble message={{ id: "pending-user", sessionId, role: "user", content: initialSend.question, mentions: initialSend.mentions, sources: [], model: null, createdAt: new Date().toISOString() }} />
              {initialSend.webSearch ? <WebSearchPipeline stage={chat.streaming.webStage ?? "preparing"} results={chat.streaming.webResults} query={chat.streaming.webQuery} notice={chat.streaming.webNotice} /> : <ResponseActivity thinking={chat.streaming.thinking} />}
            </div>
          ) : chat.loading && chat.messages.length === 0 && !chat.sending ? (
            <ChatSkeleton label={locale === "en" ? "Loading conversation…" : "Memuat percakapan…"} />
          ) : chat.renderedMessages.length === 0 &&
            !(chat.clarification && chat.clarification.length > 0) &&
            !chat.hasError ? (
            <div className="py-14 text-center">
              <MomoCompanion mode={momoMode} className="momo-chat-empty" />
              <h2 className="mt-4 flex items-center justify-center gap-2 text-lg font-extrabold text-clay-dark sm:text-xl">
                {l.emptyTitle}{" "}
                <Hand trigger="parent" size={22} className="shrink-0 text-clay-primary" />
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-clay-muted">
                {l.emptyDesc1}{" "}
                <span className="rounded-clay-full bg-clay-primary/15 px-1.5 py-0.5 font-extrabold text-clay-primary">@</span>{" "}
                {l.emptyDesc2}
              </p>
            </div>
          ) : (
            /* Sama lebar dengan composer (max-w-3xl) agar bubble sejajar di atasnya. */
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {chat.renderedMessages.map((m, idx) => {
                // Pesan user sebelumnya → untuk hitung lama AI menjawab.
                const prevMsg =
                  idx > 0 ? chat.renderedMessages[idx - 1] : null;
                return (
                  <div key={m.id} className="space-y-4">
                    {/* Step-log Solve-then-Guide — tahap asli dari SSE backend.
                        Tampil hanya di bubble streaming terakhir saat aktif. */}
                    <MessageBubble
                      message={m}
                      webStage={idx === chat.renderedMessages.length - 1 ? chat.streaming.webStage : null}
                      webQuery={chat.streaming.webQuery}
                      webNotice={chat.streaming.webNotice}
                      isStreaming={chat.sending && idx === chat.renderedMessages.length - 1 && m.id.startsWith("stream-")}
                      thinking={chat.sending && idx === chat.renderedMessages.length - 1 ? chat.streaming.thinking : null}
                      prevMessage={prevMsg}
                      onOpenArtifacts={(id) => { setActiveArtifactId(id); chat.openCanvas(); }}
                      videoEnabled={isBeta}
                      onViewVideo={(url) => {
                        // Pertahanan berlapis: hanya beta bisa membuka View.
                        if (isBeta) setViewVideo({ url });
                      }}
                    />
                    {idx === chat.renderedMessages.length - 1 && m.role === "assistant" && !chat.sending && !chat.hasError && m.content.trim() && (suggestions.loading || suggestions.items.length > 0) && (
                      <FollowUpActions
                        suggestions={suggestions.items}
                        loading={suggestions.loading}
                        disabled={chat.loading || chat.sessionsLoading}
                        onSend={(question) => chat.handleSend({ question, mentions: [] })}
                        onQuiz={() => setQuizOpen(true)}
                        onFlashcards={() => setCardsOpen(true)}
                      />
                    )}
                  </div>
                );
              })}
              {/* Generate gambar — INLINE di stream (bukan modal): dot-matrix
                  loading lalu crossfade ke hasil di posisi yang sama. */}
              {imagePrompt && (
                <ImageSketchBlock
                  key={`${imagePrompt}-${imageNonce}`}
                  prompt={imagePrompt}
                  history={chat.renderedMessages
                    .filter((m) => m.role === "user" || m.role === "assistant")
                    .map((m) => ({ role: m.role, content: m.content }))
                    .slice(-10)}
                  onClose={() => setImagePrompt(null)}
                />
              )}
              {chat.clarification && chat.clarification.length > 0 && (
                <ClarificationCard
                  questions={chat.clarification}
                  onAnswer={(a) => void chat.answerClarification(a)}
                  onSkip={() => void chat.skipClarification()}
                />
              )}
              {chat.hasError && (
                <MessageBubble
                  message={{
                    id: "error-hold",
                    sessionId,
                    role: "assistant",
                    content: "",
                    mentions: [],
                    sources: chat.streaming.sources,
                    model: chat.streaming.model,
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming={false}
                  onRetry={chat.handleRetry}
                />
              )}
              {chat.hasError && chat.streaming.upgradeUrl && (
                <div className="mx-auto w-full max-w-3xl">
                  <Link
                    href={chat.streaming.upgradeUrl}
                    className="block w-full rounded-clay-md border-3 border-clay-borderLight bg-clay-primary px-5 py-3 text-center text-sm font-extrabold text-white shadow-clay-btn transition-all hover:brightness-110 active:translate-y-0.5"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Crown trigger="parent" size={16} /> {l.upgrade}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — minta "buat catatan" → wizard F&Q menyatu, bukan chat */}
        <div className="momo-session-composer">
        {noteCommand && <div className="mx-auto max-w-[760px]"><NoteActions key={JSON.stringify(noteCommand)} command={noteCommand} onClose={() => setNoteCommand(null)} onChoose={setNoteCommand} /></div>}
        {taskCommand && <div className="mx-auto max-w-[760px]"><TaskActions key={JSON.stringify(taskCommand)} command={taskCommand} onClose={() => setTaskCommand(null)} onChoose={setTaskCommand} /></div>}
        {planningAction && <p role="status" className="mx-auto mb-2 max-w-[760px] text-sm text-clay-muted">Momo sedang memahami permintaan Anda…</p>}
        {chat.renderedMessages.length > 0 && (
          <div className="momo-composer-companion">
            <motion.div
              className="momo-composer-companion-motion"
              layout={!reduceMotion}
              transition={{ duration: 0.22, ease: [0.77, 0, 0.175, 1] }}
            >
              <div
                className="momo-composer-companion-offset"
                style={{ transform: `translateY(-${modelMenuHeight}px)` }}
              >
                <MomoCompanion
                  mode={momoMode}
                  question={latestQuestion}
                  response={latestAnswer}
                  thinking={chat.sending}
                  error={chat.hasError}
                />
              </div>
            </motion.div>
          </div>
        )}
        <Composer
          reactBits
          onModelMenuHeightChange={setModelMenuHeight}
          initialMomoMode={initialSend?.speedMode}
          onMomoModeChange={setMomoMode}
          userId={getUserId()}
          sending={chat.sending}
          disabled={planningAction || chat.loading || chat.sessionsLoading}
          initialMentions={importedNoteId ? [importedNoteId] : []}
          onCall={() => setCallOpen(true)}
          noteWizardPrompt={wizardPrompt}
          onNoteWizardClose={() => {
            setWizardPrompt(null);
            setNoteHistory([]);
          }}
          onNoteWizardStart={(prefs) => {
            setNotePrefs(prefs);
            setNotePrompt(wizardPrompt);
            setWizardPrompt(null);
          }}
          onSend={async (input) => {
            const noteAction = parseNoteCommand(input.question);
            if (noteAction) {
              setTaskCommand(null);
              setNoteCommand(noteAction);
              return;
            }
            const taskAction = parseTaskCommand(input.question);
            if (taskAction) { setNoteCommand(null); setTaskCommand(taskAction); return; }
            if (mayManageNote(input.question)) {
              if (planningLock.current) return;
              planningLock.current = true;
              setPlanningAction(true);
              const proposal = await proposeNoteCommand(input.question);
              planningLock.current = false;
              setPlanningAction(false);
              if (proposal) { setTaskCommand(null); setNoteCommand(proposal); return; }
            }
            if (mayManageTask(input.question)) {
              if (planningLock.current) return;
              planningLock.current = true;
              setPlanningAction(true);
              const proposal = await proposeTaskCommand(input.question);
              planningLock.current = false;
              setPlanningAction(false);
              if (proposal) { setNoteCommand(null); setTaskCommand(proposal); return; }
            }
            // Command alat belajar: /kuis & /card → buka popup, TIDAK dikirim
            // sebagai pesan ke AI. Exact-match (deteksi di lib/studyContext).
            const cmd = detectStudyCommand(input.question);
            if (cmd === "quiz") {
              setQuizOpen(true);
              return;
            }
            if (cmd === "cards") {
              setCardsOpen(true);
              return;
            }
            // "buat gambar" → generate gambar AI sesuai topik percakapan.
            if (detectImageIntent(input.question).isImageRequest) {
              setImagePrompt(input.question);
              setImageNonce((n) => n + 1);
              return;
            }
            if (detectNoteIntent(input.question).isNoteRequest && !chat.loop.toggleOn) {
              // Topik yang sedang dibahas di chat ikut jadi materi catatan —
              // hanya untuk beta tester (akses lewat /join). Non-beta tetap
              // bisa buat catatan seperti biasa (tanpa konteks percakapan).
              // Bila Eureka Multi Agent (loop) ON, biarkan dikirim ke loop agar
              // agen Jejak menghasilkan artifact canvas langsung!
              setNoteHistory(
                isBeta
                  ? chat.renderedMessages
                      .filter(
                        (m) =>
                          (m.role === "user" || m.role === "assistant") &&
                          m.content.trim().length > 0
                      )
                      .map((m) => ({ role: m.role, content: m.content }))
                  : []
              );
              setWizardPrompt(input.question);
              return;
            }
            chat.handleSend(input);
          }}
          onStop={chat.handleStop}
          showMultiAgentToggle={multiAgentAvailable}
          multiAgentOn={chat.loop.toggleOn}
          onMultiAgentToggle={chat.setLoopToggle}
        />
        </div>
      </main>
        <ArtifactCanvas
          key={sessionId ?? "new"}
          artifacts={chat.canvas.artifacts}
          streamingId={chat.canvas.streamingId}
          sending={chat.sending}
          open={chat.canvas.open}
          activeId={activeArtifactId}
          onSelect={setActiveArtifactId}
          onClose={chat.closeCanvas}
          onEditSave={chat.saveArtifactEdit}
        />
      </div>

      {/* Overlay pembuatan catatan */}
      <NoteProgressOverlay
        open={!!notePrompt}
        prompt={notePrompt ?? ""}
        prefs={notePrefs ?? undefined}
        history={noteHistory}
        onClose={() => {
          setNotePrompt(null);
          setNotePrefs(null);
          setNoteHistory([]);
        }}
      />

      {/* Modal bagikan chat (snapshot publik view-only) */}
      <ShareModal
        open={shareOpen}
        sessionId={sessionId}
        title={activeSession?.title ?? l.conversation}
        onClose={() => setShareOpen(false)}
      />

      {/* Modal kuis dari percakapan (command /kuis) */}
      <ChatQuizModal
        open={quizOpen}
        sessionId={sessionId}
        onClose={() => setQuizOpen(false)}
      />

      {/* Modal flashcards dari percakapan (command /card) */}
      <ChatFlashcardModal
        open={cardsOpen}
        sessionId={sessionId}
        onClose={() => setCardsOpen(false)}
      />

      {/* Survey performa Eureka — sekali per user, ~1 menit setelah catatan
          pertama selesai; submit/dismiss menandai selesai permanen. */}
      <FeedbackSurveyModal
        open={feedbackOpen}
        onClose={() => {
          setFeedbackOpen(false);
          markFeedbackDismissedLocally();
        }}
      />

      {/* Panggilan suara AI (beta) */}
      <AiCallModal chat open={callOpen} onClose={() => setCallOpen(false)} />

      {/* Tampilan expand video: video kiri + poin-poin isi video di kanan */}
      <VideoViewOverlay
        open={!!viewVideo}
        url={viewVideo?.url ?? ""}
        title={viewVideo?.title}
        onClose={() => setViewVideo(null)}
      />

      {/* Pop-up model AI down — info cepat tanpa menunggu lama */}
      <AiErrorPopup
        open={chat.hasError && !errorDismissed && !chat.streaming.upgradeUrl}
        message={chat.streaming.error}
        onRetry={() => {
          setErrorDismissed(false);
          chat.handleRetry();
        }}
        onClose={() => setErrorDismissed(true)}
      />



      {/* Tutorial realtime (berlanjut dari /home bila sedang aktif) */}
      <TutorialHost />
    </div>
  );
}
