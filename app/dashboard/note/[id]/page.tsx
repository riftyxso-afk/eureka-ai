"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  FileText,
  History,
  ImagePlus,
  Layers,
  Map,
  MessageCircleQuestion,
  PenTool,
  Pencil,
  Phone,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import ChatPanel from "@/components/note/ChatPanel";
import { PdfWorkflowModal } from "@/components/note/PdfWorkflowModal";
import InviteModal from "@/components/note/InviteModal";
import VersionModal from "@/components/note/VersionModal";
import EditNoteModal from "@/components/note/EditNoteModal";
import QuizModal from "@/components/note/QuizModal";
import FlashcardModal from "@/components/note/FlashcardModal";
import AddImageModal from "@/components/note/AddImageModal";
import HighlightToolbar from "@/components/note/HighlightToolbar";
import { NoteTOC } from "@/components/note/NoteTOC";
import { NoteContent } from "@/components/note/NoteContent";
import { NoteAIChat } from "@/components/note/NoteAIChat";
import { DreamingOverlay } from "@/components/note/DreamingOverlay";
import { useRegenerateJob } from "@/lib/useRegenerateJob";
import type { HighlightEntry } from "@/lib/highlights-store";
import type { NoteImage } from "@/lib/note-images-store";
import { getUserId, getUserName } from "@/lib/identity";

interface Chapter {
  id: number;
  title: string;
  content: string;
  timestamp?: string;
  flow?: string[];
}

interface NoteDetail {
  id: string;
  title: string;
  summary: string;
  chapters: Chapter[];
  createdAt: string;
  subject: string;
  keyPoints?: string[];
}

function firstSentence(text: string): string {
  const match = text.match(/^.{1,90}?[.!?](\s|$)/);
  if (match) return match[0].trim();
  const fallback = text.slice(0, 90).trim();
  return fallback.length ? `${fallback}...` : "Bab";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const ACTION_BUTTONS = [
  { icon: Layers, label: "Flashcards" },
  { icon: ClipboardCheck, label: "Kuis" },
  { icon: Map, label: "Mind Map" },
  { icon: FileText, label: "Dokumen" },
  { icon: Share2, label: "Bagikan" },
];

interface PresenceEntry {
  name: string;
  role: "editor" | "viewer";
  lastActive: number;
}

const PRESENCE_COLORS = [
  "bg-violet-300 text-violet-900",
  "bg-amber-300 text-amber-900",
  "bg-emerald-300 text-emerald-900",
  "bg-sky-300 text-sky-900",
  "bg-rose-300 text-rose-900",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const IMAGE_ALIGN = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

const IMAGE_SIZE = {
  small: "max-w-[240px]",
  medium: "max-w-[420px]",
  large: "max-w-2xl",
} as const;

/** Ilustrasi bergaya buku: gambar + caption + tombol hapus. */
function ImageFigure({
  image,
  onDelete,
}: {
  image: NoteImage;
  onDelete: () => void;
}) {
  return (
    <figure className="mt-4">
      <div className={`flex ${IMAGE_ALIGN[image.alignment]}`}>
        <div className={`relative w-full ${IMAGE_SIZE[image.size]}`}>
          <img
            src={image.url}
            alt={image.caption ?? "Ilustrasi catatan"}
            className="w-full rounded-clay-md border-2 border-clay-shadow/20 object-cover shadow-clay-sm"
          />
          <button
            onClick={onDelete}
            aria-label="Hapus gambar"
            title="Hapus gambar"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-clay-shadow/30 bg-white/90 text-clay-muted transition-colors hover:border-red-300 hover:text-red-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {image.caption && (
        <figcaption
          className={`mt-2 text-sm font-bold italic text-clay-muted ${
            image.alignment === "left"
              ? "text-left"
              : image.alignment === "right"
                ? "text-right"
                : "text-center"
          }`}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

const HEARTBEAT_MS = 20000;
const PRESENCE_POLL_MS = 10000;

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showPdfWorkflow, setShowPdfWorkflow] = useState(false);
  const [highlights, setHighlights] = useState<HighlightEntry[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<number, boolean>>({});
  const [bookmarked, setBookmarked] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userName] = useState(() => getUserName());
  const userId = getUserId();
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenNote, setRegenNote] = useState(false);
  const regen = useRegenerateJob();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadNote = async () => {
    try {
      const res = await apiFetch(`/api/notes/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        const rawChapters = data.chapters ?? [];
        const fallbackChapters = (data.chunks ?? []).map(
          (c: { id: string; text: string }, i: number) => ({
            id: i + 1,
            title: firstSentence(c.text),
            content: c.text,
          })
        );
        const chaptersData: Chapter[] =
          rawChapters.length > 0 ? rawChapters : fallbackChapters;
        // Catatan panjang: bab tampil terlipat (collapsed) secara default.
        const totalChars = chaptersData.reduce(
          (acc: number, c: { content?: string }) =>
            acc + (c.content?.length ?? 0),
          0
        );
        const longNote = totalChars > 3000 || chaptersData.length >= 5;
        setCollapsedMap(
          chaptersData.reduce<Record<number, boolean>>((acc, c) => {
            acc[c.id] = longNote;
            return acc;
          }, {})
        );
        setNote({
          id: data.note.id,
          title: data.note.title,
          summary:
            data.note.summary ||
            data.chunks?.[0]?.text.slice(0, 220) ||
            "Tidak ada ringkasan.",
          chapters: chaptersData,
          createdAt: data.note.createdAt,
          subject: data.note.subject,
          keyPoints: data.note.keyPoints ?? [],
        });
      }
    } catch {
      // catatan tidak ditemukan
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Reload catatan otomatis saat job regenerate selesai / gagal.
  useEffect(() => {
    if (regen.running) return;
    if (regenNote && regen.percent >= 100) {
      loadNote();
      setRegenNote(false);
      setConfirmRegen(false);
      notify("Catatan berhasil ditulis ulang! ✨");
    } else if (regenNote && regen.error) {
      setRegenNote(false);
      setConfirmRegen(false);
      notify(`Gagal menulis ulang: ${regen.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regen.running, regenNote]);

  const handleRegenerateAll = async () => {
    setConfirmRegen(false);
    setRegenNote(true);
    notify("AI menulis ulang seluruh catatan...");
    await regen.start(`/api/notes/${params.id}/regenerate`);
  };

  // Stabilo + ilustrasi (sinkron kolaboratif, polling ringan)
  useEffect(() => {
    let stopped = false;
    const loadExtras = async () => {
      try {
        const [hlRes, imgRes] = await Promise.all([
          apiFetch(`/api/notes/${params.id}/highlights`),
          apiFetch(`/api/notes/${params.id}/images`),
        ]);
        if (hlRes.ok) {
          const hl = await hlRes.json();
          if (!stopped) setHighlights(hl.highlights ?? []);
        }
        if (imgRes.ok) {
          const im = await imgRes.json();
          if (!stopped) setImages(im.images ?? []);
        }
      } catch {
        // abaikan
      }
    };
    loadExtras();
    const poll = setInterval(loadExtras, 8000);
    return () => {
      stopped = true;
      clearInterval(poll);
    };
  }, [params.id]);

  const deleteImage = async (image: NoteImage) => {
    try {
      const res = await apiFetch(
        `/api/notes/${params.id}/images?id=${image.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setImages((prev) => prev.filter((i) => i.id !== image.id));
        notify("Ilustrasi dihapus.");
      }
    } catch {
      // abaikan
    }
  };

  const refreshHighlights = () => {
    apiFetch(`/api/notes/${params.id}/highlights`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setHighlights(d.highlights ?? []);
      })
      .catch(() => {});
  };

  const generateAiHighlights = async () => {
    notify("AI sedang menstabilo catatanmu... ✨");
    try {
      const res = await apiFetch(`/api/notes/${params.id}/highlights/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat stabilo AI.");
      notify(
        data.count > 0
          ? `Stabilo AI diterapkan (${data.count} bagian)! ✨`
          : "Tidak ada bagian baru yang layak distabilo."
      );
      refreshHighlights();
    } catch (e) {
      notify(
        e instanceof Error ? `Gagal: ${e.message}` : "Gagal membuat stabilo AI."
      );
    }
  };

  // Bookmark (localStorage per catatan)
  useEffect(() => {
    try {
      setBookmarked(
        localStorage.getItem(`eureka_bookmarked_${params.id}`) === "1"
      );
    } catch {
      // abaikan
    }
  }, [params.id]);

  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      localStorage.setItem(
        `eureka_bookmarked_${params.id}`,
        next ? "1" : "0"
      );
    } catch {
      // abaikan
    }
    notify(next ? "Disimpan ke bookmark! 🔖" : "Bookmark dihapus");
  };

  // Bergabung via link undangan (?invite=TOKEN)
  useEffect(() => {
    const token = searchParams.get("invite");
    if (!token) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/notes/${params.id}/collab`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", token }),
        });
        if (res.ok) {
          notify("Kamu bergabung sebagai kolaborator! 🎉");
          router.replace(`/dashboard/note/${params.id}`);
        }
      } catch {
        // abaikan
      }
    })();
  }, [searchParams, params.id, router, notify]);

  // Kehadiran real-time (heartbeat + polling)
  useEffect(() => {
    const heartbeat = () => {
      apiFetch(`/api/notes/${params.id}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: getUserName(), role: "editor" }),
      }).catch(() => {});
    };
    const poll = async () => {
      try {
        const res = await apiFetch(`/api/notes/${params.id}/presence`);
        if (res.ok) {
          const data = await res.json();
          setPresence(Object.values(data.presence ?? {}));
        }
      } catch {
        // abaikan
      }
    };
    heartbeat();
    poll();
    const hb = setInterval(heartbeat, HEARTBEAT_MS);
    const pl = setInterval(poll, PRESENCE_POLL_MS);
    return () => {
      clearInterval(hb);
      clearInterval(pl);
    };
  }, [params.id, userId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
        <div className="card-clay flex items-center justify-center py-16 text-clay-muted">
          <p className="text-base font-extrabold">Memuat catatan...</p>
        </div>
        <DreamingOverlay
          open
          title="Membaca catatanmu..."
          status="AI sedang menyiapkan halaman"
        />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
        <div className="card-clay flex flex-col items-center py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
            <FileQuestion size={36} className="text-clay-muted" />
          </div>
          <h3 className="mt-6 text-xl font-extrabold">Catatan tidak ditemukan</h3>
          <p className="mt-2 max-w-sm text-base font-semibold text-clay-muted">
            Catatan ini mungkin sudah dihapus atau tautannya salah.
          </p>
          <Link
            href="/dashboard"
            className="btn-clay-primary mt-6 !min-h-[44px] !px-5 text-sm"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const data = note;
  const chapters = data.chapters;

  const scrollToChapter = (id: number) => {
    setActiveChapterId(id);
    const scroll = () =>
      sectionRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    if (collapsedMap[id]) {
      // Bab terlipat: buka dulu, lalu scroll setelah konten tampil.
      setCollapsedMap((prev) => ({ ...prev, [id]: false }));
      setTimeout(scroll, 60);
    } else {
      scroll();
    }
  };

  const toggleChapter = (id: number) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllChapters = () => {
    const anyCollapsed = chapters.some((c) => collapsedMap[c.id]);
    setCollapsedMap(
      chapters.reduce<Record<number, boolean>>((acc, c) => {
        acc[c.id] = !anyCollapsed;
        return acc;
      }, {})
    );
  };

  const openNotepad = (chapter: Chapter) => {
    router.push(`/dashboard/note/${data.id}/bab/${chapter.id}`);
  };

  /** "Tanya AI": buat sesi chat baru & import catatan ini sebagai lampiran. */
  const askNote = async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const res = await apiFetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const sessData = (await res.json()) as { session?: { id: string } };
      if (sessData.session?.id) {
        router.push(
          `/chat/${sessData.session.id}?note=${encodeURIComponent(data.id)}`
        );
      } else {
        notify("Gagal membuat sesi chat. Coba lagi ya.");
      }
    } catch {
      notify("Gagal membuat sesi chat. Coba lagi ya.");
    }
  };

  const handleAction = (label: string) => {
    if (label === "Kuis") {
      setShowQuiz(true);
      return;
    }
    if (label === "Flashcards") {
      setShowFlashcards(true);
      return;
    }
    if (label === "Bagikan") {
      setShowInvite(true);
      return;
    }
    if (label === "Dokumen") {
      // F9: PDF dengan ALUR KERJA realtime — modal SSE (Python/reportlab,
      // fallback pdfkit) lalu unduh otomatis saat selesai.
      setShowPdfWorkflow(true);
      return;
    }
    alert(`Fitur ${label} segera hadir!`);
  };

  return (
    <div className="mx-auto w-full max-w-clay space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Link
            href="/dashboard"
            aria-label="Kembali ke dashboard"
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-3"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="min-w-0 break-words text-xl font-extrabold leading-snug text-clay-dark sm:text-2xl md:text-3xl">
            {data.title}
          </h1>
        </div>
        <div className="-mx-4 flex flex-wrap items-center gap-2 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          <button
            onClick={toggleBookmark}
            aria-label="Bookmark"
            title="Bookmark"
            className={`btn-clay-ghost shrink-0 !min-h-[44px] !px-3 ${
              bookmarked ? "!border-clay-secondary/60 !bg-clay-secondary/15" : ""
            }`}
          >
            <Bookmark
              size={18}
              className={
                bookmarked
                  ? "fill-clay-secondary text-clay-secondary"
                  : "text-clay-muted"
              }
            />
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <Pencil size={16} className="mr-2" />
            Ubah
          </button>
          <button
            onClick={() => setShowVersions(true)}
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <History size={16} className="mr-2" />
            Versi
          </button>
          <button
            onClick={() => setConfirmRegen(true)}
            disabled={regen.running}
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <RefreshCw size={16} className="mr-2" />
            Tulis Ulang
          </button>
          <Link
            href={`/dashboard/note/${data.id}/papan`}
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <PenTool size={16} className="mr-2" />
            Papan
          </Link>
          <button
            onClick={askNote}
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <MessageCircleQuestion size={16} className="mr-2" />
            Tanya AI
          </button>
          <button
            onClick={() =>
              notify("Panggilan suara & video call segera hadir! 🚧")
            }
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <Phone size={16} className="mr-2" />
            Panggilan
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="btn-clay-primary shrink-0 !min-h-[44px] !px-4 text-sm"
          >
            <Share2 size={16} className="mr-2" />
            Bagikan
          </button>
        </div>
      </div>

      {/* Kehadiran kolaborator */}
      {presence.length > 0 && (
        <div className="card-clay flex flex-wrap items-center gap-3 !p-4">
          <div className="flex items-center gap-1.5 text-sm font-bold text-clay-muted">
            <Users size={16} className="text-clay-primary" />
            <span>{presence.length} sedang membuka catatan ini</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presence.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                title={`${p.name} (${p.role === "editor" ? "Editor" : "Viewer"})`}
                className="flex items-center gap-2 rounded-full border-2 border-clay-shadow/40 bg-white/70 py-1 pl-1 pr-3"
              >
                <span className="relative">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold ${PRESENCE_COLORS[i % PRESENCE_COLORS.length]}`}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                </span>
                <span className="text-xs font-bold text-clay-dark">
                  {p.name === userName ? "Kamu" : p.name}
                </span>
                <span className="rounded-full bg-clay-beige px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-clay-muted">
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout 2 kolom: TOC (kiri) + Konten (kanan) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Daftar isi (sidebar desktop + chip mobile) */}
        <NoteTOC
          chapters={chapters}
          activeChapterId={activeChapterId ?? chapters[0]?.id ?? 0}
          onChapterClick={scrollToChapter}
        />

        {/* Konten utama */}
        <main className="min-w-0 flex-1">
          {/* Ringkasan */}
          <div className="card-clay p-6">
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-clay-muted">
              Ringkasan
            </h2>
            <p className="text-[17px] font-semibold leading-6 text-clay-dark">
              {data.summary}
            </p>
          </div>

          {/* Poin Penting */}
          {data.keyPoints && data.keyPoints.length > 0 && (
            <div className="card-clay mt-4 p-6">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                Poin Penting
              </h2>
              <ul className="space-y-2.5">
                {data.keyPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm font-medium leading-relaxed text-clay-dark"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-clay-primary"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="-mx-4 mt-4 flex flex-wrap items-center gap-2 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
            {ACTION_BUTTONS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleAction(item.label)}
                className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
              >
                <item.icon size={16} className="mr-2" />
                <span className="font-extrabold">{item.label}</span>
              </button>
            ))}
            <button
              onClick={generateAiHighlights}
              className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
            >
              <Sparkles size={16} className="mr-2 text-clay-primary" />
              <span className="font-extrabold">Stabilo AI</span>
            </button>
            <button
              onClick={() => setShowAddImage(true)}
              className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
            >
              <ImagePlus size={16} className="mr-2" />
              <span className="font-extrabold">Gambar</span>
            </button>
            {highlights.length > 0 && (
              <span className="shrink-0 text-xs font-bold text-clay-muted">
                {highlights.length} bagian distabilo
              </span>
            )}
          </div>

          {/* Stabilo (highlighter) */}
          <HighlightToolbar
            noteId={data.id}
            notify={notify}
            onSaved={refreshHighlights}
          />

          {/* Bab */}
          <div className="mt-6 space-y-6">
            {chapters.length > 0 ? (
              <>
                <div className="flex items-center justify-end">
                  <button
                    onClick={toggleAllChapters}
                    className="btn-clay-ghost !min-h-[40px] !px-3 text-xs"
                  >
                    {chapters.some((c) => collapsedMap[c.id])
                      ? "Perluas semua bab"
                      : "Ciutkan semua bab"}
                  </button>
                </div>
                {chapters.map((chapter) => {
                  const chapterImages = images.filter(
                    (i) => i.chapterId === chapter.id
                  );
                  const collapsed = !!collapsedMap[chapter.id];
                  return (
                    <section key={chapter.id} id={`chapter-${chapter.id}`}>
                      <NoteContent
                        chapter={chapter}
                        onOpenNotepad={openNotepad}
                        highlights={highlights.filter(
                          (h) => h.chapterId === chapter.id
                        )}
                        collapsed={collapsed}
                        onToggle={() => toggleChapter(chapter.id)}
                        ref={(el) => {
                          sectionRefs.current[chapter.id] = el;
                        }}
                      />
                      {!collapsed &&
                        chapterImages.map((image) => (
                          <ImageFigure
                            key={image.id}
                            image={image}
                            onDelete={() => deleteImage(image)}
                          />
                        ))}
                    </section>
                  );
                })}
              </>
            ) : (
              <div className="card-clay p-6 text-sm font-semibold text-clay-muted">
                Catatan ini belum memiliki bab.
              </div>
            )}
          </div>

          {/* Bagian Ilustrasi: gambar tanpa bab tertentu */}
          {images.filter((i) => !i.chapterId).length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-clay-muted">
                Ilustrasi
              </h3>
              <div className="space-y-4">
                {images
                  .filter((i) => !i.chapterId)
                  .map((image) => (
                    <ImageFigure
                      key={image.id}
                      image={image}
                      onDelete={() => deleteImage(image)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Tanya AI tentang catatannya */}
          <NoteAIChat noteId={data.id} notify={notify} />

          {/* Metadata */}
          <div className="mt-6 flex flex-wrap gap-6 border-t-2 border-clay-shadow/20 pt-4 text-sm font-semibold text-clay-muted">
            <div className="flex items-center gap-2">
              <BookOpen size={16} />
              <span>{data.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{formatDate(data.createdAt)}</span>
            </div>
          </div>

          {/* Diskusi kolaboratif */}
          <ChatPanel noteId={data.id} userName={userName} />
        </main>
      </div>

      {/* Modal */}
      {showInvite && (
        <InviteModal
          noteId={data.id}
          notify={notify}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showVersions && (
        <VersionModal
          noteId={data.id}
          notify={notify}
          onClose={() => setShowVersions(false)}
          onRestored={() => loadNote()}
        />
      )}
      {showEdit && (
        <EditNoteModal
          noteId={data.id}
          userName={userName}
          initialTitle={data.title}
          initialSummary={data.summary}
          notify={notify}
          onClose={() => setShowEdit(false)}
          onSaved={() => loadNote()}
        />
      )}
      {showQuiz && (
        <QuizModal
          noteId={data.id}
          notify={notify}
          onClose={() => setShowQuiz(false)}
        />
      )}
      {showPdfWorkflow && (
        <PdfWorkflowModal
          noteId={data.id}
          noteTitle={data.title}
          notify={notify}
          onClose={() => setShowPdfWorkflow(false)}
        />
      )}
      {showFlashcards && (
        <FlashcardModal
          noteId={data.id}
          notify={notify}
          onClose={() => setShowFlashcards(false)}
        />
      )}
      {showAddImage && (
        <AddImageModal
          noteId={data.id}
          chapters={chapters}
          onClose={() => setShowAddImage(false)}
          onAdded={() => {
            notify("Gambar ditambahkan! 🖼️");
            apiFetch(`/api/notes/${params.id}/images`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                if (d) setImages(d.images ?? []);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* Konfirmasi tulis ulang seluruh catatan */}
      {confirmRegen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          onClick={() => setConfirmRegen(false)}
        >
          <div
            className="card-clay m-auto w-full max-w-md max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] !p-6 sm:!p-8 rounded-clay !shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-clay-dark">
              Tulis ulang seluruh catatan? ✨
            </h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-muted">
              AI akan menulis ulang semua bab dari{" "}
              <span className="font-extrabold text-clay-dark">
                “{data.title}”
              </span>{" "}
              ({chapters.length} bab) berdasarkan konten yang ada. Proses ini
              bisa memakan waktu beberapa menit — kamu bisa menunggu di halaman
              ini atau membiarkannya jalan.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmRegen(false)}
                className="btn-clay-ghost flex-1 !min-h-[46px] !px-4 text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleRegenerateAll}
                className="btn-clay-primary flex-1 !min-h-[46px] !px-4 text-sm"
              >
                <RefreshCw size={15} className="mr-2" />
                Tulis Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay "AI dreaming" saat menulis ulang */}
      <DreamingOverlay
        open={regen.running}
        title="AI sedang menulis ulang catatanmu..."
        status={regen.message}
        percent={regen.percent}
        onCancel={() => void regen.stop()}
        cancelDisabled={regen.stopping}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="card-clay max-w-[calc(100vw-2rem)] whitespace-normal px-5 py-3 text-sm font-extrabold text-clay-dark shadow-clay">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
