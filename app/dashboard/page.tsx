"use client";

import { toast } from "@yusufceng1z/ding-react";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileQuestion,
  FileText,
  Flame,
  Hand,
  Medal,
  Origami,
  Plus,
  Search,
  BookOpen,
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
import "./workspace.css";
import { BackgroundJobPopup } from "@/components/dashboard/BackgroundJobPopup";
import GuideBanner from "@/components/dashboard/GuideBanner";
import AssistantHub from "@/components/dashboard/AssistantHub";
import FirstNoteGuide, { useFirstNoteGuide } from "@/components/tutorial/FirstNoteGuide";
import { Reveal } from "@/components/ui/Reveal";
import { useOnboarding } from "@/context/OnboardingContext";
import LearningJourney from "@/components/dashboard/LearningJourney";
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
  const firstNoteGuide = useFirstNoteGuide();
  const router = useRouter();
  const { data } = useOnboarding();
  const { locale, dict } = useI18n();
  const l = dict.dashboard;
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
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
        setProgressLoaded(true);
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
        // Dedupe id — daftar bisa datang dobel (optimistic add + refresh
        // berbarengan) dan key React harus unik.
        const seen = new Set<string>();
        setNotes(
          (payload.notes ?? []).filter((n: Note) =>
            seen.has(n.id) ? false : (seen.add(n.id), true)
          )
        );
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
    if (subject) router.replace(`/dashboard/catatan?subject=${encodeURIComponent(subject)}`);
  }, [router]);

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
    // Jangan duplikat entri lama dgn id sama (optimistic + note-ready race).
    setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
    setIsModalOpen(false);
  };

  // Hapus catatan dari kartu dashboard (konfirmasi + hapus permanen).
  const deleteNote = async (id: string) => {
    if (!window.confirm(l.confirmDelete)) return;
    try {
      const res = await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? l.errDelete);
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error(l.errDeleteRetry);
    }
  };

  const openNotes = () => router.push("/dashboard/catatan");

  return (
    <>
      <FirstNoteGuide />
      <LearningJourney
        name={userName}
        locale={locale}
        progress={progress}
        progressLoaded={progressLoaded}
        onCreateNote={() => {
          if (firstNoteGuide?.stage === "welcome" || firstNoteGuide?.stage === "active") openNotes();
          else setIsModalOpen(true);
        }}
        onOpenWorkspace={openNotes}
      />
      <CreateNoteModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreate} />
      <BackgroundJobPopup />
    </>
  );
}
