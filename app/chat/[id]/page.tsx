"use client";

import { useEffect, useRef, useState } from "react";
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
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageGenerationOverlay } from "@/components/note/ImageGenerationOverlay";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar, { MobileSessionButton } from "@/components/asisten/ChatSidebar";
import MessageBubble from "@/components/asisten/MessageBubble";
import WebSearchPipeline from "@/components/asisten/WebSearchPipeline";
import Composer from "@/components/asisten/Composer";
import TutorialHost from "@/components/tutorial/TutorialHost";
import type { ChatAttachment } from "@/lib/assistant/types";
import { LayoutDashboard } from "lucide-react";
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
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);

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
              remaining.length > 0 ? `/chat/${remaining[0].id}` : "/home"
            );
          }
        }}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-clay sm:border-2 sm:border-clay-borderLight sm:shadow-clay-sm">
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
                    aria-label="Buka Dashboard"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-md bg-white text-clay-primary shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 lg:hidden"
                  >
                    <LayoutDashboard size={18} />
                  </Link>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo Eureka.AI" className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-extrabold text-clay-dark sm:text-base">
                      {activeSession?.title ?? "Chat Eureka"}
                    </h1>
                    <p className="hidden text-[11px] font-bold text-clay-muted sm:block">
                      Punya akses ke catatan, bab & progresmu
                    </p>
                  </div>
                </div>
                <button
                  onClick={chat.handleNew}
                  className="btn-clay-ghost !min-h-[40px] !px-3 !py-2 text-xs sm:!px-4"
                  data-testid="chat-new-top"
                >
                  <span className="sm:hidden">+ Baru</span>
                  <span className="hidden sm:inline">+ Chat Baru</span>
                </button>
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
            <div className="py-16 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-clay-primary/30 border-t-clay-primary" />
              <p className="mt-4 text-sm font-bold text-clay-muted">
                Memuat percakapan…
              </p>
            </div>
          ) : chat.renderedMessages.length === 0 ? (
            <div className="py-14 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Eureka" className="mx-auto h-16 w-16 object-contain" />
              <h2 className="mt-4 text-lg font-extrabold text-clay-dark sm:text-xl">
                Halo! 👋 Ada yang mau ditanya atau dipelajari?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-clay-muted">
                Eureka bisa meringkas catatanmu, menjelaskan bab yang sulit,
                menyusun rencana belajar, atau menjawab soal. Ketik{" "}
                <span className="rounded-clay-full bg-clay-primary/15 px-1.5 py-0.5 font-extrabold text-clay-primary">@</span>{" "}
                untuk melampirkan catatan.
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
                return (
                  <div key={m.id} className="space-y-4">
                    {showPipeline && (
                      <WebSearchPipeline
                        stage={chat.streaming.webStage}
                        results={chat.streaming.webResults}
                        completed={!chat.sending && !chat.hasError}
                      />
                    )}
                    <MessageBubble message={m} />
                  </div>
                );
              })}
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
            </div>
          )}
        </div>

        {/* Composer — minta "buat catatan" → wizard F&Q menyatu, bukan chat */}
        <Composer
          userId={getUserId()}
          sending={chat.sending}
          disabled={chat.loading || chat.sessionsLoading}
          initialMentions={importedNoteId ? [importedNoteId] : []}
          noteWizardPrompt={wizardPrompt}
          onNoteWizardClose={() => setWizardPrompt(null)}
          onNoteWizardStart={(prefs) => {
            setNotePrefs(prefs);
            setNotePrompt(wizardPrompt);
            setWizardPrompt(null);
          }}
          onSend={(input) => {
            // "buat gambar" → generate gambar AI sesuai topik percakapan.
            if (detectImageIntent(input.question).isImageRequest) {
              setImagePrompt(input.question);
              return;
            }
            if (detectNoteIntent(input.question).isNoteRequest) {
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
        onClose={() => {
          setNotePrompt(null);
          setNotePrefs(null);
        }}
      />

      {/* Overlay generate gambar AI — pakai konteks percakapan agar sesuai topik */}
      <ImageGenerationOverlay
        open={!!imagePrompt}
        prompt={imagePrompt ?? ""}
        history={chat.renderedMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }))
          .slice(-10)}
        onClose={() => setImagePrompt(null)}
      />



      {/* Tutorial realtime (berlanjut dari /home bila sedang aktif) */}
      <TutorialHost />
    </div>
  );
}
