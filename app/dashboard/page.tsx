"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import {
  Clock,
  FileQuestion,
  FileText,
  Flame,
  Plus,
  Search,
  Trophy,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { NoteItem } from "@/components/dashboard/NoteItem";
import { CreateNoteModal } from "@/components/dashboard/CreateNoteModal";
import { BackgroundJobPopup } from "@/components/dashboard/BackgroundJobPopup";
import { useOnboarding } from "@/context/OnboardingContext";
import { getUserId, getUserName } from "@/lib/identity";
import { announceLevelUp } from "@/lib/levelUp";
import type { Note } from "@/lib/types";

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (d.toDateString() === new Date().toDateString()) {
    return `Hari ini, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 19) return "Selamat Sore";
  return "Selamat Malam";
}

export default function DashboardPage() {
  const { data } = useOnboarding();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"semua" | "terbaru">("semua");
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    if (activeFilter === "terbaru") {
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [notes, searchQuery, activeFilter]);

  const handleCreate = (note: Note) => {
    setNotes((prev) => [note, ...prev]);
    setIsModalOpen(false);
  };

  const chips: { id: "semua" | "terbaru"; label: string }[] = [
    { id: "semua", label: "Semua Subjek" },
    { id: "terbaru", label: "Terbaru" },
  ];

  return (
    <div className="pb-24">
      <main className="mx-auto w-full max-w-clay px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              {getGreeting()}, {userName.split(" ")[0]}! 👋
            </h1>
            <p className="mt-1 text-sm font-semibold text-clay-muted sm:text-base">
              Siap belajar hari ini?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/chat/belajar">
              <ButtonClay className="min-h-[44px] px-5 py-2 text-sm">
                🚀 Mulai Belajar
              </ButtonClay>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={FileText}
            label="Total Catatan"
            value={notes.length}
          />
          <StatsCard icon={Flame} label="Streak" value={progress.streak} />
          <StatsCard
            icon={Clock}
            label="Kartu Jatuh Tempo"
            value={progress.dueCards}
          />
          <StatsCard
            icon={Trophy}
            label="Peringkat"
            value={progress.rank === null ? "—" : progress.rank}
          />
        </div>

        <CardClay className="mt-4 !p-4 sm:!p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-lg sm:h-12 sm:w-12 sm:text-xl">
                🏅
              </span>
              <div>
                <p className="text-base font-extrabold leading-tight sm:text-lg">
                  Level {progress.level}
                </p>
                <p className="text-xs font-bold text-clay-muted">
                  {progress.levelTitle} · {progress.streak} hari
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

        <section className="mt-8">
          <h2 className="text-lg font-extrabold sm:text-xl">Catatan Kamu</h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
              />
              <InputClay
                placeholder="Cari catatan..."
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
                  Memuat catatan...
                </p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="card-clay flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                  <FileQuestion size={30} className="text-clay-muted" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">
                  Belum ada catatan
                </h3>
                <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
                  Mulai dengan mengunggah materi belajar pertamamu. AI akan ubah
                  jadi catatan terstruktur.
                </p>
                <ButtonClay
                  onClick={() => setIsModalOpen(true)}
                  className="mt-5 min-h-[44px] px-5 py-2 text-sm"
                >
                  <FileText size={17} className="mr-2" /> Buat Catatan Pertama
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
                    updatedAt={formatUpdatedAt(note.createdAt)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-clay-primary text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
        aria-label="Buat catatan baru"
      >
        <Plus size={24} className="sm:hidden" />
        <Plus size={28} className="hidden sm:block" />
      </button>

      <CreateNoteModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />

      <BackgroundJobPopup />
    </div>
  );
}
