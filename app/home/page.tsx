"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChevronRight,
  FileText,
  Layers,
  LayoutDashboard,
  Moon,
  PenLine,
  Plus,
  Sparkles,
  Sun,
  Sunset,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import TutorialHost from "@/components/tutorial/TutorialHost";
import EmptyNotesCta from "@/components/tutorial/EmptyNotesCta";
import { apiFetch } from "@/lib/apiClient";
import { getUserId, getUserName } from "@/lib/identity";
import { getSession } from "@/lib/auth";
import { PENDING_PROMPT_KEY } from "@/lib/assistant/pendingPrompt";
import type { ChatAttachment } from "@/lib/assistant/types";
import { useAssistantChat } from "@/lib/assistant/useAssistantChat";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { detectImageIntent } from "@/lib/assistant/imageIntent";
import { NoteProgressOverlay } from "@/components/note/NoteProgressOverlay";
import { ImageGenerationOverlay } from "@/components/note/ImageGenerationOverlay";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import ChatSidebar, { MobileSessionButton } from "@/components/asisten/ChatSidebar";
import Composer from "@/components/asisten/Composer";
import AiCallModal from "@/components/assistant/AiCallModal";
import { useBeta } from "@/lib/useBeta";

interface FeatureChip {
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Chat: klik → langsung kirim prompt ke AI. */
  prompt?: string;
  /** Navigasi: klik → pindah ke halaman ini. */
  href?: string;
}

const FEATURES: FeatureChip[] = [
  {
    icon: BookOpen,
    title: "Ringkas Materi",
    desc: "Ringkas catatan belajarmu",
    prompt: "Ringkas materi pelajaran yang sedang saya pelajari berdasarkan catatan saya.",
  },
  {
    icon: Brain,
    title: "Jelaskan Analogi",
    desc: "Konsep sulit jadi gampang",
    prompt: "Jelaskan konsep yang sedang saya pelajari dengan analogi sederhana yang mudah dipahami.",
  },
  {
    icon: Target,
    title: "Rencana Belajar",
    desc: "Siapkan jadwal ujian",
    prompt: "Buatkan rencana belajar mingguan untuk persiapan ujian saya.",
  },
  {
    icon: PenLine,
    title: "Bantu Soal",
    desc: "Langkah demi langkah",
    prompt: "Bantu saya mengerjakan soal latihan berikut langkah demi langkah.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    desc: "Buat kartu hafalan dari catatan",
    prompt: "Buatkan kartu hafalan (flashcards) dari catatan saya untuk dihafal.",
  },
  {
    icon: FileText,
    title: "Kuis Latihan",
    desc: "Latihan pilihan ganda",
    prompt: "Buatkan kuis latihan pilihan ganda dari materi yang sedang saya pelajari.",
  },
  {
    icon: CalendarDays,
    title: "Jadwal Belajar",
    desc: "Kelola jadwal & rutinitas",
    href: "/dashboard/jadwal",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    desc: "Lihat peringkat belajarmu",
    href: "/dashboard/leaderboard",
  },
];

function greetingText(): { icon: LucideIcon; text: string } {
  const h = new Date().getHours();
  const icon = h < 6 ? Moon : h < 12 ? Sun : h < 17 ? Sun : h < 21 ? Sunset : Moon;
  const part =
    h < 6
      ? "Selamat malam"
      : h < 12
        ? "Selamat pagi"
        : h < 17
          ? "Selamat siang"
          : h < 21
            ? "Selamat sore"
            : "Selamat malam";
  return { icon, text: part };
}

export default function HomePage() {
  const router = useRouter();
  const [launching, setLaunching] = useState<{ prompt: string } | null>(null);
  const [notePrompt, setNotePrompt] = useState<string | null>(null);
  const [wizardPrompt, setWizardPrompt] = useState<string | null>(null);
  const [notePrefs, setNotePrefs] = useState<NoteCreatePrefs | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const { isBeta } = useBeta();
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = useAssistantChat({
    sessionId: null,
    onSessionCreated: (id) => router.push(`/chat/${id}`),
  });

  // Jumlah catatan user — untuk banner "belum punya catatan" + tutorial.
  const [notesCount, setNotesCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = getUserId();
      if (!uid) {
        setNotesCount(null);
        return;
      }
      try {
        const res = await apiFetch(`/api/notes?userId=${encodeURIComponent(uid)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { notes?: unknown[] };
        if (!cancelled) {
          setNotesCount(Array.isArray(data.notes) ? data.notes.length : null);
        }
      } catch {
        if (!cancelled) setNotesCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (launchTimer.current) clearTimeout(launchTimer.current);
    };
  }, []);

  const name = useMemo(() => {
    const session = getSession();
    const raw = session?.name || getUserName();
    return raw.trim().split(" ")[0] || "Teman Belajar";
  }, []);

  const greeting = greetingText();

  /** Buat sesi → simpan prompt → animasi → pindah ke /chat/[id]. */
  const launchChat = useCallback(
    async (input: {
      question: string;
      mentions: string[];
      webSearch?: boolean;
      attachment?: ChatAttachment | null;
      speedMode?: "fast" | "normal" | "deep";
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
    <div className="flex h-dvh gap-0 bg-clay-beige p-0 sm:gap-4 sm:p-4">
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

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-clay sm:border-2 sm:border-clay-borderLight sm:shadow-clay-sm">
        {/* Topbar */}
        <header className="flex items-center justify-between gap-2 border-b-[3px] border-clay-borderLight px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
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
                Beranda Eureka
              </h1>
              <p className="hidden text-[11px] font-bold text-clay-muted sm:block">
                Chat dengan AI yang mengenal catatan & progresmu
              </p>
            </div>
          </div>
          <button
            onClick={chat.handleNew}
            className="btn-clay-ghost !min-h-[40px] !px-3 !py-2 text-xs sm:!px-4"
            aria-label="Chat baru"
            data-testid="home-new-top"
          >
            <Plus size={16} />
          </button>
        </header>

        {/* Konten: greeting + suggestion chips (scroll di sini) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-5 sm:px-6 sm:py-6">
          {/* Banner pengguna baru yang belum punya catatan + ajakan tutorial */}
          <EmptyNotesCta notesCount={notesCount} />

          <div className="mx-auto flex min-h-[52vh] max-w-2xl flex-col items-center justify-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-clay-full border-3 border-clay-secondary/30 bg-clay-secondary/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-clay-secondary">
              <Sparkles size={13} /> Asisten Belajar Eureka
            </span>
            <h1 className="mt-5 flex items-center justify-center gap-2 text-[27px] font-extrabold text-clay-dark sm:text-4xl">
              <greeting.icon size={28} className="shrink-0 text-clay-primary" />
              Halo, {name}!
            </h1>
            <p className="mt-3 max-w-md text-base font-semibold leading-relaxed text-clay-muted">
              Tanyakan apa saja — Eureka menjawab berdasarkan catatan, bab,
              subjek, dan progres belajarmu. Ketik{" "}
              <span className="rounded-clay-full bg-clay-primary/15 px-1.5 py-0.5 font-extrabold text-clay-primary">@</span>{" "}
              untuk melampirkan catatan tertentu.
            </p>

            <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => {
                const card = (
                  <span className="flex h-full w-full items-start gap-3 rounded-clay-md border-2 border-clay-borderLight bg-clay-beige/50 p-3.5 text-left shadow-clay-sm transition-all duration-75 group-hover:-translate-y-1 group-hover:border-clay-primary/50 group-hover:bg-white group-hover:shadow-[0_5px_0_#D1C4B4]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                      <f.icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[13px] font-extrabold text-clay-dark group-hover:text-clay-primary">
                        {f.title}
                        <ChevronRight size={13} className="shrink-0 text-clay-muted" />
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold leading-snug text-clay-muted">
                        {f.desc}
                      </span>
                    </span>
                  </span>
                );

                if (f.href) {
                  return (
                    <Link
                      key={f.title}
                      href={f.href}
                      className="group"
                      data-testid={`home-feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {card}
                    </Link>
                  );
                }
                return (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() =>
                      f.prompt && launchChat({ question: f.prompt, mentions: [] })
                    }
                    className="group"
                    data-testid={`home-feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {card}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Composer ringkas — wizard "buat catatan" menyatu di atasnya */}
        <Composer
          userId={getUserId()}
          sending={false}
          disabled={!!launching || chat.sessionsLoading}
          compact
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
              className="w-full max-w-xl rounded-clay-md border-3 border-clay-primary/30 bg-white px-6 py-5 shadow-clay-lg"
            >
              <p className="whitespace-pre-wrap text-base font-semibold leading-6 text-clay-dark">
                {launching.prompt}
              </p>
            </motion.div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-clay-primary/30 border-t-clay-primary" />
              <p className="text-sm font-bold text-clay-muted">
                Menghubungkan ke Eureka…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
