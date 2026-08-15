"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Layers,
  ListChecks,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

/** Preferensi generate yang dikumpulkan wizard lalu diteruskan ke prosesor. */
export interface NoteCreatePrefs {
  generationMode: "cepat" | "lengkap";
  chapterCount: number;
  studyMode: "ringkas" | "standar" | "lengkap";
  /** Jenis rangkuman: rangkuman | makalah | laporan | poin. */
  noteType: "rangkuman" | "makalah" | "laporan" | "poin";
}

interface NoteCreateWizardPanelProps {
  /** Prompt asli user (mis. "buat catatan tentang turunan fungsi"). */
  prompt: string;
  onClose: () => void;
  /** User selesai menjawab pertanyaan → mulai generate dengan prefs ini. */
  onStart: (prefs: NoteCreatePrefs) => void;
}

const STYLE_OPTIONS = [
  {
    value: "cepat",
    icon: Zap,
    title: "Cepat & Ringkas",
    desc: "Intisari padat langsung jadi — cocok untuk gambaran cepat.",
    badge: "Kilat",
    time: "± 1-2 menit",
    color: "text-amber-600 bg-amber-500/10",
  },
  {
    value: "lengkap",
    icon: BookOpen,
    title: "Lengkap & Mendalam",
    desc: "Struktur buku teks: pengantar, bab detail, kuis & kartu hafalan.",
    badge: "Disarankan",
    time: "± 3-6 menit",
    color: "text-clay-primary bg-clay-primary/10",
  },
] as const;

const DETAIL_OPTIONS = [
  {
    value: "ringkas",
    icon: Zap,
    title: "Ringkas",
    desc: "Poin-poin penting saja, tanpa bertele-tele.",
  },
  {
    value: "standar",
    icon: Layers,
    title: "Standar",
    desc: "Seimbang — jelas dan mudah dipahami.",
  },
  {
    value: "lengkap",
    icon: Sparkles,
    title: "Mendalam",
    desc: "Jelas & kompleks — penjelasan lengkap setiap bab.",
  },
] as const;

const CHAPTER_OPTIONS = [
  { n: 1, label: "1 Bab", hint: "Paling singkat" },
  { n: 2, label: "2 Bab", hint: "Ringkas" },
  { n: 3, label: "3 Bab", hint: "Seimbang" },
  { n: 4, label: "4 Bab", hint: "Lengkap" },
  { n: 5, label: "5 Bab", hint: "Detail" },
  { n: 6, label: "6 Bab", hint: "Maksimal" },
];

const TYPE_OPTIONS = [
  {
    value: "rangkuman",
    icon: BookOpen,
    title: "Rangkuman Biasa",
    desc: "Catatan belajar bergaya buku teks — bab & sub-judul jelas.",
  },
  {
    value: "makalah",
    icon: FileText,
    title: "Makalah",
    desc: "Struktur akademik: pendahuluan, pembahasan, kesimpulan, daftar pustaka.",
  },
  {
    value: "laporan",
    icon: ListChecks,
    title: "Laporan",
    desc: "Struktur laporan: tujuan, metode, hasil, kesimpulan.",
  },
  {
    value: "poin",
    icon: Zap,
    title: "Poin Penting",
    desc: "Intisari bullet super ringkas untuk belajar cepat.",
  },
] as const;

const cardSelect =
  "flex w-full items-start gap-3 rounded-clay-md border-3 p-3 text-left transition-all duration-75 min-h-[60px]";

/**
 * Panel wizard gaya F&Q — dirender MENYATU di dalam kotak composer (bukan
 * popup/kartu terpisah): composer memanjang ke atas saat panel muncul dan
 * menyusut kembali setelah submit. Animasi memanjang ditangani Composer.
 * 1) jenis catatan (cepat/lengkap) → 2) jumlah bab (maks 6) → 3) tingkat detail.
 */
export function NoteCreateWizardPanel({
  prompt,
  onClose,
  onStart,
}: NoteCreateWizardPanelProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [generationMode, setGenerationMode] = useState<"cepat" | "lengkap">(
    "lengkap"
  );
  const [chapterCount, setChapterCount] = useState(3);
  const [studyMode, setStudyMode] = useState<"ringkas" | "standar" | "lengkap">(
    "standar"
  );
  const [noteType, setNoteType] = useState<
    "rangkuman" | "makalah" | "laporan" | "poin"
  >("rangkuman");

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="border-b-2 border-clay-borderLight px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-clay-primary">
              <Sparkles size={11} /> Sebelum membuat
            </span>
            <h2 className="mt-1.5 text-[15px] font-extrabold leading-snug text-clay-dark sm:text-base">
              Aku bantu atur catatanmu dulu 😊
            </h2>
            <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-clay-muted">
              Topik: “{prompt.slice(0, 100)}
              {prompt.length > 100 ? "…" : ""}”
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset transition-colors hover:text-clay-dark"
          >
            <X size={16} />
          </button>
        </div>
        {/* Indikator langkah */}
        <div className="mt-3 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors ${
                  step >= n
                    ? "bg-clay-primary text-white"
                    : "bg-clay-beige text-clay-muted"
                }`}
              >
                {step > n ? <Check size={12} /> : n}
              </span>
              {n < 4 && (
                <span
                  className={`h-0.5 flex-1 rounded-full ${
                    step > n ? "bg-clay-primary" : "bg-clay-shadow/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Isi langkah */}
      <div className="px-4 py-4 sm:px-5">
        {/* ── Langkah 1: jenis catatan ── */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h3 className="text-sm font-extrabold text-clay-dark">
              Kamu mau catatan yang seperti apa?
            </h3>
            <p className="mt-0.5 text-xs font-bold text-clay-muted">
              Pilih yang paling pas dengan kebutuhanmu.
            </p>
            <div className="mt-3 space-y-2">
              {STYLE_OPTIONS.map((o) => {
                const active = generationMode === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setGenerationMode(o.value)}
                    aria-pressed={active}
                    className={`${cardSelect} ${
                      active
                        ? "border-clay-primary bg-clay-primary/10 shadow-clay-sm"
                        : "border-clay-shadow/40 bg-white hover:-translate-y-0.5 hover:shadow-clay-sm"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${o.color}`}
                    >
                      <o.icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-clay-dark">
                          {o.title}
                        </span>
                        <span className="rounded-clay-full bg-clay-primary/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-clay-primary">
                          {o.badge}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs font-bold leading-snug text-clay-muted">
                        {o.desc}
                      </span>
                      <span className="mt-1 block text-[10.5px] font-extrabold text-clay-primary">
                        {o.time}
                      </span>
                    </span>
                    <span
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                        active
                          ? "border-clay-primary bg-clay-primary text-white"
                          : "border-clay-shadow/40 text-transparent"
                      }`}
                    >
                      <Check size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Langkah 2: jumlah bab ── */}
        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h3 className="text-sm font-extrabold text-clay-dark">
              Mau dibuat berapa bab? (maks 6)
            </h3>
            <p className="mt-0.5 text-xs font-bold text-clay-muted">
              Semakin banyak bab, semakin rinci pembahasannya.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CHAPTER_OPTIONS.map((c) => {
                const active = chapterCount === c.n;
                return (
                  <button
                    key={c.n}
                    onClick={() => setChapterCount(c.n)}
                    aria-pressed={active}
                    className={`flex min-h-[68px] flex-col items-center justify-center rounded-clay-md border-2 px-1 py-1.5 transition-all duration-75 ${
                      active
                        ? "border-clay-primary bg-clay-primary text-white shadow-clay-btn -translate-y-0.5"
                        : "border-clay-shadow/40 bg-clay-inputBg text-clay-dark shadow-clay-inset hover:border-clay-primary"
                    }`}
                  >
                    <span className="text-2xl font-extrabold">{c.n}</span>
                    <span className="text-[10px] font-extrabold">
                      {c.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        active ? "text-white/80" : "text-clay-muted"
                      }`}
                    >
                      {c.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Langkah 3: jenis rangkuman ── */}
        {step === 3 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h3 className="text-sm font-extrabold text-clay-dark">
              Bentuk catatannya seperti apa?
            </h3>
            <p className="mt-0.5 text-xs font-bold text-clay-muted">
              Rangkuman biasa, makalah, laporan, atau poin penting?
            </p>
            <div className="mt-3 space-y-2">
              {TYPE_OPTIONS.map((o) => {
                const active = noteType === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setNoteType(o.value)}
                    aria-pressed={active}
                    className={`${cardSelect} ${
                      active
                        ? "border-clay-primary bg-clay-primary/10 shadow-clay-sm"
                        : "border-clay-shadow/40 bg-white hover:-translate-y-0.5 hover:shadow-clay-sm"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-clay-primary text-white"
                          : "bg-clay-beige text-clay-muted"
                      }`}
                    >
                      <o.icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-clay-dark">
                        {o.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold leading-snug text-clay-muted">
                        {o.desc}
                      </span>
                    </span>
                    <span
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                        active
                          ? "border-clay-primary bg-clay-primary text-white"
                          : "border-clay-shadow/40 text-transparent"
                      }`}
                    >
                      <Check size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Langkah 4: tingkat detail ── */}
        {step === 4 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h3 className="text-sm font-extrabold text-clay-dark">
              Seberapa detail penjelasannya?
            </h3>
            <p className="mt-0.5 text-xs font-bold text-clay-muted">
              “Ringkas” = singkat; “Mendalam” = jelas tapi kompleks.
            </p>
            <div className="mt-3 space-y-2">
              {DETAIL_OPTIONS.map((o) => {
                const active = studyMode === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setStudyMode(o.value)}
                    aria-pressed={active}
                    className={`${cardSelect} ${
                      active
                        ? "border-clay-primary bg-clay-primary/10 shadow-clay-sm"
                        : "border-clay-shadow/40 bg-white hover:-translate-y-0.5 hover:shadow-clay-sm"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-clay-primary text-white"
                          : "bg-clay-beige text-clay-muted"
                      }`}
                    >
                      <o.icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-clay-dark">
                        {o.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold leading-snug text-clay-muted">
                        {o.desc}
                      </span>
                    </span>
                    <span
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 ${
                        active
                          ? "border-clay-primary bg-clay-primary text-white"
                          : "border-clay-shadow/40 text-transparent"
                      }`}
                    >
                      <Check size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer navigasi */}
      <div className="flex items-center justify-between gap-3 border-t-2 border-clay-borderLight px-4 py-3 sm:px-5">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-md border-2 border-clay-shadow/40 bg-white px-4 py-2 text-sm font-extrabold text-clay-muted transition-colors hover:text-clay-dark"
          >
            <ArrowLeft size={15} /> Kembali
          </button>
        ) : (
          <span />
        )}

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-md bg-clay-primary px-5 py-2 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            Lanjut <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={() => {
              const prefs: NoteCreatePrefs = {
                generationMode,
                chapterCount,
                studyMode,
                noteType,
              };
              onStart(prefs);
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-md bg-clay-primary px-5 py-2 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            <Sparkles size={15} /> Mulai Buat 🚀
          </button>
        )}
      </div>
    </div>
  );
}
