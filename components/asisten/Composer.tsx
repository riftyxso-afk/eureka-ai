"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  Gem,
  Globe,
  Layers,
  Leaf,
  Loader2,
  Mic,
  Paperclip,
  PhoneCall,
  Send,
  Square,
  Terminal,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { ChatAttachment } from "@/lib/assistant/types";
import {
  NoteCreateWizardPanel,
  type NoteCreatePrefs,
} from "@/components/note/NoteCreateWizard";

/** Batas ukuran file upload (~3MB) — setelah diproses jadi dataUrl. */
const MAX_FILE_BYTES = 3 * 1024 * 1024;
/** Batas panjang dataUrl yang dikirim ke server (matching route). */
const MAX_DATA_URL = 4_400_000;
const ACCEPTED_TYPES =
  "image/*,.pdf,.doc,.docx,.pptx,.xlsx,.csv,.txt,.md,.odt,.rtf";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

/** Kecilkan gambar lewat canvas (maks dimensi) agar upload ringan & cepat. */
async function downscaleImage(
  dataUrl: string,
  mime: string,
  maxDim: number
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal memuat gambar."));
    el.src = dataUrl;
  });
  const { width, height } = img;
  if (width <= maxDim && height <= maxDim) return dataUrl;
  const scale = Math.min(maxDim / width, maxDim / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime === "image/png" ? "image/png" : "image/jpeg", 0.82);
}

export interface MentionOption {
  id: string;
  title: string;
  subject?: string | null;
}

export interface ComposerSendInput {
  question: string;
  mentions: string[];
  webSearch?: boolean;
  attachment?: ChatAttachment | null;
  /** Kecepatan jawaban AI yang dipilih user di composer. */
  speedMode?: "fast" | "normal" | "deep";
}

/** 3 mode kecepatan AI — label & deskripsi untuk UI selector. */
const SPEED_OPTIONS = [
  {
    value: "fast",
    label: "Kilat",
    desc: "Jawaban tercepat — pas untuk sekadar cek cepat",
    icon: Zap,
    active: "bg-amber-500/15 text-amber-600",
    dot: "bg-amber-500",
  },
  {
    value: "normal",
    label: "Seimbang",
    desc: "Cepat & akurat — rekomendasi untuk sehari-hari",
    icon: Leaf,
    active: "bg-emerald-500/15 text-emerald-600",
    dot: "bg-emerald-500",
  },
  {
    value: "deep",
    label: "Mendalam",
    desc: "Kualitas terbaik — jawaban panjang & detail, lebih lama",
    icon: Gem,
    active: "bg-clay-primary/15 text-clay-primary",
    dot: "bg-clay-primary",
  },
] as const;

type SpeedMode = (typeof SPEED_OPTIONS)[number]["value"];

const SPEED_STORAGE_KEY = "eureka_chat_speed_mode";

/**
 * Perintah cepat chat — muncul di popover saat user mengetik "/".
 * id = teks yang diisi ke composer; diproses exact-match di halaman chat
 * (detectStudyCommand di lib/assistant/studyContext).
 */
const COMMANDS = [
  {
    id: "/kuis",
    desc: "Buat kuis dari percakapan sesi ini",
    icon: ClipboardList,
  },
  {
    id: "/card",
    desc: "Buat flashcards dari percakapan sesi ini",
    icon: Layers,
  },
] as const;

interface ComposerProps {
  userId: string;
  sending: boolean;
  disabled?: boolean;
  /** Isi awal — dipakai suggestion chips: berubah → teks ikut berubah + fokus. */
  initialValue?: string;
  /**
   * Catatan yang langsung ter-lampirkan saat composer dibuka
   * (mis. tombol "Tanya AI" di halaman note → /chat/[id]?note=xxx).
   */
  initialMentions?: string[];
  /** Mode ringkas: padding & tombol lebih kecil (dipakai halaman /home). */
  compact?: boolean;
  /**
   * Prompt "buat catatan" yang tertahan — memunculkan wizard F&Q yang
   * menyatu di atas composer (bukan popup). null = tidak tampil.
   */
  noteWizardPrompt?: string | null;
  /** User selesai menjawab wizard → mulai generate dengan prefs ini. */
  onNoteWizardStart?: (prefs: NoteCreatePrefs) => void;
  /** User menutup wizard tanpa jadi generate. */
  onNoteWizardClose?: () => void;
  /** Beta tester: tampilkan tombol mic & panggilan AI. */
  isBeta?: boolean;
  /** User menekan tombol panggilan AI → parent membuka modal. */
  onCall?: () => void;
  onSend: (input: ComposerSendInput) => void;
  onStop?: () => void;
}

/**
 * Composer prompt asisten — mendukung mention catatan dengan "@":
 * ketik @ → popover autocomplete → pilih → chip mention muncul di atas.
 */
export default function Composer({
  userId,
  sending,
  disabled = false,
  initialValue = "",
  initialMentions = [],
  compact = false,
  noteWizardPrompt = null,
  onNoteWizardStart,
  onNoteWizardClose,
  isBeta = false,
  onCall,
  onSend,
  onStop,
}: ComposerProps) {
  const [text, setText] = useState("");
  // Catatan yang ter-lampirkan sejak awal (mis. dari tombol "Tanya AI").
  const [mentionIds, setMentionIds] = useState<string[]>(initialMentions);
  const [notes, setNotes] = useState<MentionOption[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  // Popover perintah "/" (kuis, flashcards).
  const [commandQuery, setCommandQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("normal");
  const [speedOpen, setSpeedOpen] = useState(false);
  // ── Beta: rekam suara → transkripsi → masuk textarea ──
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Muat daftar catatan user untuk autocomplete mention. Dimuat juga saat
  // composer dibuka dengan mention awal (agar judul chip langsung tampil).
  useEffect(() => {
    if (
      (mentionOpen || initialMentions.length > 0) &&
      notes.length === 0 &&
      !loadingNotes
    ) {
      setLoadingNotes(true);
      apiFetch(`/api/notes?userId=${encodeURIComponent(userId)}`)
        .then((res) => (res.ok ? res.json() : { notes: [] }))
        .then((data: { notes?: MentionOption[] }) => {
          setNotes(
            (data.notes ?? []).map((n) => ({
              id: n.id,
              title: n.title,
              subject: n.subject ?? null,
            }))
          );
        })
        .catch(() => setNotes([]))
        .finally(() => setLoadingNotes(false));
    }
  }, [mentionOpen, initialMentions.length, notes.length, loadingNotes, userId]);

  const filteredNotes = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    const pool = notes.filter((n) => !mentionIds.includes(n.id));
    if (!q) return pool.slice(0, 6);
    return pool
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.subject ?? "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [notes, mentionQuery, mentionIds]);

  /** Perintah yang cocok dengan teks setelah "/" (mis. "/ku" → /kuis). */
  const filteredCommands = useMemo(() => {
    const q = commandQuery.toLowerCase().trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.id.toLowerCase().includes(q));
  }, [commandQuery]);

  // Tutup popover saat klik di luar.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setMentionOpen(false);
      }
      if (
        commandRef.current &&
        !commandRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setCommandOpen(false);
      }
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Baca pilihan kecepatan dari localStorage (setiap user punya preferensi sendiri).
  useEffect(() => {
    try {
      const v = localStorage.getItem(SPEED_STORAGE_KEY);
      if (v === "fast" || v === "normal" || v === "deep") {
        setSpeedMode(v);
      }
    } catch {
      // localStorage tidak tersedia — biarkan default
    }
  }, []);

  // Ukuran textarea menyesuaikan isi.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // Suggestion chip (initialValue berubah) → isi textarea + fokus.
  useEffect(() => {
    if (initialValue && initialValue !== text) {
      setText(initialValue);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const canSend = text.trim().length > 0 && !sending && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (commandOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filteredCommands[selectedIdx]) {
          e.preventDefault();
          pickCommand(filteredCommands[selectedIdx]);
          return;
        }
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        return;
      }
    }
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filteredNotes.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filteredNotes[selectedIdx]) {
          e.preventDefault();
          pickMention(filteredNotes[selectedIdx]);
          return;
        }
      }
      if (e.key === "Escape") {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (value: string) => {
    setText(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);

    // Deteksi "/" di dekat kursor → popover perintah chat. Hanya bila "/"
    // berada di awal kata (awal input atau setelah spasi) — hindari false
    // positive seperti "5/3" atau "dir/".
    const slashIdx = before.lastIndexOf("/");
    const slashAtWordStart =
      slashIdx !== -1 &&
      slashIdx >= caret - 40 &&
      !/[\s\n]/.test(before.slice(slashIdx + 1)) &&
      (slashIdx === 0 || /\s/.test(before[slashIdx - 1]));
    if (slashAtWordStart) {
      setCommandQuery(before.slice(slashIdx + 1));
      setCommandOpen(true);
      setSelectedIdx(0);
      setMentionOpen(false);
      return;
    }
    setCommandOpen(false);

    // Deteksi "@" di dekat kursor untuk membuka popover mention.
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && atIdx >= caret - 40) {
      const segment = before.slice(atIdx + 1);
      if (!/[\s\n]/.test(segment)) {
        setMentionQuery(segment);
        setMentionOpen(true);
        setSelectedIdx(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  /** Pilih perintah → isi composer dengan "/kuis" / "/card" + fokus. */
  const pickCommand = (cmd: (typeof COMMANDS)[number]) => {
    setText(cmd.id);
    setCommandOpen(false);
    setCommandQuery("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const pickMention = (note: MentionOption) => {
    // Hapus "@kata" dari teks dan ganti dengan chip mention.
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1) {
      const cleaned = text.slice(0, atIdx) + text.slice(caret);
      setText(cleaned);
      requestAnimationFrame(() => {
        if (el) el.focus();
      });
    }
    setMentionIds((ids) => [...ids, note.id]);
    setMentionOpen(false);
    setMentionQuery("");
  };

  const removeMention = (id: string) => {
    setMentionIds((ids) => ids.filter((m) => m !== id));
  };

  /** Pilih file → gambar dikecilkan via canvas, dokumen dibaca langsung. */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset agar file yang sama bisa dipilih lagi
    setAttachError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setAttachError(`File terlalu besar (maks ${formatBytes(MAX_FILE_BYTES)}).`);
      return;
    }
    try {
      let dataUrl = await readFileAsDataUrl(file);
      if (file.type.startsWith("image/")) {
        dataUrl = await downscaleImage(dataUrl, file.type, 1280);
      }
      if (dataUrl.length > MAX_DATA_URL) {
        setAttachError("File terlalu besar setelah diproses. Coba file lain.");
        return;
      }
      setAttachment({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Gagal membaca file.");
    }
  };

  /** Mulai/heutikan rekam suara (beta). Saat berhenti → transkripsi → textarea. */
  const toggleMic = async () => {
    setMicError(null);
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: mime || "audio/webm",
        });
        if (blob.size === 0) return;
        setRecording(false);
        void sendForTranscription(blob);
      };
      // Stop otomatis setelah 60 detik (jaga ukuran audio).
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 60_000);
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
    } catch {
      setMicError(
        "Mikrofon tidak bisa diakses. Pastikan izin mikrofon di browser diaktifkan."
      );
    }
  };

  /** Kirim blob audio ke /api/audio/transcribe → tambahkan teks ke textarea. */
  const sendForTranscription = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("audio", blob, `rekaman-${Date.now()}.webm`);
      const res = await apiFetch("/api/audio/transcribe", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        text?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setMicError(body?.error ?? "Transkripsi gagal. Coba lagi ya 🙏");
        return;
      }
      setText((t) => {
        const sep = t.trim() ? (t.endsWith("\n") ? "" : " ") : "";
        return t + sep + (body.text ?? "");
      });
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) {
      setMicError(
        e instanceof Error ? e.message : "Transkripsi gagal. Coba lagi ya 🙏"
      );
    } finally {
      setTranscribing(false);
    }
  };

  const submit = () => {
    const question = text.trim();
    if (!question || sending || disabled) return;
    onSend({
      question,
      mentions: mentionIds,
      webSearch,
      attachment: attachment ?? null,
      speedMode,
    });
    // Prompt yang sudah terkirim tidak lagi muncul di composer.
    setText("");
    setMentionIds([]);
    setAttachment(null);
    setAttachError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-clay-beige via-clay-beige/95 to-transparent px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4 sm:pt-6">
      <div className="mx-auto max-w-3xl">
        {/* Chip mention + lampiran file */}
        {(mentionIds.length > 0 || attachment || attachError) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {mentionIds.map((id) => {
              const note = notes.find((n) => n.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-clay-full border-2 border-clay-primary/40 bg-clay-primary/10 px-3 py-1 text-[12px] font-extrabold text-clay-primary"
                >
                  <AtSign size={12} className="shrink-0" />
                  <span className="max-w-[160px] truncate">
                    {note?.title ?? "Catatan"}
                  </span>
                  <button
                    onClick={() => removeMention(id)}
                    className="ml-0.5 text-clay-primary/70 hover:text-red-500"
                    aria-label="Hapus mention"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            {attachment && (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-clay-full border-2 border-clay-primary/40 bg-clay-primary/10 px-3 py-1 text-[12px] font-extrabold text-clay-primary">
                <Paperclip size={12} className="shrink-0" />
                <span className="truncate">{attachment.filename}</span>
                <span className="shrink-0 text-[10px] font-bold text-clay-muted">
                  {formatBytes(
                    Math.round((attachment.dataUrl.length * 3) / 4)
                  )}
                </span>
                <button
                  onClick={() => setAttachment(null)}
                  className="ml-0.5 shrink-0 text-clay-primary/70 hover:text-red-500"
                  aria-label="Hapus lampiran"
                >
                  ×
                </button>
              </span>
            )}
            {attachError && (
              <span className="inline-flex items-center gap-1 rounded-clay-full border-2 border-red-300 bg-red-50 px-3 py-1 text-[12px] font-extrabold text-red-600">
                {attachError}
                <button
                  onClick={() => setAttachError(null)}
                  className="ml-0.5 text-red-400 hover:text-red-600"
                  aria-label="Tutup error"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {/* Area input */}
        <div className="relative">
          {/* Catatan: TIDAK pakai overflow-hidden di kotak ini — kalau dipakai,
              popover kecepatan AI & mention akan terpotong. Clipping sudut
              wizard ditangani sendiri oleh panel wizard. */}
          <div className="rounded-clay-md border-2 border-clay-borderLight bg-white shadow-clay transition-all duration-75 focus-within:border-clay-primary">
            {/* Wizard F&Q menyatu DI DALAM kotak composer — memanjang ke atas
                saat muncul, menyusut kembali setelah submit (posisi normal). */}
            <AnimatePresence initial={false}>
              {noteWizardPrompt && (
                <motion.div
                  key="note-wizard"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden rounded-t-clay-md"
                >
                  <NoteCreateWizardPanel
                    prompt={noteWizardPrompt}
                    onClose={() => onNoteWizardClose?.()}
                    onStart={(prefs) => onNoteWizardStart?.(prefs)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className={compact ? "px-3 py-2" : "px-4 py-3"}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                rows={1}
                placeholder="Tanya apa saja… ketik @ untuk melampirkan catatanmu"
                className={`w-full resize-none bg-transparent font-semibold leading-relaxed text-clay-dark outline-none placeholder:text-clay-muted disabled:opacity-60 ${
                  compact ? "max-h-[120px] text-sm" : "max-h-[180px] text-base"
                }`}
                data-testid="asisten-composer"
              />
              <div className={`flex items-center justify-between gap-2 ${compact ? "mt-1" : "mt-1.5"}`}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                {/* ── Beta: rekam suara → teks ── */}
                {isBeta && (
                  <button
                    onClick={toggleMic}
                    className={`flex items-center gap-1 rounded-clay-full font-extrabold transition-all duration-75 hover:-translate-y-0.5 ${
                      recording
                        ? "animate-pulse bg-red-500 text-white"
                        : "bg-clay-primary/10 text-clay-primary"
                    } ${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                    title={
                      recording
                        ? "Rekam — klik untuk berhenti"
                        : transcribing
                          ? "Mentranskripsikan…"
                          : "Rekam suara → otomatis jadi teks"
                    }
                    aria-label="Rekam suara"
                  >
                    {transcribing ? (
                      <Loader2 size={compact ? 12 : 14} className="animate-spin" />
                    ) : (
                      <Mic size={compact ? 13 : 14} />
                    )}
                    {!compact && (
                      <span className="hidden sm:inline">
                        {recording ? "Berhenti" : transcribing ? "Memproses" : "Rekam"}
                      </span>
                    )}
                  </button>
                )}
                {isBeta && micError && (
                  <span className="inline-flex items-center gap-1 rounded-clay-full border-2 border-red-300 bg-red-50 px-2 py-1 text-[11px] font-extrabold text-red-600">
                    {micError}
                    <button
                      onClick={() => setMicError(null)}
                      className="ml-0.5 text-red-400 hover:text-red-600"
                      aria-label="Tutup error mic"
                    >
                      ×
                    </button>
                  </span>
                )}

                {/* ── Beta: panggilan AI (realtime) ── */}
                {isBeta && onCall && (
                  <button
                    onClick={onCall}
                    className={`flex items-center gap-1 rounded-clay-full bg-clay-primary/10 font-extrabold text-clay-primary transition-all duration-75 hover:-translate-y-0.5 ${
                      compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                    }`}
                    title="Panggilan suara AI — tahan untuk bicara"
                  >
                    <PhoneCall size={compact ? 13 : 14} />
                    {!compact && <span className="hidden sm:inline">Call AI</span>}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!mentionOpen) {
                      const el = textareaRef.current;
                      const caret = el?.selectionStart ?? text.length;
                      const before = text.slice(0, caret);
                      if (before.endsWith("@") || /\s$/.test(before) || before === "") {
                        setText((t) => t + "@");
                        setMentionQuery("");
                        setMentionOpen(true);
                        requestAnimationFrame(() => {
                          if (el) {
                            el.focus();
                            const pos = el.value.length;
                            el.setSelectionRange(pos, pos);
                          }
                        });
                      }
                    }
                  }}
                  className={`flex items-center gap-1 rounded-clay-full bg-clay-primary/10 font-extrabold text-clay-primary transition-all duration-75 hover:-translate-y-0.5 ${
                    compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                  }`}
                  title="Lampirkan catatan (@)"
                >
                  <AtSign size={compact ? 12 : 14} />
                  {/* Compact (halaman /home): cukup ikon saja — hindari @ ganda. */}
                  {!compact && (
                    <span className="hidden sm:inline">Catatan</span>
                  )}
                </button>

                {/* Tool: pencarian web */}
                <button
                  onClick={() => setWebSearch((v) => !v)}
                  className={`flex items-center gap-1 rounded-clay-full font-extrabold transition-all duration-75 hover:-translate-y-0.5 ${
                    webSearch
                      ? "bg-clay-primary text-white shadow-[0_3px_0_#8a5a2b]"
                      : "bg-clay-primary/10 text-clay-primary"
                  } ${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                  title={
                    webSearch
                      ? "Pencarian web aktif — klik untuk matikan"
                      : "Cari info tambahan di web sebelum menjawab"
                  }
                  aria-pressed={webSearch}
                  data-testid="asisten-websearch"
                >
                  <Globe size={compact ? 13 : 14} />
                  {!compact && (
                    <span className="hidden sm:inline">
                      {webSearch ? "Web: ON" : "Web"}
                    </span>
                  )}
                </button>

                {/* Tool: upload gambar/dokumen */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1 rounded-clay-full bg-clay-primary/10 font-extrabold text-clay-primary transition-all duration-75 hover:-translate-y-0.5 ${
                    compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                  }`}
                  title="Lampirkan gambar atau dokumen (PDF, Word, PPT, Excel, TXT…)"
                  data-testid="asisten-upload"
                >
                  <Paperclip size={compact ? 13 : 14} />
                  {!compact && <span className="hidden sm:inline">File</span>}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="asisten-file-input"
                />

                {!compact && (
                  <span className="hidden text-[11px] font-bold text-clay-muted sm:inline">
                    Enter kirim · Shift+Enter baris baru · / perintah
                  </span>
                )}
              </div>              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Pilihan kecepatan jawaban AI — di samping kiri tombol kirim */}
                <div className="relative" ref={speedRef}>
                  {(() => {
                    const cur = SPEED_OPTIONS.find((o) => o.value === speedMode) ?? SPEED_OPTIONS[1];
                    return (
                      <button
                        onClick={() => setSpeedOpen((o) => !o)}
                        aria-label={`Kecepatan AI: ${cur.label}`}
                        aria-pressed={speedOpen}
                        title={`Kecepatan AI: ${cur.label} — ${cur.desc}`}
                        className={`flex items-center gap-1 rounded-clay-full font-extrabold transition-all duration-75 hover:-translate-y-0.5 ${cur.active} ${
                          compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
                        }`}
                      >
                        <cur.icon size={compact ? 12 : 13} />
                        <span className="hidden sm:inline">{cur.label}</span>
                        <ChevronDown size={11} />
                      </button>
                    );
                  })()}

                  {/* Popover 3 mode kecepatan — ringkas & mobile-friendly */}
                  <AnimatePresence>
                    {speedOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 z-40 mb-2 w-44 overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-white p-1 shadow-clay-lg"
                      >
                        {SPEED_OPTIONS.map((o) => {
                          const active = speedMode === o.value;
                          return (
                            <button
                              key={o.value}
                              onClick={() => {
                                setSpeedMode(o.value);
                                setSpeedOpen(false);
                                try {
                                  localStorage.setItem(SPEED_STORAGE_KEY, o.value);
                                } catch {
                                  // abaikan
                                }
                              }}
                              className={`flex w-full items-center gap-2 rounded-clay-md px-2.5 py-2 text-left transition-colors ${
                                active ? "bg-clay-primary/10" : "hover:bg-clay-beige"
                              }`}
                            >
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${o.active}`}
                              >
                                <o.icon size={12} />
                              </span>
                              <span
                                className={`flex-1 text-[12.5px] font-extrabold ${
                                  active ? "text-clay-primary" : "text-clay-dark"
                                }`}
                              >
                                {o.label}
                              </span>
                              {active && (
                                <Check size={13} className="shrink-0 text-clay-primary" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {sending ? (
                  <button
                    onClick={onStop}
                    className={`btn-clay-primary ${compact ? "!min-h-[34px] !px-3 !py-1.5 text-xs" : "!min-h-[44px] !px-4 !py-2.5"}`}
                    aria-label="Hentikan"
                    data-testid="asisten-stop"
                  >
                    <Square size={compact ? 13 : 16} className="mr-1 fill-current" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={submit}
                    disabled={!canSend}
                    className={`btn-clay-primary ${
                      compact
                        ? "!min-h-[34px] !min-w-[34px] !px-2.5 !py-1.5"
                        : "!min-h-[44px] !min-w-[44px] !px-4 !py-2.5"
                    }`}
                    aria-label="Kirim"
                    data-testid="asisten-send"
                  >
                    <Send size={compact ? 14 : 16} />
                  </button>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* Popover perintah "/" — kuis, flashcards */}
          <AnimatePresence>
            {commandOpen && (
              <motion.div
                ref={commandRef}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-2 z-30 mb-2 w-full max-w-md overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-white shadow-clay-lg"
              >
                <div className="flex items-center gap-2 border-b-2 border-clay-borderLight px-3.5 py-2.5 text-xs font-extrabold text-clay-muted">
                  <Terminal size={14} className="text-clay-primary" />
                  Perintah chat — pilih lalu tekan Enter
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5">
                  {filteredCommands.length === 0 && (
                    <p className="px-3 py-3 text-xs font-bold text-clay-muted">
                      Tidak ada perintah cocok.
                    </p>
                  )}
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setSelectedIdx(i)}
                      onClick={() => pickCommand(cmd)}
                      className={`flex w-full items-center gap-2.5 rounded-clay-md px-3 py-2.5 text-left transition-colors ${
                        i === selectedIdx ? "bg-clay-primary/10" : ""
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-beige">
                        <cmd.icon size={13} className="text-clay-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-extrabold text-clay-dark">
                          {cmd.id}
                        </span>
                        <span className="block text-[11px] font-bold text-clay-muted">
                          {cmd.desc}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Popover mention */}
          <AnimatePresence>
            {mentionOpen && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-2 z-30 mb-2 w-full max-w-md overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-white shadow-clay-lg"
              >
                <div className="flex items-center gap-2 border-b-2 border-clay-borderLight px-3.5 py-2.5 text-xs font-extrabold text-clay-muted">
                  <BookOpen size={14} className="text-clay-primary" />
                  Lampirkan catatan{mentionQuery ? ` — "…${mentionQuery}"` : ""}
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5">
                  {loadingNotes && (
                    <p className="px-3 py-3 text-xs font-bold text-clay-muted">
                      Memuat catatan…
                    </p>
                  )}
                  {!loadingNotes && filteredNotes.length === 0 && (
                    <p className="px-3 py-3 text-xs font-bold text-clay-muted">
                      Tidak ada catatan cocok.
                    </p>
                  )}
                  {filteredNotes.map((note, i) => (
                    <button
                      key={note.id}
                      onMouseEnter={() => setSelectedIdx(i)}
                      onClick={() => pickMention(note)}
                      className={`flex w-full items-center gap-2.5 rounded-clay-md px-3 py-2.5 text-left transition-colors ${
                        i === selectedIdx ? "bg-clay-primary/10" : ""
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-beige">
                        <AtSign size={13} className="text-clay-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-extrabold text-clay-dark">
                          {note.title}
                        </span>
                        {note.subject && (
                          <span className="block text-[11px] font-bold text-clay-muted">
                            {note.subject}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}