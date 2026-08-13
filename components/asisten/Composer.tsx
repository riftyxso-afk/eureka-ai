"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, BookOpen, Globe, Paperclip, Send, Square } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { ChatAttachment } from "@/lib/assistant/types";

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
}

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
  onSend,
  onStop,
}: ComposerProps) {
  const [text, setText] = useState("");
  // Catatan yang ter-lampirkan sejak awal (mis. dari tombol "Tanya AI").
  const [mentionIds, setMentionIds] = useState<string[]>(initialMentions);
  const [notes, setNotes] = useState<MentionOption[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
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
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    // Deteksi "@" di dekat kursor untuk membuka popover mention.
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
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

  const submit = () => {
    const question = text.trim();
    if (!question || sending || disabled) return;
    onSend({
      question,
      mentions: mentionIds,
      webSearch,
      attachment: attachment ?? null,
    });
    // Prompt yang sudah terkirim tidak lagi muncul di composer.
    setText("");
    setMentionIds([]);
    setAttachment(null);
    setAttachError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-clay-beige via-clay-beige/95 to-transparent px-4 pb-4 pt-6 sm:px-6">
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
                  <AtSign size={12} />
                  {note?.title ?? "Catatan"}
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
          <div
            className={`rounded-clay-md border-2 border-clay-borderLight bg-white shadow-clay transition-all duration-75 focus-within:border-clay-primary ${
              compact ? "px-3 py-2" : "px-4 py-3"
            }`}
          >
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
                  <AtSign size={compact ? 12 : 14} /> {compact ? "@" : "Catatan"}
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
                  {!compact && (webSearch ? "Web: ON" : "Web")}
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
                  {!compact && "File"}
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
                    Enter kirim · Shift+Enter baris baru
                  </span>
                )}
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