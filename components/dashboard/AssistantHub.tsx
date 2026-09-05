"use client";

/**
 * AssistantHub — pengalaman asisten AI dari halaman Home yang kini hidup
 * di Dashboard (lihat change merge-home-into-dashboard).
 * Perilaku identik: launcher sesi chat (composer → buat sesi → /chat/[id]),
 * intent buat catatan/gambar, lampiran, panggilan AI (beta), tutorial.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, PenLine } from "lucide-react";
import EurekaOrb from "@/components/ui/EurekaOrb";
import TutorialHost from "@/components/tutorial/TutorialHost";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { PENDING_PROMPT_KEY } from "@/lib/assistant/pendingPrompt";
import type { ChatAttachment } from "@/lib/assistant/types";
import { useAssistantChat } from "@/lib/assistant/useAssistantChat";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { detectImageIntent } from "@/lib/assistant/imageIntent";
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageGenerationOverlay } from "@/components/note/ImageGenerationOverlay";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar from "@/components/asisten/ChatSidebar";
import Composer from "@/components/asisten/Composer";
import AiCallModal from "@/components/assistant/AiCallModal";
import { useBeta } from "@/lib/useBeta";
import { useI18n } from "@/context/LocaleContext";

export default function AssistantHub() {
  const router = useRouter();
  const [launching, setLaunching] = useState<{ prompt: string } | null>(null);
  const [notePrompt, setNotePrompt] = useState<string | null>(null);
  const [wizardPrompt, setWizardPrompt] = useState<string | null>(null);
  const [notePrefs, setNotePrefs] = useState<NoteCreatePrefs | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [loadingCard, setLoadingCard] = useState<"tanya" | "tugas" | null>(null);
  const { isBeta } = useBeta();
  const { dict } = useI18n();
  const l = dict.home;
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = useAssistantChat({
    sessionId: null,
    onSessionCreated: (id) => router.push(`/chat/${id}`),
  });

  useEffect(() => {
    return () => {
      if (launchTimer.current) clearTimeout(launchTimer.current);
    };
  }, []);

  /** Buat sesi → simpan prompt → animasi → pindah ke /chat/[id]. */
  const launchChat = useCallback(
    async (input: {
      question: string;
      mentions: string[];
      webSearch?: boolean;
      attachment?: ChatAttachment | null;
      speedMode?: "fast" | "normal" | "deep";
      model?: string;
    }) => {
      if (launching) return;

      // Permintaan "buat gambar" → generate gambar AI (sesuai deskripsi/topik).
      if (detectImageIntent(input.question).isImageRequest) {
        setImagePrompt(input.question);
        return;
      }

      // Permintaan "buat catatan" → tanya preferensi dulu (wizard F&Q),
      // lalu generate catatan + overlay loading.
      if (detectNoteIntent(input.question).isNoteRequest) {
        setWizardPrompt(input.question);
        return;
      }

      const userId = getUserId();
      if (!userId) return;

      let sessionId: string | null = null;
      try {
        const res = await apiFetch("/api/assistant/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = (await res.json()) as { session?: { id: string } };
        sessionId = data.session?.id ?? null;
      } catch {
        // gagal membuat sesi — biarkan pengguna mencoba lagi
      }
      if (!sessionId) return;

      sessionStorage.setItem(
        PENDING_PROMPT_KEY,
        JSON.stringify({
          prompt: input.question,
          mentions: input.mentions,
          webSearch: input.webSearch === true,
          attachment: input.attachment ?? null,
          speedMode: input.speedMode ?? "normal",
          model: input.model,
        })
      );
      await chat.refreshSessions();
      setLaunching({ prompt: input.question });
      if (launchTimer.current) clearTimeout(launchTimer.current);
      launchTimer.current = setTimeout(() => {
        router.push(`/chat/${sessionId}`);
      }, 900);
    },
    [launching, chat, router]
  );

  return (
    <div className="flex h-full min-h-[560px] flex-col overflow-hidden bg-transparent">
      {/* ChatSidebar desktop rail disembunyikan di dalam Dashboard agar kolom chat dapat lebar penuh;
          riwayat tetap via MobileSessionButton di topbar */}
      <div className="hidden">
        <ChatSidebar
          sessions={chat.sessions}
          activeId={null}
          onNew={chat.handleNew}
          onSelect={(id) => router.push(`/chat/${id}`)}
          onRename={chat.renameSession}
          onDelete={async (id) => {
          await chat.deleteSession(id);
        }}
      />
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">

        {/* Minimal Perplexity-style landing */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
            {/* Heading */}
            <div className="w-full text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-clay-muted">
                Belajar
              </p>
              <h2 className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-clay-dark sm:text-[36px]">
                Apa yang mau kamu pelajari?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[13px] font-semibold leading-relaxed text-clay-muted">
                Tanya apa saja, kerjakan tugas, atau buat ringkasan materi — Eureka siap membantu.
              </p>
            </div>

            {/* Composer — focal point */}
            <div className="mt-8 w-full">
              <Composer
                key={composerKey}
                userId={getUserId()}
                sending={false}
                disabled={!!launching || chat.sessionsLoading}
                placeholder="Ketik @ untuk fitur"
                initialValue={composerPrefill}
                isBeta={isBeta}
                onCall={() => setCallOpen(true)}
                noteWizardPrompt={wizardPrompt}
                onNoteWizardClose={() => setWizardPrompt(null)}
                onNoteWizardStart={(prefs) => {
                  setNotePrefs(prefs);
                  setNotePrompt(wizardPrompt);
                  setWizardPrompt(null);
                }}
                onSend={launchChat}
              />
            </div>

            {/* Two suggestion tiles only — isi ke composer, tidak langsung kirim */}
            <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (loadingCard) return;
                  setLoadingCard("tanya");
                  setComposerPrefill("Jelaskan materi ini dengan analogi sederhana");
                  setComposerKey((k) => k + 1);
                  setTimeout(() => setLoadingCard(null), 450);
                }}
                className="group flex items-start gap-3 rounded-clay-md border border-clay-borderLight/60 bg-clay-cream p-4 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-clay-primary/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] active:translate-y-0 dark:border-clay-borderLight/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                  {loadingCard === "tanya" ? (
                    <EurekaOrb variant="thinking" scale="inline" label="Menjelaskan dengan analogi" />
                  ) : (
                    <Brain size={18} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-clay-dark">Tanya Apa Saja</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-snug text-clay-muted">
                    {loadingCard === "tanya" ? "Menjelaskan dengan analogi..." : "Tanyakan konsep sulit dengan analogi mudah"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (loadingCard) return;
                  setLoadingCard("tugas");
                  setComposerPrefill("Bantu aku mengerjakan tugas ini langkah demi langkah");
                  setComposerKey((k) => k + 1);
                  setTimeout(() => setLoadingCard(null), 450);
                }}
                className="group flex items-start gap-3 rounded-clay-md border border-clay-borderLight/60 bg-clay-cream p-4 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-clay-primary/40 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] active:translate-y-0 dark:border-clay-borderLight/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-md bg-emerald-500/10 text-emerald-600">
                  {loadingCard === "tugas" ? (
                    <EurekaOrb variant="working" scale="inline" label="Menyusun langkah" />
                  ) : (
                    <PenLine size={18} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-clay-dark">Kerjakan Tugas</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-snug text-clay-muted">
                    {loadingCard === "tugas" ? "Menyusun langkah penyelesaian..." : "Selesaikan soal dengan penjelasan langkah demi langkah"}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Overlay pembuatan catatan (saat user minta "buat catatan") */}
      <NoteProgressOverlay
        open={!!notePrompt}
        prompt={notePrompt ?? ""}
        prefs={notePrefs ?? undefined}
        onClose={() => {
          setNotePrompt(null);
          setNotePrefs(null);
        }}
      />

      {/* Overlay generate gambar AI (saat user minta "buat gambar") */}
      <ImageGenerationOverlay
        open={!!imagePrompt}
        prompt={imagePrompt ?? ""}
        onClose={() => setImagePrompt(null)}
      />

      {/* Panggilan suara AI (beta) */}
      <AiCallModal open={callOpen} onClose={() => setCallOpen(false)} />

      {/* Tutorial realtime untuk pengguna baru (spotlight) */}
      <TutorialHost />

      {/* Animasi kirim: bubble prompt terbang dari composer → layar penuh */}
      <AnimatePresence>
        {launching && (
          <motion.div
            key="launch-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-clay-beige px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 90, scale: 0.6, borderRadius: 24 }}
              animate={{ opacity: 1, y: 0, scale: 1, borderRadius: 16 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="w-full max-w-xl rounded-clay-md border-3 border-clay-primary/30 bg-clay-cream px-6 py-5 shadow-clay-lg"
            >
              <p className="whitespace-pre-wrap text-base font-semibold leading-6 text-clay-dark">
                {launching.prompt}
              </p>
            </motion.div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-clay-primary/30 border-t-clay-primary" />
              <p className="text-sm font-bold text-clay-muted">
                {l.connecting}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
