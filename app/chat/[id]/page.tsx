"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistantChat } from "@/lib/assistant/useAssistantChat";
import { getUserId } from "@/lib/identity";
import {
  PENDING_PROMPT_KEY,
  type PendingPrompt,
} from "@/lib/assistant/pendingPrompt";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { detectImageIntent } from "@/lib/assistant/imageIntent";
import { detectStudyCommand } from "@/lib/assistant/studyContext";
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageSketchBlock } from "@/components/chat/ImageSketchBlock";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar, { MobileSessionButton } from "@/components/asisten/ChatSidebar";
import MessageBubble from "@/components/asisten/MessageBubble";
import ClarificationCard from "@/components/asisten/ClarificationCard";
import ChatSkeleton from "@/components/asisten/ChatSkeleton";
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
import AiErrorPopup from "@/components/asisten/AiErrorPopup";
import Composer from "@/components/asisten/Composer";
import { VideoViewOverlay } from "@/components/video/VideoViewOverlay";
import AiCallModal from "@/components/assistant/AiCallModal";
import { useBeta } from "@/lib/useBeta";
import { useI18n } from "@/context/LocaleContext";
import TutorialHost from "@/components/tutorial/TutorialHost";
import type { ChatAttachment } from "@/lib/assistant/types";
import { copyText } from "@/lib/assistant/clipboard";
import { markdownToPlainText } from "@/lib/assistant/plainText";
import {
  Check,
  Copy,
  Crown,
  Hand,
  LayoutDashboard,
  Plus,
  Share2,
} from "lucide-react";
import Link from "next/link";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
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
    const raw = sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PendingPrompt;
      if (!parsed.prompt) return null;
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

  // Hapus dari sessionStorage setelah dibaca (efek, aman untuk StrictMode).
  useEffect(() => {
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
  }, []);

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
  const [copiedAll, setCopiedAll] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  // Video yang sedang dilihat via tombol "View" pada embed (expand + poin).
  const [viewVideo, setViewVideo] = useState<{ url: string; title?: string } | null>(null);
  const { isBeta } = useBeta();
  const { dict } = useI18n();
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

  // Header auto-hide saat scroll ke bawah (mobile) — tampil lagi saat ke atas.
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    const delta = y - lastScrollY.current;
    if (delta > 4 && y > 64) setHeaderHidden(true);
    else if (delta < -4) setHeaderHidden(false);
    lastScrollY.current = y;
  };

  const chat = useAssistantChat({
    sessionId,
    onSessionCreated: (id) => router.replace(`/chat/${id}`),
    initialSend,
  });

  // Reset dismiss saat error baru muncul (hasError berubah false → true),
  // agar pop-up tampil lagi untuk error berikutnya.
  useEffect(() => {
    if (chat.hasError) setErrorDismissed(false);
  }, [chat.hasError]);

  const activeSession = chat.sessions.find((s) => s.id === sessionId);

  return (
    <div className="flex h-dvh gap-0 bg-clay-beige p-0 sm:gap-4 sm:p-4">
      <ChatSidebar
        sessions={chat.sessions}
        activeId={sessionId}
        onNew={chat.handleNew}
        onSelect={() => {}}
        onRename={chat.renameSession}
        onDelete={async (id) => {
          const remaining = await chat.deleteSession(id);
          if (id === sessionId) {
            router.replace(
              remaining.length > 0 ? `/chat/${remaining[0].id}` : "/dashboard"
            );
          }
        }}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-clay-cream sm:rounded-clay sm:border-2 sm:border-clay-borderLight sm:shadow-clay-sm">
        {/* Topbar — auto-hide saat scroll ke bawah (slide up), muncul saat ke atas */}
        <AnimatePresence initial={false}>
          {!headerHidden && (
            <motion.header
              key="chat-topbar"
              initial={{ height: 0, opacity: 0, y: -16 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b-[3px] border-clay-borderLight px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <MobileSessionButton
                    sessions={chat.sessions}
                    onSelect={(id) => router.push(`/chat/${id}`)}
                  />
                  {/* Tombol Dashboard — khusus mobile (desktop ada di sidebar) */}
                  <Link
                    href="/dashboard"
                    data-tutorial-id="dashboard-nav"
                    aria-label={l.openDashboard}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-md bg-clay-cream text-clay-primary shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 lg:hidden"
                  >
                    <LayoutDashboard size={18} />
                  </Link>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo Eureka.AI" className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-extrabold text-clay-dark sm:text-base">
                      {activeSession?.title ?? l.title}
                    </h1>
                    <p className="hidden text-[11px] font-bold text-clay-muted sm:block">
                      {l.hasAccess}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {chat.renderedMessages.length > 0 && (
                    <>
                      <button
                        onClick={handleCopyAll}
                        disabled={chat.sending}
                        title={l.copyAllTitle}
                        aria-label={l.copyAll}
                        data-testid="chat-copy-all"
                        className="btn-clay-ghost !min-h-[40px] !px-2.5 !py-2 text-xs disabled:opacity-50 sm:!px-3.5"
                      >
                        {copiedAll ? (
                          <Check size={14} className="sm:mr-1.5" />
                        ) : (
                          <Copy size={14} className="sm:mr-1.5" />
                        )}
                        <span className="hidden sm:inline">
                          {copiedAll ? l.copied : l.copyAll}
                        </span>
                      </button>
                      <button
                        onClick={() => setShareOpen(true)}
                        disabled={chat.sending}
                        title={l.shareTitle}
                        aria-label={l.share}
                        data-testid="chat-share"
                        className="btn-clay-ghost !min-h-[40px] !px-2.5 !py-2 text-xs disabled:opacity-50 sm:!px-3.5"
                      >
                        <Share2 size={14} className="sm:mr-1.5" />
                        <span className="hidden sm:inline">Bagikan</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={chat.handleNew}
                    className="btn-clay-ghost !min-h-[40px] !px-3 !py-2 text-xs sm:!px-4"
                    aria-label={l.newChat}
                    data-testid="chat-new-top"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Area pesan — scroll di sini */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3.5 py-5 sm:px-6 sm:py-6"
        >
          {chat.loading && chat.messages.length === 0 ? (
            <ChatSkeleton />
          ) : chat.renderedMessages.length === 0 &&
            !(chat.clarification && chat.clarification.length > 0) &&
            !chat.hasError ? (
            <div className="py-14 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Eureka" className="mx-auto h-16 w-16 object-contain" />
              <h2 className="mt-4 flex items-center justify-center gap-2 text-lg font-extrabold text-clay-dark sm:text-xl">
                {l.emptyTitle}{" "}
                <Hand size={22} className="shrink-0 text-clay-primary" />
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
                const showPipeline =
                  (chat.streaming.webResults.length > 0 ||
                    chat.streaming.webStage !== null) &&
                  idx === chat.renderedMessages.length - 1;
                // Pesan user sebelumnya → untuk hitung lama AI menjawab.
                const prevMsg =
                  idx > 0 ? chat.renderedMessages[idx - 1] : null;
                return (
                  <div key={m.id} className="space-y-4">
                    {showPipeline && (
                      <WebSearchPipeline
                        stage={chat.streaming.webStage}
                        results={chat.streaming.webResults}
                        completed={!chat.sending && !chat.hasError}
                      />
                    )}
                    <MessageBubble
                      message={m}
                      isStreaming={chat.sending && idx === chat.renderedMessages.length - 1 && m.id.startsWith("stream-")}
                      thinking={chat.sending && idx === chat.renderedMessages.length - 1 ? chat.streaming.thinking : null}
                      prevMessage={prevMsg}
                      videoEnabled={isBeta}
                      onViewVideo={(url) => {
                        // Pertahanan berlapis: hanya beta bisa membuka View.
                        if (isBeta) setViewVideo({ url });
                      }}
                    />
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
                      <Crown size={16} /> {l.upgrade}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — minta "buat catatan" → wizard F&Q menyatu, bukan chat */}
        <Composer
          userId={getUserId()}
          sending={chat.sending}
          disabled={chat.loading || chat.sessionsLoading}
          initialMentions={importedNoteId ? [importedNoteId] : []}
          isBeta={isBeta}
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
          onSend={(input) => {
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
            if (detectNoteIntent(input.question).isNoteRequest) {
              // Topik yang sedang dibahas di chat ikut jadi materi catatan —
              // hanya untuk beta tester (akses lewat /join). Non-beta tetap
              // bisa buat catatan seperti biasa (tanpa konteks percakapan).
              // Pesan kosong (placeholder optimis/streaming) disaring di sini
              // agar tidak pernah menjadi materi sumber null.
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
        />
      </main>

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
      <AiCallModal open={callOpen} onClose={() => setCallOpen(false)} />

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
