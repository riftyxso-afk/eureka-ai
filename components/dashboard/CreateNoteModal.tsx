"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiEventSource, getClientLocale } from "@/lib/apiClient";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileQuestion,
  FileText,
  Globe,
  Languages,
  Loader2,
  Music,
  PartyPopper,
  Plus,
  RotateCcw,
  ServerOff,
  Square,
  SquarePlay,
  Trash2,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import type { Note } from "@/lib/types";
import type { Subject } from "@/lib/subjects";
import { getUserId } from "@/lib/identity";
import { emojiToIcon } from "@/lib/emojiIcon";
import { playCompletionSound } from "@/lib/notifySound";
import { ensurePushSetup } from "@/lib/push";
import { addActiveJobId, removeActiveJobId } from "@/context/JobWatcherContext";

interface SourceOption {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  accept?: string;
  placeholder?: string;
  comingSoon?: boolean;
}

const SOURCES: SourceOption[] = [
  {
    id: "dokumen",
    label: "Dokumen",
    desc: "PDF, DOCX, PPT",
    icon: FileText,
    accept: ".pdf,.docx,.pptx,.txt",
  },
  {
    id: "soal",
    label: "Soal/Tugas",
    desc: "Tempel soal dari guru/dosen → dijawab AI",
    icon: FileQuestion,
    placeholder: "Tempel soal/tugas lengkap di sini...",
  },
  {
    id: "youtube",
    label: "YouTube",
    desc: "Link video (subtitle di-scrape)",
    icon: SquarePlay,
    placeholder: "https://youtu.be/...",
  },
  {
    id: "web",
    label: "Web",
    desc: "Link halaman (scrape + gambar)",
    icon: Globe,
    placeholder: "https://contoh.com/artikel...",
  },
  {
    id: "audio",
    label: "Audio",
    desc: "MP3, WAV, M4A",
    icon: Music,
    accept: "audio/*",
    comingSoon: true,
  },
  {
    id: "video",
    label: "Video",
    desc: "MP4, MOV",
    icon: Video,
    accept: "video/*",
    comingSoon: true,
  },
];

/** Satu baris sumber yang dipilih user (maks 5). */
interface SourceEntry {
  id: string;
  type: string;
  file?: File | null;
  link?: string;
  soalText?: string;
}

const MAX_SOURCES = 5;

function sourceLabel(type: string): string {
  return SOURCES.find((s) => s.id === type)?.label ?? type;
}

function sourcePlaceholder(type: string): string {
  return SOURCES.find((s) => s.id === type)?.placeholder ?? "";
}

function sourceAccept(type: string): string | undefined {
  return SOURCES.find((s) => s.id === type)?.accept;
}

const STUDY_MODES = [
  { value: "ringkas", label: "Ringkas", desc: "Poin penting saja" },
  { value: "standar", label: "Standar", desc: "Seimbang" },
  { value: "lengkap", label: "Lengkap", desc: "Detail & mendalam" },
] as const;

const GENERATION_MODES = [
  {
    value: "cepat",
    icon: "⚡",
    title: "Cepat & Ringkas",
    desc: "Catatan inti langsung jadi dalam hitungan menit — ringkas, padat, dan cepat selesai.",
    badge: "Kilat",
    time: "± 1-2 menit",
    features: ["Tanpa validasi sumber web", "Tanpa gambar & stabilo", "Tanpa kuis & flashcards", "Maksimal 3 bab ringkas"],
  },
  {
    value: "lengkap",
    icon: "🎓",
    title: "Lengkap & Mendalam",
    desc: "Pipeline penuh: struktur buku teks, validasi sumber web, gambar, kuis & flashcards otomatis.",
    badge: "Disarankan",
    time: "± 3-6 menit",
    features: ["Struktur buku teks (Diátaxis)", "Validasi & enrichment web", "Gambar, stabilo, referensi", "Kuis & flashcards otomatis"],
  },
] as const;

const NOTE_TYPES = [
  {
    value: "rangkuman",
    icon: "📚",
    title: "Rangkuman Biasa",
    desc: "Catatan belajar bergaya buku teks — bab, sub-judul, dan poin-poin jelas.",
    badge: "Standar",
  },
  {
    value: "makalah",
    icon: "📄",
    title: "Makalah",
    desc: "Struktur akademik: pendahuluan, kajian teori, pembahasan, kesimpulan, daftar pustaka.",
    badge: "Formal",
  },
  {
    value: "laporan",
    icon: "📋",
    title: "Laporan",
    desc: "Struktur laporan: tujuan, metode, hasil, pembahasan, kesimpulan.",
    badge: "Terstruktur",
  },
  {
    value: "poin",
    icon: "⚡",
    title: "Poin Penting",
    desc: "Intisari super ringkas berupa bullet — paling pas untuk belajar cepat.",
    badge: "Kilat",
  },
] as const;

const WRITING_STYLES = [
  "Ramah & Santai",
  "Formal & Akademis",
  "Santai & Gaul",
  "Alami & Manusiawi",
];
const LANGUAGES = ["Bahasa Indonesia", "English", "Campuran"];

const SUBJECT_COLORS = [
  "#8B5CF6",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
];

const PROCESS_STEPS = [
  "Menganalisis materi kamu...",
  "Mengekstrak konten teks...",
  "Memecah menjadi potongan kecil...",
  "Mengubah menjadi vektor (embedding)...",
  "Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_YOUTUBE = [
  "Mengambil subtitle video...",
  "Merangkum subtitle dengan AI...",
  "Memecah menjadi potongan kecil...",
  "Mengubah menjadi vektor (embedding)...",
  "Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_WEB = [
  "Membaca halaman web...",
  "Mengumpulkan gambar halaman...",
  "Menulis bab satu per satu dengan AI...",
  "Mengubah menjadi vektor (embedding)...",
  "Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_SOAL = [
  "Membaca soal/tugas...",
  "Menjawab setiap soal dengan AI...",
  "Memecah jawaban menjadi potongan kecil...",
  "Mengubah menjadi vektor (embedding)...",
  "Menyimpan ke knowledge base...",
];

// Batas unggah: platform serverless membatasi body request (~4.5MB).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Ambil kode error dari pesan (mis. "kode 429" / "HTTP 429") → "429". */
function extractErrorCode(msg: string): string | null {
  const m = msg.match(/kode\s+([\d,\s]+)/i) ?? msg.match(/HTTP\s+(\d{3})/i);
  if (m) {
    const cleaned = m[1].replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return null;
}

/** Apakah pesan error menunjukkan server AI sibuk / kehabisan kuota? */
function isBusyError(msg: string): boolean {
  return /sedang sibuk|sibuk|kuota|quota|rate limit|terlalu banyak/i.test(msg);
}

interface CreateNoteModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (note: Note) => void;
}

const selectClayClass =
  "w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 pr-10 text-sm sm:px-5 sm:py-4 sm:pr-12 sm:text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]";

export const CreateNoteModal = ({
  open,
  onClose,
  onCreate,
}: CreateNoteModalProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [translateToIndo, setTranslateToIndo] = useState(false);
  const [mataPelajaran, setMataPelajaran] = useState("");
  const [studyMode, setStudyMode] = useState<"ringkas" | "standar" | "lengkap">(
    "standar"
  );
  const [generationMode, setGenerationMode] = useState<"cepat" | "lengkap">(
    "lengkap"
  );
  const [gayaPenulisan, setGayaPenulisan] = useState("Ramah & Santai");
  // Default bahasa mengikuti locale aktif (id/en) — user tetap bisa ganti.
  const [bahasa, setBahasa] = useState(
    getClientLocale() === "en" ? "English" : "Bahasa Indonesia"
  );
  const [chapterCount, setChapterCount] = useState(4);
  const [noteType, setNoteType] = useState("rangkuman");
  const [processing, setProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Error dari proses background (job gagal) — tampil sebagai popup penuh
  // berisi kode error + pesan "server sedang sibuk", dengan tombol coba lagi.
  const [jobError, setJobError] = useState<{ message: string; code?: string | null } | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [createdNote, setCreatedNote] = useState<Note | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [stoppingJob, setStoppingJob] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressPercentRef = useRef(0);
  const doneHandledRef = useRef(false);
  const router = useRouter();
  const jobIdRef = useRef<string | null>(null);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await apiFetch("/api/subjects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.subjects) {
        setSubjects(Array.isArray(json.subjects) ? json.subjects : []);
      } else {
        console.warn("[CreateNoteModal] API return:", json);
        setSubjects([]);
      }
    } catch (e) {
      console.error("[CreateNoteModal] loadSubjects fail:", e);
      setSubjects([]);
    }
  }, []);

  useEffect(() => {
    if (open && step === 2) loadSubjects();
  }, [open, step, loadSubjects]);

   const addNewSubject = async () => {
     const name = newSubjectName.trim();
     if (!name) {
       setSubjectError("Nama mata pelajaran tidak boleh kosong.");
       return;
     }
     try {
       const res = await apiFetch("/api/subjects", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           name,
           color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
         }),
       });
       if (!res.ok) {
         const text = await res.text();
         const msg = text.includes('"sudah ada') 
           ? `Mata pelajaran "${name}" sudah ada di daftar.`
           : `Gagal menambah mata pelajaran: ${text.substring(0, 200)}`;
         throw new Error(msg);
       }
       const data = await res.json();
       if (!data.subject) throw new Error("Respons API tidak valid.");
       setSubjects((prev) => [...prev, data.subject]);
       setMataPelajaran(data.subject.name);
       setAddingSubject(false);
       setNewSubjectName("");
       setSubjectError(null);
    } catch (e) {
      setSubjectError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    }
  };

  const isLinkSource = (type: string) => type === "youtube" || type === "web";
  const isSoalSource = (type: string) => type === "soal";
  const processSteps =
    sources.some((s) => s.type === "soal")
      ? PROCESS_STEPS_SOAL
      : sources.some((s) => s.type === "youtube")
        ? PROCESS_STEPS_YOUTUBE
        : sources.some((s) => s.type === "web")
          ? PROCESS_STEPS_WEB
          : PROCESS_STEPS;
  const sourcesValid =
    sources.length > 0 &&
    sources.every((s) =>
      isLinkSource(s.type)
        ? (s.link ?? "").trim().length > 5
        : isSoalSource(s.type)
          ? (s.soalText ?? "").trim().length >= 10
          : Boolean(s.file)
    );
  const canSubmit = !processing && Boolean(mataPelajaran) && sourcesValid;

  const reset = () => {
    setStep(1);
    setSources([]);
    setTranslateToIndo(false);
    setMataPelajaran("");
    setStudyMode("standar");
    setGenerationMode("lengkap");
    setGayaPenulisan("Ramah & Santai");
    setBahasa(getClientLocale() === "en" ? "English" : "Bahasa Indonesia");
    setChapterCount(4);
    setNoteType("rangkuman");
    setError(null);
    setJobError(null);
    setProgressPercent(0);
    progressPercentRef.current = 0;
    setProgressMessage("");
    setAddingSubject(false);
    setNewSubjectName("");
    setSubjectError(null);
    setActiveJobId(null);
    setStoppingJob(false);
  };

  // Hentikan polling fallback (dipanggil saat close/selesai/gagal).
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const close = () => {
    // Selama proses berjalan di latar belakang, modal BOLEH ditutup —
    // job tetap jalan dan notifikasi selesai muncul lewat watcher.
    if (createdNote) {
      const note = createdNote;
      setCreatedNote(null);
      reset();
      onCreate(note);
    } else {
      reset();
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    stopPolling();
    onClose();
  };

  // Tutup SSE bila modal ditutup tanpa melalui close() (mis. unmount).
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopProcessing = async () => {
    if (!jobIdRef.current) return;
    setStoppingJob(true);
    try {
      await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobIdRef.current)}`, {
        method: "POST",
      });
      setProcessing(false);
      setProgressMessage("Proses dibatalkan.");
      close();
    } catch {
      setStoppingJob(false);
    }
  };

  const openCreatedNote = () => {
    if (!createdNote) return;
    const note = createdNote;
    setCreatedNote(null);
    reset();
    onCreate(note);
    onClose();
    router.push(`/dashboard/note/${note.id}`);
  };

  /** Tambah satu sumber baru ke daftar (maks 5) lalu lanjut ke langkah isi. */
  const addSource = (id: string) => {
    const src = SOURCES.find((s) => s.id === id);
    if (src?.comingSoon) {
      setError("Sumber ini belum tersedia. Segera hadir!");
      return;
    }
    if (sources.length >= MAX_SOURCES) {
      setError(`Maksimal ${MAX_SOURCES} sumber per catatan.`);
      return;
    }
    setError(null);
    setSources((prev) => [
      ...prev,
      {
        id: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: id,
        file: null,
        link: "",
        soalText: "",
      },
    ]);
    setTranslateToIndo(false);
    setStep(2);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSource = (id: string, patch: Partial<SourceEntry>) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  /**
   * SSE melaporkan 100% (selesai ATAU gagal — dicek lewat status job).
   * Ambil catatan jadi → tampilkan panel sukses.
   */
  const completeFromJob = async (jobId: string) => {
    if (doneHandledRef.current) return;
    try {
      const jres = await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobId)}`);
      // Job hilang (server restart / kedaluwarsa) → hentikan proses dengan pesan jelas.
      if (jres.status === 404) {
        doneHandledRef.current = true;
        removeActiveJobId(jobId);
        stopPolling();
        const msg =
          "Proses terhenti karena server sempat restart. Silakan coba buat catatan lagi.";
        setError(msg);
        setJobError({ message: msg, code: "404" });
        setProcessing(false);
        return;
      }
      const jdata = await jres.json();
      const job = jdata?.job;
      if (!job) return;
      if (job.status === "error") {
        doneHandledRef.current = true;
        removeActiveJobId(jobId);
        stopPolling();
        const msg = job.error || "Gagal memproses materi. Coba lagi.";
        setError(msg);
        setJobError({ message: msg, code: extractErrorCode(msg) });
        setProcessing(false);
        return;
      }
      if (job.status !== "done" || !job.noteId) return; // belum selesai — tunggu panggilan berikutnya
      doneHandledRef.current = true;
      const nres = await apiFetch(`/api/notes/${job.noteId}`);
      const ndata = await nres.json();
      if (nres.ok && ndata.note) {
        removeActiveJobId(jobId);
        stopPolling();
        playCompletionSound();
        progressPercentRef.current = 100;
        setProgressPercent(100);
        setProgressMessage("Selesai!");
        setCreatedNote(ndata.note as Note);
        setProcessing(false);
      }
    } catch {
      // Biarkan watcher memantau dan memberi tahu lewat notifikasi.
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    stopPolling();
    setProcessing(true);
    setError(null);
    setProgressPercent(0);
    progressPercentRef.current = 0;
    setProgressMessage(processSteps[0]);
    doneHandledRef.current = false;

    const form = new FormData();
    // Metadata semua sumber; file dikirim sebagai file0, file1, … sesuai indeks.
    form.append(
      "sources",
      JSON.stringify(
        sources.map((s) => ({
          type: s.type,
          ...(isLinkSource(s.type)
            ? { url: (s.link ?? "").trim() }
            : {}),
          ...(isSoalSource(s.type)
            ? { soalText: (s.soalText ?? "").trim() }
            : {}),
        }))
      )
    );
    form.append("mataPelajaran", mataPelajaran);
    form.append("studyMode", studyMode);
    form.append("generationMode", generationMode);
    form.append("gayaPenulisan", gayaPenulisan);
    form.append("bahasa", bahasa);
    form.append("chapterCount", String(chapterCount));
    form.append("noteType", noteType);
    form.append("userId", getUserId());
    if (sources.some((s) => isSoalSource(s.type))) {
      form.append("assignment", "1");
    }
    if (translateToIndo) form.append("translate", "1");
    sources.forEach((s, i) => {
      if (s.file) form.append(`file${i}`, s.file);
    });

    // Session ID untuk progress stream SSE
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    form.append("sessionId", sessionId);

    // Progress realtime 0-100% via Server-Sent Events (tetap terbuka selama
    // modal tampil — job berjalan di latar belakang walau modal ditutup).
    const eventSource = apiEventSource(
      `/api/notes/process-progress/${sessionId}`
    );
    eventSourceRef.current = eventSource;
    let jobId = "";
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as {
          percent: number;
          message: string;
        };
        setProgressPercent(progress.percent);
        progressPercentRef.current = Math.max(
          progressPercentRef.current,
          progress.percent
        );
        setProgressMessage(progress.message);
        if (progress.percent >= 100 && jobId) {
          void completeFromJob(jobId);
        }
      } catch {
        // event bukan JSON — abaikan
      }
    };

    try {
      const res = await apiFetch("/api/notes/process", {
        method: "POST",
        body: form,
        headers: { "x-session-id": sessionId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses materi.");

      // 202: job berjalan di latar belakang.
      if (data.jobId) {
        jobId = String(data.jobId);
        jobIdRef.current = jobId;
        setActiveJobId(jobId);
        addActiveJobId(jobId);

        // Jaring pengaman: polling status job tiap 5 detik — progress bar tetap
        // bergerak walau SSE gagal/terblokir (mis. proxy mem-buffer stream).
        pollRef.current = setInterval(async () => {
          const current = jobIdRef.current;
          if (!current) return;
          try {
            const jres = await apiFetch(
              `/api/notes/jobs/${encodeURIComponent(current)}`
            );
            if (jres.status === 404) {
              // Job hilang (server restart) — tampilkan pesan jelas.
              void completeFromJob(current);
              return;
            }
            if (!jres.ok) return;
            const jdata = await jres.json();
            const job = jdata?.job;
            if (!job) return;
            if (
              typeof job.percent === "number" &&
              job.percent > progressPercentRef.current
            ) {
              progressPercentRef.current = job.percent;
              setProgressPercent(job.percent);
              if (typeof job.message === "string" && job.message) {
                setProgressMessage(job.message);
              }
            }
            if (job.status === "done" || job.status === "error") {
              void completeFromJob(current);
            }
          } catch {
            // abaikan — SSE / watcher tetap memantau
          }
        }, 5000);
        setProgressMessage(
          "Materi sedang dirangkum di latar belakang — kamu boleh lanjut menjelajah"
        );
        // Race: SSE bisa melaporkan 100% sebelum jobId diterima di atas.
        // Cek status job sekali langsung setelah dapat jobId.
        void completeFromJob(jobId);
        // Minta izin notifikasi browser (sekali). Kalau granted, daftarkan
        // perangkat untuk Web Push agar muncul notifikasi sistem di HP.
        if (typeof Notification !== "undefined") {
          const uid = getUserId();
          if (Notification.permission === "default") {
            Notification.requestPermission()
              .then((perm) => {
                if (perm === "granted") void ensurePushSetup(uid);
              })
              .catch(() => {});
          } else if (Notification.permission === "granted") {
            void ensurePushSetup(uid);
          }
        }
        return; // SSE tetap terbuka; job dituntaskan via completeFromJob/watcher.
      }

      // Jalur lama (server memproses sinkron — seharusnya tidak terjadi).
      setProgressPercent(100);
      setProgressMessage("Selesai!");
      setCreatedNote(data.note as Note);
      setProcessing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
      setError(msg);
      setJobError({ message: msg, code: extractErrorCode(msg) });
      setProcessing(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    }
  };

  /** Coba lagi dari popup error — form & langkah terakhir tetap tersimpan. */
  const retrySubmit = () => {
    setJobError(null);
    setError(null);
    // Kembali ke langkah terakhir wizard biar user bisa cek ulang, lalu submit.
    if (step < 5) setStep(5);
    void handleSubmit();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="m-auto w-full max-w-lg max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] rounded-clay"
          >
            <CardClay className="!shadow-none !p-4 sm:!p-8">
              {jobError ? (
                <div className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-red-100 shadow-clay-inset"
                  >
                    <ServerOff size={28} className="text-red-500 sm:w-9 sm:h-9" />
                  </motion.div>
                  <h2 className="mt-4 sm:mt-6 text-xl sm:text-2xl font-extrabold px-2">
                    {isBusyError(jobError.message)
                      ? "Server sedang sibuk"
                      : "Gagal membuat catatan"}
                  </h2>
                  {jobError.code && (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-clay-full border-2 border-red-200 bg-red-50 px-3 py-1 text-xs font-extrabold text-red-600">
                      Kode error: {jobError.code}
                    </span>
                  )}
                  <p className="mt-3 max-w-md text-sm sm:text-base font-semibold text-clay-muted px-4">
                    {isBusyError(jobError.message)
                      ? "Server AI sedang sibuk atau kehabisan kuota. Tunggu sebentar lalu coba lagi — materi kamu tidak hilang."
                      : jobError.message}
                  </p>
                  <div className="mt-6 sm:mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row px-4">
                    <ButtonClay variant="secondary" onClick={close} className="w-full sm:w-auto">
                      Tutup
                    </ButtonClay>
                    <ButtonClay onClick={retrySubmit} className="w-full sm:w-auto">
                      <RotateCcw size={16} className="mr-2" />
                      Coba Lagi
                    </ButtonClay>
                  </div>
                </div>
              ) : createdNote ? (
                <div className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-clay-success shadow-clay-btn"
                  >
                    <PartyPopper size={36} className="text-white sm:w-11 sm:h-11" />
                  </motion.div>
                  <h2 className="mt-4 sm:mt-6 text-xl sm:text-2xl font-extrabold px-2">
                    Catatan berhasil dibuat!
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-md text-sm sm:text-base font-semibold text-clay-muted px-4">
                    &quot;{createdNote.title}&quot; sudah masuk ke dashboard kamu dan siap
                    dipelajari.
                  </p>
                  <div className="mt-6 sm:mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row px-4">
                    <ButtonClay variant="secondary" onClick={close} className="w-full sm:w-auto">
                      Selesai
                    </ButtonClay>
                    <ButtonClay onClick={openCreatedNote} className="w-full sm:w-auto">
                      <BookOpen size={18} className="mr-2" />
                      Buka Catatan
                    </ButtonClay>
                  </div>
                </div>
              ) : processing ? (
                <div className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12 text-center">
                  <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                    <div className="absolute inset-0 animate-ping rounded-full bg-clay-primary/30" />
                    <Loader2
                      size={48}
                      className="animate-spin text-clay-primary sm:w-16 sm:h-16"
                    />
                  </div>
                  <motion.p
                    key={progressMessage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 sm:mt-8 min-h-[28px] text-base sm:text-lg font-extrabold px-2"
                  >
                    {progressMessage}
                  </motion.p>
                  <div className="mt-4 sm:mt-6 w-full max-w-sm px-2">
                    <div className="flex justify-between text-xs font-extrabold text-clay-muted">
                      <span>Membuat catatan kamu...</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-5 sm:h-6 w-full overflow-hidden rounded-clay-full border-3 border-clay-shadow/40 bg-clay-inputBg shadow-clay-inset">
                      <motion.div
                        className="relative h-full rounded-clay-full bg-gradient-to-r from-clay-primary to-clay-accent shadow-clay-btn overflow-hidden"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 110,
                          damping: 22,
                        }}
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                      </motion.div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs sm:text-sm font-semibold text-clay-muted px-4">
                    Berjalan di latar belakang — kamu boleh pindah halaman.
                    Kami beri tahu lewat notifikasi saat selesai.
                  </p>
                  <button
                    onClick={close}
                    className="mt-4 text-xs sm:text-sm font-extrabold text-clay-primary underline-offset-2 hover:underline min-h-[44px] px-4"
                  >
                    Tutup & lanjutkan di latar belakang →
                  </button>
                  <button
                    onClick={stopProcessing}
                    disabled={!activeJobId || stoppingJob}
                    className="mt-2 flex items-center justify-center gap-2 rounded-clay-md border-2 border-red-200 bg-red-50 py-3 px-4 text-xs sm:text-sm font-extrabold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
                  >
                    <Square size={11} className="fill-current" />
                    {stoppingJob ? "Menghentikan..." : "Berhenti proses"}
                  </button>
                </div>
              ) : step === 1 ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold">Buat Catatan Baru</h2>
                      <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-clay-muted">
                        Pilih sumber materi — kamu bisa gabung sampai 5 sumber
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 1/5
                      </span>
                      <button
                        onClick={close}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px]"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                    {SOURCES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addSource(s.id)}
                        data-tutorial-id={`source-card-${s.id}`}
                        className={`relative card-clay flex flex-col items-start gap-2 border-clay-shadow/40 p-4 sm:p-5 text-left transition-all duration-75 hover:-translate-y-0.5 hover:border-clay-primary active:translate-y-1 min-h-[88px] ${
                          s.comingSoon ? "opacity-70" : ""
                        }`}
                      >
                        {s.comingSoon && (
                          <span className="absolute right-3 top-3 rounded-clay-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 shadow-clay-inset">
                            Soon
                          </span>
                        )}
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                          <s.icon size={20} className="text-clay-primary" />
                        </div>
                        <span className="text-base sm:text-lg font-extrabold">{s.label}</span>
                        <span className="text-xs sm:text-sm font-semibold text-clay-muted">
                          {s.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : step === 2 ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold">Atur Catatan</h2>
                      <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-clay-muted">
                        Pilih mata pelajaran dan preferensi gaya catatan
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 2/5
                      </span>
                      <button
                        onClick={close}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px]"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                    {/* Mata Pelajaran */}
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                        MATA PELAJARAN/KULIAH{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          className={selectClayClass}
                          value={addingSubject ? "__add__" : mataPelajaran}
                          onChange={(e) => {
                            if (e.target.value === "__add__") {
                              setAddingSubject(true);
                              setSubjectError(null);
                            } else {
                              setMataPelajaran(e.target.value);
                              setAddingSubject(false);
                            }
                          }}
                        >
                          <option value="">
                            {subjects.length ? "Pilih mata pelajaran..." : "Belum ada mata pelajaran — tambahkan dulu"}
                          </option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                          <option value="__add__">Tambah mata pelajaran baru...</option>
                        </select>
                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>

                      {addingSubject && (
                        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <InputClay
                            placeholder="Nama mata pelajaran (contoh: Teknologi)"
                            value={newSubjectName}
                            onChange={(e) => setNewSubjectName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addNewSubject();
                              if (e.key === "Escape") {
                                setAddingSubject(false);
                                setNewSubjectName("");
                                setSubjectError(null);
                              }
                            }}
                            className="flex-1"
                          />
                          <button
                            onClick={addNewSubject}
                            className="btn-clay-primary shrink-0 !min-h-[44px] !px-5 text-sm w-full sm:w-auto"
                          >
                            Tambah
                          </button>
                        </div>
                      )}
                      {subjectError && (
                        <p className="mt-2 text-xs sm:text-sm font-bold text-red-500">
                          {subjectError}
                        </p>
                      )}
                    </div>

                    {/* Terjemahkan (web/youtube/dokumen) — hanya bila ada sumber non-soal */}
                    {sources.some((s) => !isSoalSource(s.type)) && (
                      <div>
                        <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                          TERJEMAHKAN KE BAHASA INDONESIA
                        </label>
                        <button
                          type="button"
                          onClick={() => setTranslateToIndo((v) => !v)}
                          aria-pressed={translateToIndo}
                          className={`flex w-full items-center gap-3 rounded-clay-md border-3 p-3 sm:p-4 text-left transition-all duration-75 min-h-[56px] ${
                            translateToIndo
                              ? "border-clay-borderLight bg-clay-primary/10 shadow-clay-sm"
                              : "border-clay-shadow/50 bg-white shadow-clay-sm hover:-translate-y-0.5"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                              translateToIndo
                                ? "bg-clay-primary text-white"
                                : "bg-clay-beige text-clay-muted shadow-clay-inset"
                            }`}
                          >
                            <Languages size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-clay-dark">
                              {translateToIndo ? "Aktif — diterjemahkan ke Indonesia" : "Matikan terjemahan"}
                            </span>
                            <span className="block text-xs font-bold text-clay-muted">
                              Cocok untuk artikel/link berbahasa asing (Inggris, dll).
                            </span>
                          </span>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                              translateToIndo
                                ? "border-clay-primary bg-clay-primary text-white"
                                : "border-clay-shadow/40 bg-white text-transparent"
                            }`}
                          >
                            <CheckCircle2 size={14} />
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Mode Belajar */}
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                        MODE BELAJAR
                      </label>
                      <div className="flex gap-2 sm:gap-3">
                        {STUDY_MODES.map((mode) => {
                          const active = studyMode === mode.value;
                          return (
                            <button
                              key={mode.value}
                              onClick={() => setStudyMode(mode.value)}
                              className={`flex flex-1 flex-col items-center rounded-clay-md border-3 p-2 sm:p-3 transition-all duration-75 min-h-[56px] ${
                                active
                                  ? "border-clay-borderLight bg-clay-primary text-white shadow-[0_6px_0_#5B21B6]"
                                  : "border-clay-shadow/50 bg-white text-clay-dark shadow-clay-sm hover:-translate-y-0.5"
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-extrabold">
                                {mode.label}
                              </span>
                              <span
                                className={`text-[10px] sm:text-[11px] font-bold ${
                                  active ? "text-white/85" : "text-clay-muted"
                                }`}
                              >
                                {mode.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gaya Penulisan */}
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                        GAYA PENULISAN
                      </label>
                      <div className="relative">
                        <select
                          className={selectClayClass}
                          value={gayaPenulisan}
                          onChange={(e) => setGayaPenulisan(e.target.value)}
                        >
                          {WRITING_STYLES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>
                    </div>

                    {/* Bahasa */}
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                        BAHASA
                      </label>
                      <div className="relative">
                        <select
                          className={selectClayClass}
                          value={bahasa}
                          onChange={(e) => setBahasa(e.target.value)}
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>
                    </div>

                    {/* Sumber materi — daftar (maks 5) */}
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="block text-xs sm:text-sm font-extrabold text-clay-dark">
                          SUMBER MATERI ({sources.length}/{MAX_SOURCES})
                        </label>
                        {sources.length < MAX_SOURCES && (
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="flex items-center gap-1 rounded-clay-full border-2 border-clay-primary/40 bg-clay-primary/10 px-3 py-1 text-xs font-extrabold text-clay-primary transition-colors hover:bg-clay-primary/20"
                          >
                            <Plus size={14} /> Tambah Sumber
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {sources.map((src, idx) => {
                          const srcLabel = sourceLabel(src.type);
                          return (
                            <div
                              key={src.id}
                              className="rounded-clay-md border-3 border-clay-shadow/40 bg-white p-3 sm:p-4"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-clay-dark">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset text-[11px]">
                                    {idx + 1}
                                  </span>
                                  {srcLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeSource(src.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-red-50 hover:text-red-500"
                                  aria-label={`Hapus ${srcLabel}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>

                              {isSoalSource(src.type) ? (
                                <textarea
                                  value={src.soalText ?? ""}
                                  onChange={(e) =>
                                    updateSource(src.id, { soalText: e.target.value })
                                  }
                                  placeholder={sourcePlaceholder(src.type)}
                                  rows={6}
                                  className="w-full resize-y rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm sm:px-4 sm:text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[100px]"
                                />
                              ) : isLinkSource(src.type) ? (
                                <InputClay
                                  placeholder={sourcePlaceholder(src.type)}
                                  value={src.link ?? ""}
                                  onChange={(e) =>
                                    updateSource(src.id, { link: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && canSubmit) setStep(3);
                                  }}
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => fileInputRefs.current[idx]?.click()}
                                    className={`flex w-full items-center justify-center gap-3 rounded-clay-md border-3 border-dashed px-4 py-5 sm:px-5 text-sm sm:text-base font-extrabold transition-all duration-75 active:translate-y-1 min-h-[64px] ${
                                      src.file
                                        ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                                        : "border-clay-shadow/60 text-clay-muted hover:border-clay-primary"
                                    }`}
                                  >
                                    <Upload size={20} className="sm:block hidden" />
                                    <Upload size={24} className="sm:hidden block" />
                                    <span className="text-center">
                                      {src.file ? src.file.name : `Pilih file ${srcLabel}...`}
                                    </span>
                                  </button>
                                  <input
                                    ref={(el) => {
                                      fileInputRefs.current[idx] = el;
                                    }}
                                    type="file"
                                    accept={sourceAccept(src.type)}
                                    className="hidden"
                                    onChange={(e) => {
                                      const picked = e.target.files?.[0] ?? null;
                                      if (picked && picked.size > MAX_UPLOAD_BYTES) {
                                        updateSource(src.id, { file: null });
                                        setError(
                                          `File terlalu besar (${formatBytes(picked.size)}). Maksimal ${formatBytes(MAX_UPLOAD_BYTES)} — unggah versi ringkas atau gunakan link YouTube/Web.`
                                        );
                                        e.target.value = "";
                                        return;
                                      }
                                      updateSource(src.id, { file: picked });
                                      setError(null);
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {sources.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="flex w-full items-center justify-center gap-2 rounded-clay-md border-3 border-dashed border-clay-shadow/60 px-4 py-6 text-sm sm:text-base font-extrabold text-clay-muted transition-all duration-75 hover:border-clay-primary hover:text-clay-primary"
                        >
                          <Plus size={18} /> Pilih sumber materi
                        </button>
                      )}
                    </div>

                    {error && (
                      <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-red-600">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 sm:mt-8 flex flex-col gap-3 border-t-2 border-clay-shadow/20 pt-4 sm:pt-5 sm:flex-row sm:justify-end">
                    <ButtonClay
                      variant="secondary"
                      onClick={() => {
                        setStep(1);
                        setError(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Kembali
                    </ButtonClay>
                    <ButtonClay
                      onClick={() => {
                        setError(null);
                        setStep(3);
                      }}
                      disabled={!canSubmit}
                      className="w-full sm:w-auto"
                    >
                      Lanjut
                    </ButtonClay>
                  </div>
                </>
              ) : step === 3 ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold">Jenis Rangkuman</h2>
                      <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-clay-muted">
                        Pilih bentuk catatan yang kamu mau
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 3/5
                      </span>
                      <button
                        onClick={close}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px]"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                    {NOTE_TYPES.map((nt) => {
                      const active = noteType === nt.value;
                      const TypeIcon = emojiToIcon(nt.icon);
                      return (
                        <button
                          key={nt.value}
                          type="button"
                          onClick={() => setNoteType(nt.value)}
                          aria-pressed={active}
                          className={`relative card-clay w-full p-4 sm:p-5 text-left transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 ${
                            active
                              ? "border-clay-primary shadow-clay-btn"
                              : "border-clay-shadow/40"
                          }`}
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                              <TypeIcon size={20} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base sm:text-lg font-extrabold">
                                  {nt.title}
                                </span>
                                <span
                                  className="rounded-clay-full bg-clay-primary/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-clay-primary shadow-clay-inset"
                                >
                                  {nt.badge}
                                </span>
                              </div>
                              <p className="mt-1 text-xs sm:text-sm font-semibold text-clay-muted">
                                {nt.desc}
                              </p>
                            </div>
                            <span
                              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                                active
                                  ? "border-clay-primary bg-clay-primary text-white"
                                  : "border-clay-shadow/40 bg-white text-transparent"
                              }`}
                            >
                              <CheckCircle2 size={14} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 sm:mt-8 flex flex-col gap-3 border-t-2 border-clay-shadow/20 pt-4 sm:pt-5 sm:flex-row sm:justify-end">
                    <ButtonClay
                      variant="secondary"
                      onClick={() => {
                        setStep(2);
                        setError(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Kembali
                    </ButtonClay>
                    <ButtonClay
                      onClick={() => {
                        setError(null);
                        setStep(4);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Lanjut
                    </ButtonClay>
                  </div>
                </>
              ) : step === 4 ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold">Jumlah Bab</h2>
                      <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-clay-muted">
                        Pilih berapa bab yang ingin dibuat dari materi kamu
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 4/5
                      </span>
                      <button
                        onClick={close}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px]"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6">
                    <div className="card-clay flex flex-wrap items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6">
                      {[1, 2, 3, 4, 5, 6].map((n) => {
                        const active = chapterCount === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setChapterCount(n)}
                            className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-clay-md border-2 text-lg sm:text-xl font-extrabold transition-all duration-75 min-h-[44px] min-w-[44px] ${
                              active
                                ? "border-clay-primary bg-clay-primary text-white shadow-clay-btn -translate-y-0.5"
                                : "border-clay-shadow/40 bg-clay-inputBg text-clay-dark shadow-clay-inset hover:border-clay-primary"
                            }`}
                            aria-pressed={active}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-center text-xs sm:text-sm font-semibold text-clay-muted">
                      Catatan: maksimal 6 bab. Bab akan dibagi otomatis dari materi kamu.
                    </p>
                  </div>

                  <div className="mt-6 sm:mt-8 flex flex-col gap-3 border-t-2 border-clay-shadow/20 pt-4 sm:pt-5 sm:flex-row sm:justify-end">
                    <ButtonClay
                      variant="secondary"
                      onClick={() => {
                        setStep(3);
                        setError(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Kembali
                    </ButtonClay>
                    <ButtonClay
                      onClick={() => {
                        setError(null);
                        setStep(5);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Lanjut
                    </ButtonClay>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold">Mode Pembuatan</h2>
                      <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-clay-muted">
                        Pilih seberapa cepat &amp; detail hasil catatannya
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 5/5
                      </span>
                      <button
                        onClick={close}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px]"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                    {GENERATION_MODES.map((mode) => {
                      const active = generationMode === mode.value;
                      const ModeIcon = emojiToIcon(mode.icon);
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => {
                            // Mode Cepat maksimal 3 bab — turunkan otomatis
                            // bila user sudah memilih 4-6 di langkah Jumlah Bab.
                            setGenerationMode(mode.value);
                            if (mode.value === "cepat" && chapterCount > 3) {
                              setChapterCount(3);
                              setError(
                                "Mode Cepat maksimal 3 bab — jumlah bab disesuaikan ke 3."
                              );
                            }
                          }}
                          aria-pressed={active}
                          className={`relative card-clay w-full p-4 sm:p-5 text-left transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 ${
                            active
                              ? "border-clay-primary shadow-clay-btn"
                              : "border-clay-shadow/40"
                          }`}
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                              <ModeIcon size={20} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base sm:text-lg font-extrabold">
                                  {mode.title}
                                </span>
                                <span
                                  className={`rounded-clay-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-clay-inset ${
                                    mode.value === "lengkap"
                                      ? "bg-clay-primary/15 text-clay-primary"
                                      : "bg-amber-200 text-amber-800"
                                  }`}
                                >
                                  {mode.badge}
                                </span>
                                <span className="text-xs font-bold text-clay-muted">
                                  {mode.time}
                                </span>
                              </div>
                              <p className="mt-1 text-xs sm:text-sm font-semibold text-clay-muted">
                                {mode.desc}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                                {mode.features.map((f) => (
                                  <span
                                    key={f}
                                    className="rounded-clay-full border-2 border-clay-shadow/30 bg-clay-beige px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-clay-dark"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span
                              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                                active
                                  ? "border-clay-primary bg-clay-primary text-white"
                                  : "border-clay-shadow/40 bg-white text-transparent"
                              }`}
                            >
                              <CheckCircle2 size={14} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-center text-xs sm:text-sm font-semibold text-clay-muted">
                    {generationMode === "cepat"
                      ? "Mode Cepat membatasi jumlah bab maksimal 3 &amp; tanpa kuis/flashcards — paling pas untuk materi singkat atau saat buru-buru."
                      : "Mode Lengkap melewati semua fase validasi &amp; enrichment — hasil paling maksimal, butuh waktu lebih lama."}
                  </p>

                  <div className="mt-6 sm:mt-8 flex flex-col gap-3 border-t-2 border-clay-shadow/20 pt-4 sm:pt-5 sm:flex-row sm:justify-end">
                    <ButtonClay
                      variant="secondary"
                      onClick={() => {
                        setStep(4);
                        setError(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Kembali
                    </ButtonClay>
                    <ButtonClay onClick={handleSubmit} className="w-full sm:w-auto">
                      <CheckCircle2 size={18} className="mr-2" />
                      Buat Catatan
                    </ButtonClay>
                  </div>
                </>
              )}
            </CardClay>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
