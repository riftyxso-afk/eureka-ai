"use client";

/**
 * Modal Ekspor Jadwal (schedule-export) — ekspor jadwal belajar sebagai:
 * - PDF aesthetic (server-side, lib/scheduleExport) → unduh / bagikan
 * - PNG: kartu ringkas dirender di modal, lalu toPng (html-to-image)
 *   → unduh / bagikan langsung (navigator.share di HP).
 *
 * Kartu PNG diringkas dari jadwal mingguan (blok per hari) + tugas terdekat.
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Share2,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/apiClient";
import type { ScheduleEntry, TaskItem } from "@/lib/schedule-store";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
const DAY_ABBR: Record<string, string> = {
  Senin: "Sen", Selasa: "Sel", Rabu: "Rab", Kamis: "Kam",
  Jumat: "Jum", Sabtu: "Sab", Minggu: "Min",
};

interface ScheduleExportCardProps {
  entries: ScheduleEntry[];
  tasks: TaskItem[];
}

/** Kartu PNG — ringkasan jadwal mingguan + tugas terdekat, siap tangkap. */
export function ScheduleExportCard({ entries, tasks }: ScheduleExportCardProps) {
  // 3 tugas terdekat yang belum selesai.
  const upcoming = [...tasks]
    .filter((t) => !t.done && t.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 3);

  return (
    <div
      className="w-[420px] max-w-full overflow-hidden rounded-clay-md bg-clay-beige"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header kartu */}
      <div className="bg-clay-primary px-5 py-4">
        <p className="text-[18px] font-extrabold leading-tight text-white">
          Jadwal Belajarku
        </p>
        <p className="mt-0.5 text-[10.5px] font-bold text-white/80">
          Dibuat dengan Eureka.AI ·{" "}
          {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Grid mini mingguan — hanya hari yang punya kelas, maks 4 */}
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {DAYS.filter((d) => entries.some((e) => e.day === d))
          .slice(0, 4)
          .map((day) => (
            <div key={day} className="rounded-lg bg-white p-1.5 shadow-sm">
              <p className="text-center text-[8px] font-extrabold uppercase tracking-wide text-clay-muted">
                {DAY_ABBR[day]}
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {entries
                  .filter((e) => e.day === day)
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .slice(0, 3)
                  .map((e) => (
                    <span
                      key={e.id}
                      className="truncate rounded px-1 py-px text-[7.5px] font-extrabold leading-tight text-white"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.start} {e.subject}
                    </span>
                  ))}
                {entries.filter((e) => e.day === day).length > 3 && (
                  <span className="text-center text-[7px] font-extrabold text-clay-muted">
                    +{entries.filter((e) => e.day === day).length - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        {entries.length === 0 && (
          <p className="col-span-4 py-3 text-center text-[10px] font-bold text-clay-muted">
            Belum ada jadwal mingguan.
          </p>
        )}
      </div>

      {/* Tugas terdekat */}
      <div className="px-3 pb-3">
        <div className="rounded-lg bg-white p-2.5 shadow-sm">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-clay-muted">
            Tugas terdekat
          </p>
          {upcoming.length === 0 ? (
            <p className="mt-1 text-[9.5px] font-bold text-clay-muted/80">
              Tidak ada tugas aktif — aman!
            </p>
          ) : (
            <div className="mt-1 flex flex-col gap-1">
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clay-secondary" />
                  <span className="min-w-0 flex-1 truncate text-[9.5px] font-bold text-clay-dark">
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[8.5px] font-extrabold text-clay-primary">
                    {t.dueDate?.slice(5).replace("-", "/")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer kartu */}
      <div className="bg-clay-cream px-4 py-2 text-center text-[8px] font-extrabold text-clay-muted">
        EUREKA.AI — AI TUTOR UNTUK PELAJAR INDONESIA
      </div>
    </div>
  );
}

export function ScheduleExportModal({
  open,
  onClose,
  entries,
  tasks,
}: {
  open: boolean;
  onClose: () => void;
  entries: ScheduleEntry[];
  tasks: TaskItem[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"pdf" | "png" | "share" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const payload = () => ({
    entries: entries.map((e) => ({
      day: e.day,
      start: e.start,
      end: e.end,
      subject: e.subject,
      room: e.room,
      color: e.color,
    })),
    tasks: tasks.map((t) => ({
      title: t.title,
      subject: t.subject,
      dueDate: t.dueDate,
      done: t.done,
    })),
  });

  /** Unduh PDF jadwal (server render). */
  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const res = await apiFetch("/api/schedule/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Gagal membuat PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jadwal-belajar-eureka.pdf";
      a.click();
      URL.revokeObjectURL(url);
      notify("PDF terunduh ✓");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setBusy(null);
    }
  };

  /** Tangkap kartu PNG lalu unduh atau bagikan. */
  const capturePng = async (): Promise<Blob> => {
    if (!cardRef.current) throw new Error("Kartu belum siap.");
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#FAF6EF" });
    const blob = await (await fetch(dataUrl)).blob();
    return blob;
  };

  const downloadPng = async () => {
    setBusy("png");
    try {
      const blob = await capturePng();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jadwal-belajar-eureka.png";
      a.click();
      URL.revokeObjectURL(url);
      notify("Gambar terunduh ✓");
    } catch {
      notify("Gagal membuat gambar.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const blob = await capturePng();
      const file = new File([blob], "jadwal-belajar-eureka.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Jadwal Belajarku",
          text: "Jadwal belajarku dari Eureka.AI ✨",
        });
        notify("Berhasil dibagikan ✓");
      } else {
        // Fallback: unduh bila share tidak didukung.
        await downloadPng();
        notify("Share tidak didukung — gambar diunduh");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify("Gagal membagikan.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-clay-dark/40 p-3 sm:items-center"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Ekspor Jadwal"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-clay-md border-2 border-clay-borderLight bg-clay-cream p-4 shadow-clay-lg sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-clay-dark">Ekspor Jadwal</h2>
                <p className="mt-0.5 text-xs font-semibold text-clay-muted">
                  Unduh atau bagikan jadwalmu — PDF penuh atau kartu PNG ringkas
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

            {/* Preview kartu */}
            <div className="mt-4 flex justify-center overflow-x-auto rounded-lg bg-clay-beige/60 p-3">
              <div ref={cardRef}>
                <ScheduleExportCard entries={entries} tasks={tasks} />
              </div>
            </div>

            {/* Tombol aksi */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => void downloadPdf()}
                disabled={busy !== null}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-clay-md bg-clay-primary px-3 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 disabled:opacity-50"
              >
                {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                PDF
              </button>
              <button
                onClick={() => void downloadPng()}
                disabled={busy !== null}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-clay-md border-2 border-clay-borderLight bg-white px-3 text-sm font-extrabold text-clay-dark shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 disabled:opacity-50"
              >
                {busy === "png" ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                Gambar
              </button>
              <button
                onClick={() => void share()}
                disabled={busy !== null}
                className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-clay-md border-2 border-clay-borderLight bg-clay-beige px-3 text-sm font-extrabold text-clay-dark shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 disabled:opacity-50"
              >
                {busy === "share" ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                Bagikan langsung (WA, IG, dll)
              </button>
            </div>

            <p className="mt-3 text-center text-[10.5px] font-semibold text-clay-muted">
              <Download size={10} className="mr-1 inline" />
              PDF berisi jadwal mingguan penuh + semua tugas · PNG ringkas untuk media sosial
            </p>

            {toast && (
              <div className="mt-3 rounded-clay-full bg-clay-primary px-4 py-2 text-center text-xs font-extrabold text-white">
                {toast}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
