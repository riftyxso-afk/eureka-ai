"use client";

/**
 * AssistantHub — pengalaman asisten AI dari halaman Home yang kini hidup
 * di Dashboard (lihat change merge-home-into-dashboard).
 * Perilaku identik: launcher sesi chat (composer → buat sesi → /chat/[id]),
 * intent buat catatan/gambar, lampiran, panggilan AI (beta), tutorial.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Brain, PenLine } from "lucide-react";
import EurekaOrb from "@/components/ui/EurekaOrb";
import TutorialHost from "@/components/tutorial/TutorialHost";
import NoteActions from "@/components/asisten/NoteActions";
import TaskActions from "@/components/asisten/TaskActions";
import { mayManageNote, parseNoteCommand, proposeNoteCommand, type NoteCommand } from "@/lib/assistant/noteCommands";
import { mayManageTask, parseTaskCommand, proposeTaskCommand, type TaskCommand } from "@/lib/assistant/taskCommands";
import { apiFetch } from "@/lib/apiClient";
import { getUserId, setUserId } from "@/lib/identity";
import { supabase } from "@/lib/supabase/client";
import { PENDING_PROMPT_KEY } from "@/lib/assistant/pendingPrompt";
import type { ChatAttachment } from "@/lib/assistant/types";
import { useAssistantChat } from "@/lib/assistant/useAssistantChat";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { detectImageIntent } from "@/lib/assistant/imageIntent";
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageGenerationOverlay } from "@/components/note/ImageGenerationOverlay";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar, { MobileSessionButton } from "@/components/asisten/ChatSidebar";
import MomoCompanion, { type MomoMode } from "@/components/asisten/MomoCompanion";
import Composer from "@/components/asisten/Composer";
import AiCallModal from "@/components/assistant/AiCallModal";
import { useBeta } from "@/lib/useBeta";
import { useI18n } from "@/context/LocaleContext";

export default function AssistantHub({ standalone = false }: { standalone?: boolean }) {
  const [noteCommand, setNoteCommand] = useState<NoteCommand | null>(null);
  const [taskCommand, setTaskCommand] = useState<TaskCommand | null>(null);
  const [planningAction, setPlanningAction] = useState(false);
  const planningLock = useRef(false);
  const router = useRouter();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [launching, setLaunching] = useState<{ prompt: string } | null>(null);
  const [momoMode, setMomoMode] = useState<MomoMode>("normal");
  const [momoMoving, setMomoMoving] = useState(false);
  const [modelMenuHeight, setModelMenuHeight] = useState(0);
  const [notePrompt, setNotePrompt] = useState<string | null>(null);
  const [wizardPrompt, setWizardPrompt] = useState<string | null>(null);
  const [notePrefs, setNotePrefs] = useState<NoteCreatePrefs | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [loadingCard, setLoadingCard] = useState<"tanya" | "tugas" | null>(null);
  const { isBeta } = useBeta();
  const { dict, locale } = useI18n();
  const l = dict.home;
  const heroAnchor = useRef<HTMLDivElement>(null);
  const composerAnchor = useRef<HTMLDivElement>(null);
  const [momoPosition, setMomoPosition] = useState<{ x: number; y: number; scale: number } | null>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (!standalone) return;
    const anchor = momoMoving ? composerAnchor.current : heroAnchor.current;
    if (!anchor) return;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      setMomoPosition((previous) => {
        const next = { x: rect.left, y: rect.top, scale: rect.width / 190 };
        return previous && previous.x === next.x && previous.y === next.y && previous.scale === next.scale ? previous : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [standalone, momoMoving]);

  const chat = useAssistantChat({
    sessionId: null,
    onSessionCreated: (id) => router.push(`/chat/${id}`),
  });

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
      setLaunchError(null);
      setNeedsLogin(false);
      const command = parseNoteCommand(input.question);
      if (command) {
        setTaskCommand(null);
        setNoteCommand(command);
        return;
      }

      const task = parseTaskCommand(input.question);
      if (task) { setNoteCommand(null); setTaskCommand(task); return; }

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

      if (standalone) setMomoMoving(true);
      setLaunching({ prompt: input.question });

      let sessionId: string | null = null;
      try {
        const { data: authData } = await supabase?.auth.getSession() ?? { data: { session: null } };
        const userId = authData.session?.user.id;
        if (!userId) {
          setLaunchError("Masuk ke akunmu untuk menggunakan AI dan menyimpan riwayat percakapan.");
          setNeedsLogin(true);
          setComposerPrefill(input.question);
          setComposerKey((key) => key + 1);
          setMomoMoving(false);
          setLaunching(null);
          return;
        }
        setUserId(userId);
        const res = await apiFetch("/api/assistant/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = (await res.json()) as { session?: { id: string }; error?: string };
        if (!res.ok) throw new Error(data.error || "Percakapan belum bisa dibuat.");
        sessionId = data.session?.id ?? null;
      } catch (error) {
        setLaunchError(error instanceof Error ? error.message : "Percakapan belum bisa dibuat. Periksa koneksi lalu coba lagi.");
      }
      if (!sessionId) {
        setComposerPrefill(input.question);
        setComposerKey((key) => key + 1);
        setMomoMoving(false);
        setLaunching(null);
        return;
      }

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
      router.push(`/chat/${sessionId}`);
    },
    [launching, router, standalone]
  );

  return (
    <div className={standalone ? "momo-chat-shell flex h-dvh overflow-hidden" : "flex h-full min-h-[560px] flex-col overflow-hidden bg-transparent"}>
      {/* ChatSidebar desktop rail disembunyikan di dalam Dashboard agar kolom chat dapat lebar penuh;
          riwayat tetap via MobileSessionButton di topbar */}
      <div className={standalone ? "momo-chat-sidebar" : "hidden"}>
        <ChatSidebar
          sessions={chat.sessions}
          activeId={null}
          onNew={() => { setLaunchError(null); setNeedsLogin(false); setMomoMoving(false); setComposerPrefill(""); setComposerKey((key) => key + 1); }}
          onSelect={(id) => router.push(`/chat/${id}`)}
          onRename={chat.renameSession}
          onDelete={async (id) => {
          await chat.deleteSession(id);
        }}
      />
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        {standalone && momoPosition && <motion.div className="momo-travelling-companion" aria-hidden="true" initial={false}
          animate={{ ...momoPosition, y: momoPosition.y - (momoMoving ? modelMenuHeight : 0) }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.7, bounce: 0.2 }}>
          <MomoCompanion mode={momoMode} question={launching?.prompt ?? ""} thinking={!!launching} />
        </motion.div>}
        {standalone && <header className="momo-chat-header"><div className="momo-mobile-history"><MobileSessionButton sessions={chat.sessions} onSelect={(id) => router.push(`/chat/${id}`)} /></div><strong>Chat baru</strong><Link href="/dashboard">← Dashboard</Link></header>}

        {/* Minimal Perplexity-style landing */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="momo-start-content mx-auto flex min-h-full w-full max-w-[720px] flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
            {/* Heading */}
            {standalone && !momoMoving && <div ref={heroAnchor} className="momo-chat-hero" aria-hidden="true" />}
            <div className="w-full text-center">
              {!standalone && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-clay-muted">Belajar</p>}
              <h2 className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-clay-dark sm:text-[36px]">
                {locale === "en" ? "What would you like to learn?" : "Apa yang ingin Anda pelajari?"}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[13px] font-semibold leading-relaxed text-clay-muted">
                {locale === "en"
                  ? "Momo can help you understand a topic, work through a problem, or create a summary."
                  : "Momo dapat membantu Anda memahami materi, mengerjakan soal, atau membuat ringkasan."}
              </p>
            </div>

            {/* Composer — focal point */}
            <div className="momo-start-composer mt-8 w-full">
              {noteCommand && <NoteActions key={JSON.stringify(noteCommand)} command={noteCommand} onClose={() => setNoteCommand(null)} onChoose={setNoteCommand} />}
              {taskCommand && <TaskActions key={JSON.stringify(taskCommand)} command={taskCommand} onClose={() => setTaskCommand(null)} onChoose={setTaskCommand} />}
              {planningAction && <p role="status" className="mb-2 text-sm text-clay-muted">Momo sedang memahami permintaan Anda…</p>}
              {momoMoving && <div ref={composerAnchor} className="momo-preview-companion" aria-hidden="true" />}
              <Composer
                reactBits={standalone}
                onModelMenuHeightChange={setModelMenuHeight}
                onMomoModeChange={setMomoMode}
                key={composerKey}
                userId={getUserId()}
                sending={!!launching}
                disabled={planningAction || !!launching || (!standalone && chat.sessionsLoading)}
                placeholder={standalone ? "Tanya Eureka apa saja…" : "Ketik @ untuk fitur"}
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
              {!noteCommand && <button type="button" onClick={() => setNoteCommand({ action: "list", title: "" })} className="mt-1 min-h-11 px-2 text-sm font-bold text-clay-primary">Kelola catatan dengan Momo</button>}
            </div>

            {launchError && <p role="alert" className="momo-launch-error">{launchError}{needsLogin && <> <Link href="/login?next=%2Fchat">Masuk</Link></>}</p>}
            {/* Two suggestion tiles only — isi ke composer, tidak langsung kirim */}
            {!standalone && (
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
            )}
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

    </div>
  );
}
