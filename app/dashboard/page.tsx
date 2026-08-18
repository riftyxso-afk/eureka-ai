"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileQuestion,
  FileText,
  Flame,
  Hand,
  Medal,
  Origami,
  Plus,
  Rocket,
  Search,
  Trophy,
  X,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { NoteItem } from "@/components/dashboard/NoteItem";
import { CreateNoteModal } from "@/components/dashboard/CreateNoteModal";
import { BackgroundJobPopup } from "@/components/dashboard/BackgroundJobPopup";
import { DashboardPreparing } from "@/components/dashboard/DashboardPreparing";
import TutorialHost from "@/components/tutorial/TutorialHost";
import { Reveal } from "@/components/ui/Reveal";
import { useOnboarding } from "@/context/OnboardingContext";
import { useI18n } from "@/context/LocaleContext";
import { getUserId, getUserName } from "@/lib/identity";
import { announceLevelUp } from "@/lib/levelUp";
import type { Locale, Dictionary } from "@/lib/i18n";
import type { Note } from "@/lib/types";

function formatUpdatedAt(
  iso: string,
  l: Dictionary["dashboard"],
  locale: Locale
): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return l.justNow;
  if (diff < 3_600_000) {
    return l.minutesAgo.replace("{n}", String(Math.floor(diff / 60_000)));
  }
  if (d.toDateString() === new Date().toDateString()) {
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    return l.todayAt.replace("{time}", time);
  }
  return `${d.getDate()} ${d.toLocaleDateString(
    locale === "en" ? "en-US" : "id-ID",
    { month: "short" }
  )}`;
}

function getGreeting(l: Dictionary["dashboard"]): string {
  const h = new Date().getHours();
  if (h < 11) return l.greetingMorning;
  if (h < 15) return l.greetingAfternoon;
  if (h < 19) return l.greetingEvening;
  return l.greetingNight;
}

export default function DashboardPage() {
  const { data } = useOnboarding();
  const { locale, dict } = useI18n();
  const l = dict.dashboard;
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"semua" | "terbaru">("semua");
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Menunda render dashboard: setelah onboarding selesai tampilkan dulu
  // layar "Menyiapkan dashboardmu..." sebelum konten muncul.
  // Flag dibaca sekali di initializer (aman dari StrictMode double-effect).
  const [prepareOn] = useState(() => {
    try {
      return sessionStorage.getItem("eureka_dashboard_prepare") === "1";
    } catch {
      return false;
    }
  });
  const [ready, setReady] = useState(!prepareOn);
  const [progress, setProgress] = useState({
    xp: 0,
    level: 1,
    xpInLevel: 0,
    xpToNext: 100,
    levelTitle: "PELAJAR KONSISTEN",
    streak: 0,
    longestStreak: 0,
    totalDays: 0,
    dueCards: 0,
    rank: null as number | null,
  });

  const userName = data.name || getUserName();

  // Layar "Menyiapkan dashboardmu..." (flag di-set oleh halaman onboarding).
  useEffect(() => {
    try {
      sessionStorage.removeItem("eureka_dashboard_prepare");
    } catch {
      // abaikan
    }
    const t = setTimeout(() => setReady(true), prepareOn ? 1700 : 120);
    return () => clearTimeout(t);
  }, [prepareOn]);

  // Banner info versi pengembangan — bisa ditutup, diingat di localStorage.
  const [bannerHidden, setBannerHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("eureka-dev-banner-hidden") === "1";
    } catch {
      return false;
    }
  });
  const hideBanner = () => {
    setBannerHidden(true);
    try {
      localStorage.setItem("eureka-dev-banner-hidden", "1");
    } catch {
      // abaikan
    }
  };

  const lastLevelRef = useRef<number | null>(null);

  const loadProgress = async () => {
    try {
      const userId = getUserId();
      const res = await apiFetch(`/api/progress?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const payload = await res.json();
      if (payload.stats) {
        setProgress(payload.stats);
        const newLevel = Number(payload.stats.level) || 1;
        if (lastLevelRef.current === null) {
          lastLevelRef.current = newLevel;
        } else if (newLevel > lastLevelRef.current) {
          lastLevelRef.current = newLevel;
          announceLevelUp(newLevel);
        } else {
          lastLevelRef.current = newLevel;
        }
      }
    } catch {
      // biarkan
    }
  };

  useEffect(() => {
    loadProgress();
    const userId = getUserId();
    apiFetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activity", userId, xp: 0 }),
    }).catch(() => {});
    const timer = setInterval(loadProgress, 8000);
    return () => clearInterval(timer);
  }, []);

  const loadNotes = useMemo(
    () => async () => {
      try {
        const res = await apiFetch(
          `/api/notes?userId=${encodeURIComponent(getUserId())}`
        );
        if (!res.ok) return;
        const payload = await res.json();
        setNotes(payload.notes ?? []);
      } catch {
        // biarkan daftar kosong
      } finally {
        setNotesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Catatan baru selesai dirangkum di latar belakang → muat ulang daftar.
  useEffect(() => {
    const refresh = () => {
      void loadNotes();
      loadProgress();
    };
    window.addEventListener("note-ready", refresh);
    return () => window.removeEventListener("note-ready", refresh);
  }, [loadNotes, loadProgress]);

  // Dukungan filter dari ?subject= (misal dari halaman Mata Pelajaran)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subject = params.get("subject");
    if (subject) setSearchQuery(subject);
  }, []);

  // Catatan tersemat (pin) selalu tampil paling atas; di dalam grup,
  // filter "terbaru" mengurutkan createdAt desc, selainnya urutan API.
  const filteredNotes = useMemo(() => {
    let list = notes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.subject.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const pa = a.pinned === true ? 0 : 1;
      const pb = b.pinned === true ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return activeFilter === "terbaru"
        ? b.createdAt.localeCompare(a.createdAt)
        : 0;
    });
  }, [notes, searchQuery, activeFilter]);

  // Toggle semat (pin) catatan — optimistic, rollback bila gagal.
  const togglePin = async (id: string, pinned: boolean) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned } : n))
    );
    try {
      const res = await apiFetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error(l.errPin);
    } catch {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
      );
    }
  };

  const handleCreate = (note: Note) => {
    setNotes((prev) => [note, ...prev]);
    setIsModalOpen(false);
  };

  // Hapus catatan dari kartu dashboard (konfirmasi + hapus permanen).
  const deleteNote = async (id: string) => {
    if (!window.confirm(l.confirmDelete)) return;
    try {
      const res = await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        alert(d?.error ?? l.errDelete);
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert(l.errDeleteRetry);
    }
  };

  const chips: { id: "semua" | "terbaru"; label: string }[] = [
    { id: "semua", label: l.allSubjects },
    { id: "terbaru", label: l.newest },
  ];

  return (
    <div className="pb-24">
      <AnimatePresence>{!ready && <DashboardPreparing />}</AnimatePresence>
      {ready && (
      <main className="mx-auto w-full max-w-clay px-4 sm:px-6">
        {!bannerHidden && (
          <Reveal delay={0}>
          <div className="mb-4 flex items-center gap-2 rounded-clay-md border-2 border-amber-300 bg-amber-50 px-3 py-2 shadow-clay-sm">
            <AlertTriangle
              size={16}
              className="shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="flex-1 text-xs font-bold text-amber-800 sm:text-sm">
              {l.devBanner}
            </p>
            <button
              onClick={hideBanner}
              aria-label={l.closeNotice}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-amber-200"
            >
              <X size={14} />
            </button>
          </div>
          </Reveal>
        )}

        <Reveal delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-1.5 text-2xl font-extrabold sm:text-3xl">
              {getGreeting(l)}, {userName.split(" ")[0]}!
              <Hand size={22} className="shrink-0 text-clay-primary" />
            </h1>
            <p className="mt-1 text-sm font-semibold text-clay-muted sm:text-base">
              {l.readyToday}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/home">
              <ButtonClay className="min-h-[44px] px-5 py-2 text-sm">
                <Rocket size={16} className="mr-2" /> {l.startLearning}
              </ButtonClay>
            </Link>
          </div>
        </div>
        </Reveal>

        <Reveal delay={0.12}>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={FileText}
            label={l.totalNotes}
            value={notes.length}
          />
          <StatsCard icon={Flame} label={l.streak} value={progress.streak} />
          <StatsCard
            icon={Clock}
            label={l.dueCards}
            value={progress.dueCards}
          />
          <StatsCard
            icon={Trophy}
            label={l.rank}
            value={progress.rank === null ? "—" : progress.rank}
          />
        </div>
        </Reveal>

        <Reveal delay={0.19}>
        <CardClay className="mt-4 !p-4 sm:!p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary sm:h-12 sm:w-12">
                <Medal size={22} className="sm:size-[26px]" />
              </span>
              <div>
                <p className="text-base font-extrabold leading-tight sm:text-lg">
                  {l.level.replace("{level}", String(progress.level))}
                </p>
                <p className="text-xs font-bold text-clay-muted">
                  {progress.levelTitle} · {l.days.replace("{n}", String(progress.streak))}
                </p>
              </div>
            </div>
            <p className="text-xs font-bold text-clay-muted sm:text-sm">
              {progress.xp} / {progress.xp - progress.xpInLevel + progress.xpToNext} XP
            </p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-clay-inputBg shadow-clay-inset">
            <div
              className="h-full rounded-full bg-gradient-to-r from-clay-primary to-clay-borderLight transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((progress.xpInLevel / progress.xpToNext) * 100)
                )}%`,
              }}
            />
          </div>
        </CardClay>
        </Reveal>

        {/* Kartu Rencana Belajar — kertas origami */}
        <Reveal delay={0.23}>
        <Link href="/dashboard/rencana" className="mt-4 block">
          <div
            className="relative overflow-hidden rounded-clay-lg p-4 shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 hover:shadow-clay sm:p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,251,235,0.92), rgba(254,243,199,0.8) 45%, rgba(253,230,138,0.55))",
            }}
          >
            {/* Garis lipatan */}
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "repeating-linear-gradient(115deg, transparent 0 22px, rgba(180,140,60,0.08) 22px 23px, transparent 23px 46px, rgba(180,140,60,0.05) 46px 47px)",
              }}
            />
            {/* Lipatan sudut */}
            <div
              className="pointer-events-none absolute right-0 top-0 h-12 w-12"
              style={{
                background:
                  "linear-gradient(225deg, rgba(255,255,255,0.9), rgba(253,230,138,0.35))",
                clipPath: "polygon(100% 0, 100% 100%, 0 0)",
              }}
            />
            <div className="relative flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-clay-lg bg-amber-500/15 text-amber-700 sm:h-14 sm:w-14">
                <Origami size={24} className="sm:size-[26px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-amber-950 sm:text-lg">
                  {l.studyPlan}
                </p>
                <p className="mt-0.5 text-xs font-bold text-amber-800/70 sm:text-sm">
                  {l.studyPlanDesc}
                </p>
              </div>
              <span className="hidden shrink-0 rounded-clay-full border-3 border-amber-700/20 bg-white/70 px-3 py-1.5 text-xs font-extrabold text-amber-800 sm:block">
                {l.open}
              </span>
            </div>
          </div>
        </Link>
        </Reveal>

        <Reveal delay={0.26}>
        <section className="mt-8">
          <h2 className="text-lg font-extrabold sm:text-xl">{l.yourNotes}</h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
              />
              <InputClay
                placeholder={l.searchNotes}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 !h-12 text-sm sm:text-base"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={`min-h-[44px] shrink-0 rounded-clay-full border-3 px-4 text-xs font-extrabold transition-all duration-75 active:translate-y-0.5 sm:min-h-[40px] sm:px-3.5 ${
                    activeFilter === chip.id
                      ? "border-clay-primary bg-clay-primary text-white shadow-clay-sm"
                      : "border-clay-shadow/50 bg-white text-clay-dark shadow-clay-sm hover:-translate-y-0.5"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {notesLoading ? (
              <div className="card-clay flex items-center justify-center py-12 text-center">
                <p className="text-sm font-bold text-clay-muted">
                  {l.loadingNotes}
                </p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="card-clay flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                  <FileQuestion size={30} className="text-clay-muted" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">
                  {l.noNotes}
                </h3>
                <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
                  {l.noNotesDesc}
                </p>
                <ButtonClay
                  onClick={() => setIsModalOpen(true)}
                  className="mt-5 min-h-[44px] px-5 py-2 text-sm"
                >
                  <FileText size={17} className="mr-2" /> {l.createFirstNote}
                </ButtonClay>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    subject={note.subject}
                    updatedAt={formatUpdatedAt(note.createdAt, l, locale)}
                    pinned={note.pinned === true}
                    onTogglePin={(id, pinned) => void togglePin(id, pinned)}
                    onDelete={(id) => void deleteNote(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
        </Reveal>
      </main>
      )}

      <Reveal
        delay={0.3}
        className="fixed bottom-6 right-4 z-10 sm:bottom-6 sm:right-6"
      >
        <button
          onClick={() => setIsModalOpen(true)}
          data-tutorial-id="create-note-btn"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-clay-primary text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 sm:h-16 sm:w-16"
          aria-label={l.createNote}
        >
          <Plus size={24} className="sm:hidden" />
          <Plus size={28} className="hidden sm:block" />
        </button>
      </Reveal>

      <CreateNoteModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />

      <BackgroundJobPopup />

      {/* Tutorial realtime (berlanjut dari /home bila sedang aktif) */}
      <TutorialHost />
    </div>
  );
}
