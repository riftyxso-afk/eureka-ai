"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  },
  {
    id: "video",
    label: "Video",
    desc: "MP4, MOV",
    icon: Video,
    accept: "video/*",
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
  "🧠 Menganalisis materi kamu...",
  "📄 Mengekstrak konten teks...",
  "✂️ Memecah menjadi potongan kecil...",
  "🧲 Mengubah menjadi vektor (embedding)...",
  "📦 Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_YOUTUBE = [
  "🎬 Mengambil subtitle video...",
  "✨ Merangkum subtitle dengan AI...",
  "✂️ Memecah menjadi potongan kecil...",
  "🧲 Mengubah menjadi vektor (embedding)...",
  "📦 Menyimpan ke knowledge base...",
];

const PROCESS_STEPS_WEB = [
  "🌐 Membaca halaman web...",
  "🖼️ Mengumpulkan gambar halaman...",
  "✍️ Menulis bab satu per satu dengan AI...",
  "🧲 Mengubah menjadi vektor (embedding)...",
  "📦 Menyimpan ke knowledge base...",
];

interface CreateNoteModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (note: Note) => void;
}

const selectClayClass =
  "w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 pr-12 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none";

export const CreateNoteModal = ({
  open,
  onClose,
  onCreate,
}: CreateNoteModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSource, setSelectedSource] = useState("dokumen");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [mataPelajaran, setMataPelajaran] = useState("");
  const [studyMode, setStudyMode] = useState<"ringkas" | "standar" | "lengkap">(
    "standar"
  );
  const [gayaPenulisan, setGayaPenulisan] = useState("Ramah & Santai");
  const [bahasa, setBahasa] = useState("Bahasa Indonesia");
  const [processing, setProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [createdNote, setCreatedNote] = useState<Note | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const doneHandledRef = useRef(false);
  const router = useRouter();

  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch("/api/subjects");
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects ?? []);
      }
    } catch {
      // biarkan kosong
    }
  }, []);

  useEffect(() => {
    if (open && step === 2) loadSubjects();
  }, [open, step, loadSubjects]);

  const addNewSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      setSubjectError("Nama mata pelajaran kosong.");
      return;
    }
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah pelajaran.");
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
    setError(null);
    setProgressPercent(0);
    setProgressMessage("");
    setAddingSubject(false);
    setNewSubjectName("");
    setSubjectError(null);
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
    onClose();
  };

  // Tutup SSE bila modal ditutup tanpa melalui close() (mis. unmount).
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

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
    setSelectedSource(id);
    setFile(null);
    setLink("");
    setError(null);
    setStep(2);
  };

  /**
   * SSE melaporkan 100% (selesai ATAU gagal — dicek lewat status job).
   * Ambil catatan jadi → tampilkan panel sukses.
   */
  const completeFromJob = async (jobId: string) => {
    if (doneHandledRef.current) return;
    doneHandledRef.current = true;
    try {
      const jres = await fetch(`/api/notes/jobs/${encodeURIComponent(jobId)}`);
      const jdata = await jres.json();
      const job = jdata?.job;
      if (!job) return;
      if (job.status === "error") {
        removeActiveJobId(jobId);
        setError(job.error || "Gagal memproses materi. Coba lagi.");
        setProcessing(false);
        return;
      }
      if (job.status !== "done" || !job.noteId) return; // biarkan watcher yang menuntaskan
      const nres = await fetch(`/api/notes/${job.noteId}`);
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
    // modal tampil — job berjalan di latar belakang walau modal ditutup).
    const eventSource = new EventSource(
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
        // event bukan JSON — abaikan
      }
    };

    try {
      const res = await fetch("/api/notes/process", {
        method: "POST",
        body: form,
        headers: { "x-session-id": sessionId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses materi.");

      // 202: job berjalan di latar belakang.
      if (data.jobId) {
        jobId = String(data.jobId);
        addActiveJobId(jobId);
        setProgressMessage(
          "Materi sedang dirangkum di latar belakang — kamu boleh lanjut menjelajah"
        );
        // Minta izin notifikasi browser (sekali) agar selesai tetap terasa.
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "default"
        ) {
          Notification.requestPermission().catch(() => {});
        }
        return; // SSE tetap terbuka; job dituntaskan via completeFromJob/watcher.
      }

      // Jalur lama (server memproses sinkron — seharusnya tidak terjadi).
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <CardClay className="shadow-clay-lg">
              {createdNote ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-clay-success shadow-clay-btn"
                  >
                    <PartyPopper size={44} className="text-white" />
                  </motion.div>
                  <h2 className="mt-6 text-2xl font-extrabold">
                    Catatan berhasil dibuat! 🎉
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-md text-base font-semibold text-clay-muted">
                    “{createdNote.title}” sudah masuk ke dashboard kamu dan siap
                    dipelajari.
                  </p>
                  <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <ButtonClay variant="secondary" onClick={close}>
                      Selesai
                    </ButtonClay>
                    <ButtonClay onClick={openCreatedNote}>
                      <BookOpen size={18} className="mr-2" />
                      Buka Catatan
                    </ButtonClay>
                  </div>
                </div>
              ) : processing ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 animate-ping rounded-full bg-clay-primary/30" />
                    <Loader2
                      size={64}
                      className="animate-spin text-clay-primary"
                    />
                  </div>
                  <motion.p
                    key={progressMessage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 min-h-[28px] text-lg font-extrabold"
                  >
                    {progressMessage}
                  </motion.p>
                  <div className="mt-6 w-full max-w-sm">
                    <div className="flex justify-between text-xs font-extrabold text-clay-muted">
                      <span>Membuat catatan kamu...</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="mt-2 h-6 w-full overflow-hidden rounded-clay-full border-3 border-clay-shadow/40 bg-clay-inputBg shadow-clay-inset">
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
                  <p className="mt-4 text-sm font-semibold text-clay-muted">
                    Berjalan di latar belakang — kamu boleh pindah halaman.
                    Kami beri tahu lewat notifikasi saat selesai.
                  </p>
                  <button
                    onClick={close}
                    className="mt-4 text-sm font-extrabold text-clay-primary underline-offset-2 hover:underline"
                  >
                    Tutup & lanjutkan di latar belakang →
                  </button>
                </div>
              ) : step === 1 ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-extrabold">Buat Catatan Baru</h2>
                      <p className="mt-2 text-base font-semibold text-clay-muted">
                        Pilih sumber materi kamu
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-clay-full bg-clay-inputBg px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 1/2
                      </span>
                      <button
                        onClick={close}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {SOURCES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => pickSource(s.id)}
                        className="card-clay flex flex-col items-start gap-2 border-clay-shadow/40 p-5 text-left transition-all duration-75 hover:-translate-y-0.5 hover:border-clay-primary active:translate-y-1"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                          <s.icon size={20} className="text-clay-primary" />
                        </div>
                        <span className="text-lg font-extrabold">{s.label}</span>
                        <span className="text-sm font-semibold text-clay-muted">
                          {s.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-extrabold">Atur Catatan</h2>
                      <p className="mt-2 text-base font-semibold text-clay-muted">
                        Pilih mata pelajaran dan preferensi gaya catatan
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-clay-full bg-clay-inputBg px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                        Langkah 2/2
                      </span>
                      <button
                        onClick={close}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
                        aria-label="Tutup modal"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-6">
                    {/* Mata Pelajaran */}
                    <div>
                      <label className="mb-2 block text-sm font-extrabold text-clay-dark">
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
                              {s.emoji} {s.name}
                            </option>
                          ))}
                          <option value="__add__">➕ Tambah mata pelajaran baru...</option>
                        </select>
                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>

                      {addingSubject && (
                        <div className="mt-3 flex items-center gap-2">
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
                          />
                          <button
                            onClick={addNewSubject}
                            className="btn-clay-primary shrink-0 !min-h-[44px] !px-5 text-sm"
                          >
                            Tambah
                          </button>
                        </div>
                      )}
                      {subjectError && (
                        <p className="mt-2 text-sm font-bold text-red-500">
                          {subjectError}
                        </p>
                      )}
                    </div>

                    {/* Mode Belajar */}
                    <div>
                      <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                        MODE BELAJAR
                      </label>
                      <div className="flex gap-3">
                        {STUDY_MODES.map((mode) => {
                          const active = studyMode === mode.value;
                          return (
                            <button
                              key={mode.value}
                              onClick={() => setStudyMode(mode.value)}
                              className={`flex flex-1 flex-col items-center rounded-clay-md border-3 p-3 transition-all duration-75 ${
                                active
                                  ? "border-clay-borderLight bg-clay-primary text-white shadow-[0_6px_0_#5B21B6]"
                                  : "border-clay-shadow/50 bg-white text-clay-dark shadow-clay-sm hover:-translate-y-0.5"
                              }`}
                            >
                              <span className="text-sm font-extrabold">
                                {mode.label}
                              </span>
                              <span
                                className={`text-[11px] font-bold ${
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
                      <label className="mb-2 block text-sm font-extrabold text-clay-dark">
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
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>
                    </div>

                    {/* Bahasa */}
                    <div>
                      <label className="mb-2 block text-sm font-extrabold text-clay-dark">
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
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-clay-muted"
                        />
                      </div>
                    </div>

                    {/* Sumber materi */}
                    <div>
                      <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                        SUMBER MATERI ({current.label})
                      </label>
                      {isLinkSource ? (
                        <InputClay
                          placeholder={current.placeholder}
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex w-full items-center justify-center gap-3 rounded-clay-md border-3 border-dashed px-5 py-6 text-base font-extrabold transition-all duration-75 active:translate-y-1 ${
                              file
                                ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                                : "border-clay-shadow/60 text-clay-muted hover:border-clay-primary"
                            }`}
                          >
                            <Upload size={20} />
                            {file ? file.name : `Pilih file ${current.label}...`}
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={current.accept}
                            className="hidden"
                            onChange={(e) => {
                              setFile(e.target.files?.[0] ?? null);
                              setError(null);
                            }}
                          />
                        </>
                      )}
                    </div>

                    {error && (
                      <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 border-t-2 border-clay-shadow/20 pt-5 sm:flex-row sm:justify-end">
                    <ButtonClay
                      variant="secondary"
                      onClick={() => {
                        setStep(1);
                        setError(null);
                      }}
                    >
                      Kembali
                    </ButtonClay>
                    <ButtonClay onClick={handleSubmit} disabled={!canSubmit}>
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
