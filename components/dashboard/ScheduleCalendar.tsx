"use client";

/**
 * Kalender bulanan aesthetic (jadwal-kalender) — tab di halaman Jadwal.
 *
 * Menggabungkan dua sumber data:
 * - Jadwal mapel MINGGUAN (ScheduleEntry, localStorage): blok warna di
 *   kolom hari yang cocok (Senin–Minggu), tampil TIAP bulan pada hari
 *   kerja yang sama.
 * - Tugas/ujian BER-TANGGAL (TaskItem + TaskEntry dari server): chip di
 *   sel tanggal tenggatnya.
 *
 * Interaksi: klik sel tanggal → panel detail agenda hari itu (bawah) —
 * daftar kelas hari tersebut + tugas yang jatuh di tanggal itu.
 */
import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  ListChecks,
} from "lucide-react";

import {
  SCHEDULE_DAYS,
  type ScheduleDay,
  type ScheduleEntry,
  type TaskItem,
} from "@/lib/schedule-store";
import { readableTextColor } from "@/lib/palette";

const DAY_IDX: Record<ScheduleDay, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 0,
};

/** Senin = awal minggu (umum di Indonesia). */
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

interface DayCell {
  date: number;
  iso: string; // YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
  /** Jadwal mingguan yang jatuh di hari seminggu ini (bukan tanggal spesifik). */
  classes: ScheduleEntry[];
  /** Tugas ber-tanggal ini (tugas halaman jadwal + tugas server). */
  tasks: { id: string; title: string; done?: boolean; color?: string; from: "local" | "server" }[];
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function ScheduleCalendar({
  entries,
  tasks,
  serverTasks,
  accentOf,
}: {
  entries: ScheduleEntry[];
  /** Tugas lama dari halaman jadwal (localStorage). */
  tasks: TaskItem[];
  /** Tugas dari fitur Tugas & Ujian (server, punya tenggat). */
  serverTasks: { id: string; title: string; dueDate: string; subject?: string }[];
  /** Warna mapel → blok kelas. */
  accentOf: (subject: string) => string;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(isoOf(today.getFullYear(), today.getMonth(), today.getDate()));

  const weeks = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    // Offset Senin-awal: JS Minggu=0 → Senin=1 … Sabtu=6.
    const offset = (first.getDay() + 6) % 7;
    const cells: (DayCell | null)[][] = [];
    let row: (DayCell | null)[] = [];
    for (let i = 0; i < offset; i++) row.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.y, cursor.m, d);
      const dayName = WEEKDAYS[(date.getDay() + 6) % 7];
      const iso = isoOf(cursor.y, cursor.m, d);
      const classes = entries.filter((e) => e.day === dayName);
      const localTasks = tasks
        .filter((t) => t.dueDate === iso)
        .map((t) => ({ id: t.id, title: t.title, done: t.done, color: accentOf(t.subject ?? "Umum"), from: "local" as const }));
      const srvTasks = serverTasks
        .filter((t) => t.dueDate === iso)
        .map((t) => ({ id: t.id, title: t.title, color: accentOf(t.subject ?? "Umum"), from: "server" as const }));
      row.push({
        date: d,
        iso,
        inMonth: true,
        isToday:
          d === today.getDate() &&
          cursor.m === today.getMonth() &&
          cursor.y === today.getFullYear(),
        classes,
        tasks: [...localTasks, ...srvTasks],
      });
      if (row.length === 7) {
        cells.push(row);
        row = [];
      }
    }
    if (row.length > 0) cells.push([...row, ...Array(7 - row.length).fill(null)]);
    return cells;
  }, [cursor, entries, tasks, serverTasks, accentOf, today]);

  const shift = (delta: number) => {
    setCursor((c) => {
      const nm = c.m + delta;
      if (nm < 0) return { y: c.y - 1, m: 11 };
      if (nm > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m: nm };
    });
  };

  // Agenda hari terpilih.
  const selectedIso =
    selected ?? isoOf(today.getFullYear(), today.getMonth(), today.getDate());
  const selDate = new Date(`${selectedIso}T00:00:00`);
  const selDayName = WEEKDAYS[(selDate.getDay() + 6) % 7] as ScheduleDay;
  const selClasses = entries.filter((e) => e.day === selDayName);
  const selLocal = tasks.filter((t) => t.dueDate === selectedIso);
  const selServer = serverTasks.filter((t) => t.dueDate === selectedIso);

  return (
    <div>
      {/* Header bulan */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-clay-dark">
            {MONTHS_ID[cursor.m]} <span className="text-clay-muted">{cursor.y}</span>
          </h2>
          <p className="text-xs font-bold text-clay-muted">
            Kelas mingguan + tenggat tugas dalam satu tampilan
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shift(-1)}
            aria-label="Bulan sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-cream text-clay-muted shadow-clay-sm transition-colors hover:text-clay-dark"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            className="min-h-[36px] rounded-clay-full bg-clay-cream px-3 text-xs font-extrabold text-clay-primary shadow-clay-sm transition-colors hover:text-clay-dark"
          >
            Hari ini
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="Bulan berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-cream text-clay-muted shadow-clay-sm transition-colors hover:text-clay-dark"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grid kalender */}
      <div className="mt-4 overflow-hidden rounded-clay-md border-2 border-clay-borderLight/70 bg-clay-cream shadow-clay-sm">
        <div className="grid grid-cols-7 border-b-2 border-clay-borderLight/60 bg-clay-beige/60">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-clay-muted">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell, i) => {
            if (!cell) {
              return <div key={`pad-${i}`} className="min-h-[64px] border-b border-r border-clay-borderLight/40 bg-clay-beige/30 sm:min-h-[84px]" />;
            }
            const isSel = selectedIso === cell.iso;
            return (
              <button
                key={cell.iso}
                onClick={() => setSelected(cell.iso)}
                aria-pressed={isSel}
                className={`relative min-h-[64px] border-b border-r border-clay-borderLight/40 p-1 text-left align-top transition-colors sm:min-h-[84px] sm:p-1.5 ${
                  cell.isToday ? "bg-clay-primary/10" : "hover:bg-clay-beige/50"
                } ${isSel ? "ring-2 ring-inset ring-clay-primary" : ""}`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-extrabold ${
                    cell.isToday ? "bg-clay-primary text-white" : "text-clay-dark"
                  }`}
                >
                  {cell.date}
                </span>
                {/* Blok kelas mingguan — maks 2 + counter */}
                <div className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                  {cell.classes.slice(0, 2).map((c) => (
                    <span
                      key={c.id}
                      className="truncate rounded px-1 py-px text-[9px] font-extrabold leading-tight"
                      style={{ backgroundColor: c.color, color: readableTextColor(c.color) }}
                      title={`${c.subject} ${c.start}–${c.end}`}
                    >
                      {c.start} {c.subject}
                    </span>
                  ))}
                  {cell.classes.length > 2 && (
                    <span className="px-1 text-[9px] font-extrabold text-clay-muted">
                      +{cell.classes.length - 2} lain
                    </span>
                  )}
                </div>
                {/* Dot tugas */}
                {(cell.classes.length > 0 || cell.tasks.length > 0) && (
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 sm:hidden">
                    {cell.classes.slice(0, 3).map((c) => (
                      <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                    ))}
                    {cell.tasks.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-clay-secondary" />
                    )}
                  </span>
                )}
                {cell.tasks.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-secondary px-1 text-[9px] font-extrabold text-white sm:hidden">
                    {cell.tasks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda hari terpilih */}
      <div className="mt-4 rounded-clay-md border-2 border-clay-borderLight/70 bg-clay-cream p-4 shadow-clay-sm">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
          <CircleDot size={14} className="text-clay-primary" />
          Agenda{" "}
          {selDate.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h3>

        {/* Kelas hari itu */}
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
            <BookOpen size={11} /> Kelas
          </p>
          {selClasses.length === 0 ? (
            <p className="mt-1 text-xs font-bold text-clay-muted/80">Tidak ada kelas terjadwal.</p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {selClasses
                .slice()
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-lg bg-clay-beige/60 px-3 py-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold" style={{ backgroundColor: c.color, color: readableTextColor(c.color) }}>
                      {c.start}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold text-clay-dark">{c.subject}</span>
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-clay-muted">
                        <Clock size={9} /> {c.start}–{c.end}
                        {c.room ? ` · ${c.room}` : ""}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Tugas hari itu */}
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
            <ListChecks size={11} /> Tugas tenggat
          </p>
          {selLocal.length === 0 && selServer.length === 0 ? (
            <p className="mt-1 text-xs font-bold text-clay-muted/80">Tidak ada tugas dengan tenggat hari ini.</p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {selLocal.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-clay-beige/60 px-3 py-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.done ? "bg-clay-success" : "bg-clay-secondary"}`} />
                  <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${t.done ? "text-clay-muted line-through" : "text-clay-dark"}`}>
                    {t.title}
                  </span>
                  {t.done && <span className="text-[10px] font-extrabold text-clay-success">selesai</span>}
                </div>
              ))}
              {selServer.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-clay-primary/5 px-3 py-2">
                  <AlarmDot />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-clay-dark">{t.title}</span>
                  <span className="text-[10px] font-extrabold text-clay-primary">Tugas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlarmDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      <span className="absolute h-full w-full animate-ping rounded-full bg-clay-primary/50" />
      <span className="relative h-2 w-2 rounded-full bg-clay-primary" />
    </span>
  );
}
