"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiEventSource } from "@/lib/apiClient";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Loader2,
  Music,
  PartyPopper,
  Square,
  SquarePlay,
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
import { playCompletionSound } from "@/lib/notifySound";
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

const STUDY_MODES = [
  { value: "ringkas", label: "Ringkas", desc: "Poin penting saja" },
  { value: "standar", label: "Standar", desc: "Seimbang" },
  { value: "lengkap", label: "Lengkap", desc: "Detail & mendalam" },
] as const;

const WRITING_STYLES = ["Ramah & Santai", "Formal & Akademis", "Santai & Gaul"];
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
  "ðŸ§  Menganalisis materi kamu...",
  "ðŸ“„ Mengekstrak konten teks...",
  "âœ‚ï¸ Memecah menjadi potongan kecil...",
  "ðŸ§² Mengubah menjadi vektor (embedding)...",
  "ðŸ“¦ Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_YOUTUBE = [
  "ðŸŽ¬ Mengambil subtitle video...",
  "âœ¨ Merangkum subtitle dengan AI...",
  "âœ‚ï¸ Memecah menjadi potongan kecil...",
  "ðŸ§² Mengubah menjadi vektor (embedding)...",
  "ðŸ“¦ Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_WEB = [
  "ðŸŒ Membaca halaman web...",
  "ðŸ–¼ï¸ Mengumpulkan gambar halaman...",
  "âœï¸ Menulis bab satu per satu dengan AI...",
  "ðŸ§² Mengubah menjadi vektor (embedding)...",
  "ðŸ“¦ Menyimpan ke knowledge base...",
];

// Batas unggah: platform serverless membatasi body request (~4.5MB).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSource, setSelectedSource] = useState("dokumen");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [mataPelajaran, setMataPelajaran] = useState("");
  const [studyMode, setStudyMode] = useState<"ringkas" | "standar" | "lengkap">(
    "standar"
  );
  const [gayaPenulisan, setGayaPenulisan] = useState("Ramah & Santai");
  const [bahasa, setBahasa] = useState("Bahasa Indonesia");
  const [chapterCount, setChapterCount] = useState(4);
  const [processing, setProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [createdNote, setCreatedNote] = useState<Note | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [stoppingJob, setStoppingJob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
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

  const current = SOURCES.find((s) => s.id === selectedSource)!;
  const isLinkSource = selectedSource === "youtube" || selectedSource === "web";
  const processSteps =
    selectedSource === "youtube"
      ? PROCESS_STEPS_YOUTUBE
      : selectedSource === "web"
        ? PROCESS_STEPS_WEB
        : PROCESS_STEPS;
  const canSubmit =
    !processing &&
    Boolean(mataPelajaran) &&
    (isLinkSource ? link.trim().length > 5 : Boolean(file));

  const reset = () => {
    setStep(1);
    setFile(null);
    setLink("");
    setMataPelajaran("");
    setStudyMode("standar");
    setGayaPenulisan("Ramah & Santai");
    setBahasa("Bahasa Indonesia");
    setChapterCount(4);
    setError(null);
    setProgressPercent(0);
    setProgressMessage("");
    setAddingSubject(false);
    setNewSubjectName("");
    setSubjectError(null);
    setActiveJobId(null);
    setStoppingJob(false);
  };

  const close = () => {
    // Selama proses berjalan di latar belakang, modal BOLEH ditutup â€”
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
    onClose();
  };

  // Tutup SSE bila modal ditutup tanpa melalui close() (mis. unmount).
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
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

  const pickSource = (id: string) => {
    const src = SOURCES.find((s) => s.id === id);
    if (src?.comingSoon) {
      setError("Sumber ini belum tersedia. Segera hadir! âœ¨");
      return;
    }
    setError(null);
    setSelectedSource(id);
    setFile(null);
    setLink("");
    setStep(2);
  };

  /**
   * SSE melaporkan 100% (selesai ATAU gagal â€” dicek lewat status job).
   * Ambil catatan jadi â†’ tampilkan panel sukses.
   */
  const completeFromJob = async (jobId: string) => {
    if (doneHandledRef.current) return;
    try {
      const jres = await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobId)}`);
      // Job hilang (server restart / kedaluwarsa) â†’ hentikan proses dengan pesan jelas.
      if (jres.status === 404) {
        doneHandledRef.current = true;
        removeActiveJobId(jobId);
        setError(
          "Proses terhenti karena server sempat restart. Silakan coba buat catatan lagi."
        );
        setProcessing(false);
        return;
      }
      const jdata = await jres.json();
      const job = jdata?.job;
      if (!job) return;
      if (job.status === "error") {
        doneHandledRef.current = true;
        removeActiveJobId(jobId);
        setError(job.error || "Gagal memproses materi. Coba lagi.");
        setProcessing(false);
        return;
      }
      if (job.status !== "done" || !job.noteId) return; // belum selesai â€” tunggu panggilan berikutnya
      doneHandledRef.current = true;
      const nres = await apiFetch(`/api/notes/${job.noteId}`);
      const ndata = await nres.json();
      if (nres.ok && ndata.note) {
        removeActiveJobId(jobId);
        playCompletionSound();
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
    setProcessing(true);
    setError(null);
    setProgressPercent(0);
    setProgressMessage(processSteps[0]);
    doneHandledRef.current = false;

    const form = new FormData();
    form.append("sourceType", selectedSource);
    form.append("mataPelajaran", mataPelajaran);
    form.append("studyMode", studyMode);
    form.append("gayaPenulisan", gayaPenulisan);
    form.append("bahasa", bahasa);
    form.append("chapterCount", String(chapterCount));
    form.append("userId", getUserId());
    if (isLinkSource) form.append("url", link.trim());
    else if (file) form.append("file", file);

    // Session ID untuk progress stream SSE
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    form.append("sessionId", sessionId);

    // Progress realtime 0-100% via Server-Sent Events (tetap terbuka selama
    // modal tampil â€” job berjalan di latar belakang walau modal ditutup).
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
        setProgressMessage(progress.message);
        if (progress.percent >= 100 && jobId) {
          void completeFromJob(jobId);
        }
      } catch {
        // event bukan JSON â€” abaikan
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
        setProgressMessage(
          "Materi sedang dirangkum di latar belakang â€” kamu boleh lanjut menjelajah"
        );
        // Race: SSE bisa melaporkan 100% sebelum jobId diterima di atas.
        // Cek status job sekali langsung setelah dapat jobId.
        void completeFromJob(jobId);
        // Minta izin notifikasi browser (sekali) agar selesai tetap terasa.
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "default"
        ) {
          Notification.requestPermission().catch(() => {});
        }
        return; // SSE tetap terbuka; job dituntaskan via completeFromJob/watcher.
      }

      // Jalur lama (server memproses sinkron â€” seharusnya tidak terjadi).
      setProgressPercent(100);
      setProgressMessage("Selesai!");
      setCreatedNote(data.note as Note);
      setProcessing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setProcessing(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 pb-[max(8px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="m-auto w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-t-clay sm:rounded-clay"
          >
            <CardClay className="shadow-clay-lg !p-4 sm:!p-8">
              {createdNote ? (
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
                    Catatan berhasil dibuat! ðŸŽ‰
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
                    Berjalan di latar belakang â€” kamu boleh pindah halaman.
                    Kami beri tahu lewat notifikasi saat selesai.
                  </p>
                  <button
                    onClick={close}
                    className="mt-4 text-xs sm:text-sm font-extrabold text-clay-primary underline-offset-2 hover:underline min-h-[44px] px-4"
                  >
                    Tutup & lanjutkan di latar belakang â†’
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
                        Pilih sumber materi kamu
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className="rounded-clay-full bg-clay-inputBg px-2 sm:px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 1/3
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
                        onClick={() => pickSource(s.id)}
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
                        Langkah 2/3
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
                            {subjects.length ? "Pilih mata pelajaran..." : "Belum ada mata pelajaran â€” tambahkan dulu"}
                          </option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.emoji} {s.name}
                            </option>
                          ))}
                          <option value="__add__">âž• Tambah mata pelajaran baru...</option>
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

                    {/* Sumber materi */}
                    <div>
                      <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                        SUMBER MATERI ({current.label})
                      </label>
                      {isLinkSource ? (
                        <InputClay
                          placeholder={current.placeholder}
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canSubmit) setStep(3);
                          }}
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex w-full items-center justify-center gap-3 rounded-clay-md border-3 border-dashed px-4 py-8 sm:px-5 sm:py-6 text-sm sm:text-base font-extrabold transition-all duration-75 active:translate-y-1 min-h-[88px] ${
                              file
                                ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                                : "border-clay-shadow/60 text-clay-muted hover:border-clay-primary"
                            }`}
                          >
                            <Upload size={20} className="sm:block hidden" />
                            <Upload size={24} className="sm:hidden block" />
                            <span className="text-center">{file ? file.name : `Pilih file ${current.label}...`}</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={current.accept}
                            className="hidden"
                            onChange={(e) => {
                              const picked = e.target.files?.[0] ?? null;
                              if (picked && picked.size > MAX_UPLOAD_BYTES) {
                                setFile(null);
                                setError(
                                  `File terlalu besar (${formatBytes(picked.size)}). Maksimal ${formatBytes(MAX_UPLOAD_BYTES)} â€” unggah versi ringkas atau gunakan link YouTube/Web.`
                                );
                                e.target.value = "";
                                return;
                              }
                              setFile(picked);
                              setError(null);
                            }}
                          />
                        </>
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
              ) : (
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
                        Langkah 3/3
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
                        setStep(2);
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
