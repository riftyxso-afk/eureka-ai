"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";

import {
  SCHEDULE_DAYS,
  type ScheduleEntry,
  type TaskItem,
} from "@/lib/schedule-store";
import "./schedule-calendar.css";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface CalendarTask {
  id: string;
  title: string;
  subject?: string;
  done?: boolean;
  color: string;
  from: "local" | "server";
}

interface DayCell {
  date: number;
  iso: string;
  classes: ScheduleEntry[];
  tasks: CalendarTask[];
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function subjectStyle(color: string): CSSProperties {
  return { "--quest-calendar-subject": color } as CSSProperties;
}

export function ScheduleCalendar({
  entries,
  tasks,
  serverTasks,
  accentOf,
}: {
  entries: ScheduleEntry[];
  tasks: TaskItem[];
  serverTasks: { id: string; title: string; dueDate: string; subject?: string }[];
  accentOf: (subject: string) => string;
}) {
  const id = useId();
  const today = new Date();
  const todayIso = isoOf(today.getFullYear(), today.getMonth(), today.getDate());
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [year, month, day] = selectedIso.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const monthIndex = month - 1;
  const monthLabel = `${MONTHS_ID[monthIndex]} ${year}`;
  const selectedLabel = selectedDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const result: (DayCell | null)[] = Array.from({ length: offset }, () => null);

    for (let date = 1; date <= daysInMonth; date++) {
      const current = new Date(year, monthIndex, date);
      const dayName = SCHEDULE_DAYS[(current.getDay() + 6) % 7];
      const iso = isoOf(year, monthIndex, date);
      const local: CalendarTask[] = tasks
        .filter((task) => task.dueDate === iso)
        .map((task) => ({
          ...task,
          color: accentOf(task.subject ?? "Umum"),
          from: "local",
        }));
      const server: CalendarTask[] = serverTasks
        .filter((task) => task.dueDate === iso)
        .map((task) => ({
          ...task,
          color: accentOf(task.subject ?? "Umum"),
          from: "server",
        }));

      result.push({
        date,
        iso,
        classes: entries
          .filter((entry) => entry.day === dayName)
          .sort((a, b) => a.start.localeCompare(b.start)),
        tasks: [...local, ...server],
      });
    }

    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, monthIndex, entries, tasks, serverTasks, accentOf]);

  const selectedCell = cells.find((cell) => cell?.iso === selectedIso);
  const selectedClasses = selectedCell?.classes ?? [];
  const selectedTasks = selectedCell?.tasks ?? [];

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    setSelectedIso(isoOf(next.getFullYear(), next.getMonth(), Math.min(day, lastDay)));
  }

  return (
    <section className="quest-calendar" aria-label="Kalender jadwal">
      <header className="quest-calendar-header">
        <div className="quest-calendar-heading">
          <h2 id={`${id}-month`} aria-live="polite" aria-atomic="true">
            {MONTHS_ID[monthIndex]} <span>{year}</span>
          </h2>
          <p>Pilih tanggal untuk melihat kelas dan tenggatmu.</p>
        </div>
        <div className="quest-calendar-navigation" aria-label="Navigasi bulan">
          <button
            type="button"
            className="quest-calendar-nav-button"
            onClick={() => shiftMonth(-1)}
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="quest-calendar-today-button"
            onClick={() => setSelectedIso(todayIso)}
          >
            Hari ini
          </button>
          <button
            type="button"
            className="quest-calendar-nav-button"
            onClick={() => shiftMonth(1)}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="quest-calendar-month" role="group" aria-labelledby={`${id}-month`}>
        <div className="quest-calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="quest-calendar-grid">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`pad-${index}`} className="quest-calendar-padding" aria-hidden="true" />;
            }
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedIso;
            const dateLabel = `${SCHEDULE_DAYS[index % 7]}, ${cell.date} ${monthLabel}`;
            return (
              <button
                key={cell.iso}
                type="button"
                className={`quest-calendar-day${isToday ? " quest-calendar-day-today" : ""}${isSelected ? " quest-calendar-day-selected" : ""}`}
                onClick={() => setSelectedIso(cell.iso)}
                aria-label={`${dateLabel}${isToday ? ", hari ini" : ""}. ${cell.classes.length} kelas, ${cell.tasks.length} tugas.`}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-controls={`${id}-agenda`}
              >
                <span className="quest-calendar-date" aria-hidden="true">{cell.date}</span>
                <span className="quest-calendar-activity" aria-hidden="true">
                  {cell.classes.length > 0 && (
                    <span className="quest-calendar-indicator-row">
                      <span className="quest-calendar-class-dot" />
                      <span className="quest-calendar-cell-label">{cell.classes.length} kelas</span>
                    </span>
                  )}
                  {cell.tasks.length > 0 && (
                    <span className="quest-calendar-indicator-row">
                      <span className="quest-calendar-task-dot" />
                      <span className="quest-calendar-cell-label">{cell.tasks.length} tugas</span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="quest-calendar-legend">
        <span><span className="quest-calendar-class-dot" aria-hidden="true" /> Kelas mingguan</span>
        <span><span className="quest-calendar-task-dot" aria-hidden="true" /> Tenggat tugas</span>
        <span className="quest-calendar-legend-today">Angka berbingkai: hari ini</span>
      </div>

      <section id={`${id}-agenda`} className="quest-calendar-agenda" aria-labelledby={`${id}-date`}>
        <header className="quest-calendar-agenda-header">
          <div>
            <p>Agenda pilihanmu</p>
            <h3 id={`${id}-date`} aria-live="polite" aria-atomic="true">{selectedLabel}</h3>
          </div>
          {selectedIso === todayIso && <span className="quest-calendar-today-label">Hari ini</span>}
        </header>

        <div className="quest-calendar-agenda-columns">
          <section className="quest-calendar-agenda-section" aria-labelledby={`${id}-classes`}>
            <h4 id={`${id}-classes`}>
              <BookOpen size={16} aria-hidden="true" />
              Kelas <span>{selectedClasses.length}</span>
            </h4>
            {selectedClasses.length === 0 ? (
              <p className="quest-calendar-empty">Tidak ada kelas terjadwal. Ada ruang untuk belajar mandiri.</p>
            ) : (
              <ul className="quest-calendar-list">
                {selectedClasses.map((entry) => (
                  <li key={entry.id} className="quest-calendar-class-item">
                    <span className="quest-calendar-time">{entry.start}<span>s.d. {entry.end}</span></span>
                    <div className="quest-calendar-item-content">
                      <p className="quest-calendar-item-title">
                        <span className="quest-calendar-subject-dot" style={subjectStyle(entry.color)} aria-hidden="true" />
                        {entry.subject}
                      </p>
                      <p className="quest-calendar-item-meta">{entry.room || "Ruang belum diatur"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="quest-calendar-agenda-section" aria-labelledby={`${id}-tasks`}>
            <h4 id={`${id}-tasks`}>
              <ListChecks size={16} aria-hidden="true" />
              Tenggat tugas <span>{selectedTasks.length}</span>
            </h4>
            {selectedTasks.length === 0 ? (
              <p className="quest-calendar-empty">Tidak ada tenggat pada tanggal ini. Lanjutkan misi belajarmu!</p>
            ) : (
              <ul className="quest-calendar-list">
                {selectedTasks.map((task) => (
                  <li key={`${task.from}-${task.id}`} className={`quest-calendar-task-item${task.done ? " quest-calendar-task-done" : ""}`}>
                    <span className="quest-calendar-task-status" aria-hidden="true">
                      {task.done ? <Check size={16} /> : <span className="quest-calendar-task-dot" />}
                    </span>
                    <div className="quest-calendar-item-content">
                      <p className="quest-calendar-item-title">{task.title}</p>
                      <p className="quest-calendar-item-meta">
                        {task.subject && <span className="quest-calendar-subject-dot" style={subjectStyle(task.color)} aria-hidden="true" />}
                        {task.subject ? `${task.subject} · ` : ""}
                        {task.from === "local" ? "Jadwal lokal" : "Tugas & Ujian"}
                      </p>
                      <span className="quest-calendar-task-state">
                        {task.done ? "Selesai" : task.from === "server" ? "Tenggat tugas & ujian" : "Belum selesai"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </section>
  );
}
