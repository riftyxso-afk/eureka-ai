"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Flag,
  ListChecks,
  Info,
  Map,
  Plus,
  Target,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ScheduleCalendar } from "@/components/dashboard/ScheduleCalendar";
import { ScheduleExportModal } from "@/components/dashboard/ScheduleExportModal";
import { apiFetch } from "@/lib/apiClient";
import { getMissions } from "@/lib/mission-store";
import {
  SCHEDULE_COLORS,
  SCHEDULE_DAYS,
  addScheduleEntry,
  addTask,
  deleteScheduleEntry,
  deleteTask,
  getSchedule,
  scheduleSessionKey,
  sortedTasks,
  toggleScheduleSession,
  toggleTask,
  type ScheduleDay,
  type ScheduleEntry,
  type TaskItem,
} from "@/lib/schedule-store";
import {
  agendaProgress,
  dateFromIso,
  formatDue,
  formatQuestDate,
  isoDate,
  scheduleDayForDate,
  weekDates,
  weeklyQuestProgress,
  withPercent,
} from "@/lib/schedule-quest";
import { accentForSubject, readableTextColor } from "@/lib/palette";
import "./schedule-quest.css";

type Tab = "peta" | "jadwal" | "kalender" | "tugas";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "peta", label: "Peta Misi", icon: Map },
  { id: "jadwal", label: "Jadwal Mingguan", icon: CalendarDays },
  { id: "kalender", label: "Kalender", icon: CalendarRange },
  { id: "tugas", label: "Tantangan", icon: ClipboardCheck },
];

function QuestProgressRing({ value, label }: { value: number; label: string }) {
  const circumference = 2 * Math.PI * 44;
  return (
    <div className="quest-progress-ring" role="img" aria-label={`${label}: ${value} persen`}>
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle className="quest-ring-track" cx="52" cy="52" r="44" />
        <circle
          className="quest-ring-value"
          cx="52"
          cy="52"
          r="44"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <strong>{value}%</strong>
    </div>
  );
}

export default function JadwalPage() {
  const [tab, setTab] = useState<Tab>("peta");
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => isoDate(new Date()));
  const [serverTaskState, setServerTaskState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completedSessions, setCompletedSessions] = useState<string[]>([]);
  const [activeMissions, setActiveMissions] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [toast, setToast] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [serverTasks, setServerTasks] = useState<{ id: string; title: string; dueDate: string; subject?: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [day, setDay] = useState<ScheduleDay>("Senin");
  const [start, setStart] = useState("07:30");
  const [end, setEnd] = useState("09:00");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [entryColor, setEntryColor] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const subjectInput = useRef<HTMLInputElement>(null);
  const taskInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    const storage = getSchedule();
    setEntries(storage.entries);
    setTasks(storage.tasks);
    setCompletedSessions(storage.completedSessions);
    setActiveMissions(getMissions().filter((mission) => mission.status === "active").length);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    let disposed = false;
    const dateTimer = window.setInterval(() => setToday(isoDate(new Date())), 60_000);
    void (async () => {
      try {
        const res = await apiFetch("/api/tasks");
        if (!res.ok) throw new Error("server_tasks_unavailable");
        const data = await res.json().catch(() => null);
        if (disposed) return;
        setServerTaskState("ready");
        const list = Array.isArray(data?.tasks) ? data.tasks : [];
        setServerTasks(list
          .filter((item: { dueDate?: string; status?: string }) => item.dueDate && item.status !== "selesai")
          .map((item: { id: string; title: string; dueDate: string; subject?: string }) => ({
            id: item.id, title: item.title, dueDate: item.dueDate, subject: item.subject,
          })));
      } catch {
        if (!disposed) setServerTaskState("unavailable");
      }
    })();
    return () => {
      disposed = true;
      window.clearInterval(dateTimer);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
  }, []);

  useEffect(() => { if (showForm) subjectInput.current?.focus(); }, [showForm]);
  useEffect(() => { if (showTaskForm) taskInput.current?.focus(); }, [showTaskForm]);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const celebrate = useCallback(() => {
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    setCelebrating(true);
    celebrationTimer.current = setTimeout(() => setCelebrating(false), 4200);
  }, []);

  const daysThisWeek = useMemo(() => weekDates(dateFromIso(today)), [today]);
  const selectedDay = scheduleDayForDate(selectedDate);
  const dayEntries = entries.filter((entry) => entry.day === selectedDay).sort((a, b) => a.start.localeCompare(b.start));
  const dayTasks = sortedTasks(tasks.filter((task) => task.dueDate === selectedDate));
  const dayProgress = agendaProgress(selectedDate, entries, tasks, completedSessions);
  const weekProgress = weeklyQuestProgress(dateFromIso(today), entries, tasks, completedSessions);
  const nextEntry = dayEntries.find((entry) => !completedSessions.includes(scheduleSessionKey(selectedDate, entry.id)));
  const pending = tasks.filter((task) => !task.done).length;
  const taskProgress = withPercent({ total: tasks.length, done: tasks.filter((task) => task.done).length });
  const sorted = sortedTasks(tasks);

  const openEntryForm = (forDay = selectedDay) => {
    setDay(forDay);
    setShowForm(true);
    setTab("jadwal");
  };

  const changeTab = (next: Tab) => {
    setTab(next);
    setConfirmDelete("");
  };

  const toggleSession = (entry: ScheduleEntry) => {
    const wasComplete = dayProgress.total > 0 && dayProgress.done === dayProgress.total;
    const done = toggleScheduleSession(selectedDate, entry.id);
    const nextCompleted = getSchedule().completedSessions;
    setCompletedSessions(nextCompleted);
    notify(done ? `Misi ${entry.subject} selesai` : `Misi ${entry.subject} dibuka kembali`);
    const nextProgress = agendaProgress(selectedDate, entries, tasks, nextCompleted);
    if (!wasComplete && nextProgress.total > 0 && nextProgress.done === nextProgress.total) celebrate();
  };

  const handleTaskToggle = (task: TaskItem) => {
    const wasComplete = dayProgress.total > 0 && dayProgress.done === dayProgress.total;
    toggleTask(task.id);
    const nextTasks = getSchedule().tasks;
    setTasks(nextTasks);
    notify(task.done ? "Tantangan dibuka kembali" : "Tantangan selesai. Kerja bagus!");
    if (!task.done && !wasComplete) {
      const nextProgress = agendaProgress(selectedDate, entries, nextTasks, completedSessions);
      if (nextProgress.total > 0 && nextProgress.done === nextProgress.total) celebrate();
    }
  };

  const submitEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = subject.trim();
    if (!name) return notify("Tulis nama mata pelajaran terlebih dahulu");
    if (end <= start) return notify("Jam selesai harus setelah jam mulai");
    addScheduleEntry({ day, start, end, subject: name, room: room.trim() || undefined, color: entryColor ?? undefined });
    setSubject("");
    setRoom("");
    setEntryColor(null);
    setShowForm(false);
    reload();
    setSelectedDate(daysThisWeek.find((date) => scheduleDayForDate(date) === day) ?? today);
    notify(`Kelas ${name} ditambahkan ke hari ${day}`);
  };

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return notify("Tulis nama tantangan terlebih dahulu");
    addTask({ title, subject: taskSubject.trim() || undefined, dueDate: taskDue || undefined });
    setTaskTitle("");
    setTaskSubject("");
    setTaskDue("");
    setShowTaskForm(false);
    reload();
    notify("Tantangan baru ditambahkan");
  };

  const removeEntry = (entry: ScheduleEntry) => {
    if (confirmDelete !== entry.id) return setConfirmDelete(entry.id);
    deleteScheduleEntry(entry.id);
    setConfirmDelete("");
    reload();
    notify(`Jadwal ${entry.subject} dihapus`);
  };

  const removeTask = (task: TaskItem) => {
    if (confirmDelete !== task.id) return setConfirmDelete(task.id);
    deleteTask(task.id);
    setConfirmDelete("");
    reload();
    notify("Tantangan dihapus");
  };

  if (!ready) return <div className="schedule-quest" role="status"><div className="quest-loading">Menyiapkan peta belajarmu…</div></div>;

  return (
    <div className="schedule-quest eureka-page-jadwal">
      <header className="schedule-heading">
        <div>
          <span className="schedule-kicker"><Flag size={15} aria-hidden="true" /> Peta belajar</span>
          <h1>Jadwal petualanganmu</h1>
          <p>Ubah rutinitas belajar menjadi misi yang bisa kamu taklukkan.</p>
        </div>
        <button type="button" className="quest-button quest-button-secondary" onClick={() => setExportOpen(true)}>
          <Download size={17} aria-hidden="true" /> Ekspor jadwal
        </button>
      </header>

      <ScheduleExportModal open={exportOpen} onClose={() => setExportOpen(false)} entries={entries} tasks={tasks} />

      <nav className="schedule-tabs" aria-label="Tampilan jadwal">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => changeTab(item.id)}
            className="schedule-tab"
          >
            <item.icon size={17} aria-hidden="true" />
            <span>{item.label}</span>
            {item.id === "tugas" && pending > 0 && <span className="schedule-tab-count" aria-label={`${pending} belum selesai`}>{pending}</span>}
          </button>
        ))}
      </nav>

      {tab === "peta" && (
        <div className="schedule-panel">
          <section className="quest-hero" aria-labelledby="quest-hero-title">
            <div className="quest-hero-copy">
              <span className="quest-hero-date">{formatQuestDate(selectedDate)}</span>
              <h2 id="quest-hero-title">Satu hari.<br />Satu petualangan.</h2>
              <p>{dayProgress.total ? `${dayProgress.done} dari ${dayProgress.total} misi sudah kamu taklukkan.` : "Belum ada misi di hari ini. Pilih hari lain atau buat misi pertamamu."}</p>
              {!dayProgress.total && <button type="button" className="quest-button quest-button-light" onClick={() => openEntryForm()}><Plus size={17} aria-hidden="true" /> Buat misi belajar</button>}
            </div>
            <div className="quest-hero-visual">
              <Image src="/landing/ei6Qn.png" alt="" width={132} height={132} priority />
              <QuestProgressRing value={dayProgress.percent} label="Progres misi harian" />
            </div>
          </section>

          <div className="quest-week-strip" aria-label="Pilih hari minggu ini">
            {daysThisWeek.map((date, index) => {
              const progress = agendaProgress(date, entries, tasks, completedSessions);
              const selected = selectedDate === date;
              return (
                <button
                  type="button"
                  key={date}
                  className="quest-day-button"
                  aria-pressed={selected}
                  aria-label={`Pilih agenda ${formatQuestDate(date)}${progress.total ? `, ${progress.done} dari ${progress.total} selesai` : ", belum ada agenda"}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{SCHEDULE_DAYS[index].slice(0, 3)}</span>
                  <strong>{dateFromIso(date).getDate()}</strong>
                  <span className={`quest-day-status${progress.total && progress.done === progress.total ? " is-complete" : ""}`} aria-hidden="true">
                    {progress.total && progress.done === progress.total ? <Check size={11} /> : progress.total || "·"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="quest-map-layout">
            <section className="quest-surface quest-map" aria-labelledby="quest-map-title">
              <div className="quest-section-heading">
                <div>
                  <span className="quest-section-kicker"><Map size={15} aria-hidden="true" /> Jalur misi</span>
                  <h2 id="quest-map-title">{selectedDay}{selectedDate === today ? ", hari ini" : ""}</h2>
                </div>
                {selectedDate !== today && <button type="button" className="quest-text-button" onClick={() => setSelectedDate(today)}>Kembali ke hari ini</button>}
              </div>

              {celebrating && dayProgress.total > 0 && dayProgress.done === dayProgress.total && (
                <div className="quest-celebration" role="status">
                  <div className="quest-confetti" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
                  <Trophy size={28} aria-hidden="true" />
                  <div><strong>Wilayah hari ini ditaklukkan!</strong><span>Semua agenda selesai. Istirahat juga bagian dari petualangan.</span></div>
                </div>
              )}

              {dayEntries.length === 0 && dayTasks.length === 0 ? (
                <div className="quest-empty">
                  <span className="quest-empty-icon"><CalendarPlus size={30} aria-hidden="true" /></span>
                  <h3>Jalur ini masih kosong</h3>
                  <p>Tambahkan kelas atau tantangan dengan tenggat {formatQuestDate(selectedDate)}.</p>
                  <div className="quest-empty-actions">
                    <button type="button" className="quest-button quest-button-primary" onClick={() => openEntryForm()}><Plus size={17} aria-hidden="true" /> Tambah kelas</button>
                    <button type="button" className="quest-button quest-button-secondary" onClick={() => { setTaskDue(selectedDate); setShowTaskForm(true); setTab("tugas"); }}>Buat tantangan</button>
                  </div>
                </div>
              ) : (
                <div className="quest-path">
                  {dayEntries.map((entry, index) => {
                    const done = completedSessions.includes(scheduleSessionKey(selectedDate, entry.id));
                    const isNext = nextEntry?.id === entry.id;
                    return (
                      <label
                        key={entry.id}
                        className={`quest-stop${done ? " is-done" : ""}${isNext ? " is-next" : ""}`}
                        style={{ "--stop-color": entry.color } as CSSProperties}
                      >
                        <input
                          className="quest-check-input"
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleSession(entry)}
                          aria-label={`Tandai kelas ${entry.subject} ${done ? "belum selesai" : "selesai"}`}
                        />
                        <span className="quest-stop-node" aria-hidden="true">{done ? <Check size={21} /> : <BookOpen size={20} />}</span>
                        <span className="quest-stop-copy">
                          <span className="quest-stop-meta">{isNext ? "Misi berikutnya" : `Misi ${index + 1}`} · {entry.start}–{entry.end}</span>
                          <strong>{entry.subject}</strong>
                          <span>{entry.room || "Ruang belajarmu"}{isNext && !done ? " · Siap dimulai" : ""}</span>
                        </span>
                        <span className="quest-stop-action">{done ? <><CheckCircle2 size={16} aria-hidden="true" /> Selesai</> : <>Tandai selesai <ChevronRight size={16} aria-hidden="true" /></>}</span>
                      </label>
                    );
                  })}
                  {dayTasks.map((task) => (
                    <label key={task.id} className={`quest-stop quest-stop-task${task.done ? " is-done" : ""}`}>
                      <input className="quest-check-input" type="checkbox" checked={task.done} onChange={() => handleTaskToggle(task)} aria-label={`Tandai tantangan ${task.title} ${task.done ? "belum selesai" : "selesai"}`} />
                      <span className="quest-stop-node" aria-hidden="true">{task.done ? <Check size={21} /> : <ListChecks size={20} />}</span>
                      <span className="quest-stop-copy">
                        <span className="quest-stop-meta">Tantangan{task.subject ? ` · ${task.subject}` : ""}</span>
                        <strong>{task.title}</strong>
                        <span>Tenggat {formatDue(task.dueDate)}</span>
                      </span>
                      <span className="quest-stop-action">{task.done ? <><CheckCircle2 size={16} aria-hidden="true" /> Selesai</> : <>Taklukkan <ChevronRight size={16} aria-hidden="true" /></>}</span>
                    </label>
                  ))}
                  <div className={`quest-finish${dayProgress.total > 0 && dayProgress.done === dayProgress.total ? " is-reached" : ""}`}>
                    <Flag size={22} aria-hidden="true" />
                    <div><strong>Garis akhir</strong><span>{dayProgress.done === dayProgress.total ? "Semua misi selesai" : `${dayProgress.total - dayProgress.done} misi lagi menuju garis akhir`}</span></div>
                  </div>
                </div>
              )}
            </section>

            <aside className="quest-sidebar" aria-label="Ringkasan petualangan">
              <section className="quest-surface quest-guide">
                <span className="quest-section-kicker"><Target size={15} aria-hidden="true" /> Panduan Momo</span>
                <Image src="/landing/ei6Qn.png" alt="" width={82} height={82} />
                <h2>{dayProgress.total > 0 && dayProgress.done === dayProgress.total ? "Kerja bagus, penjelajah!" : nextEntry ? `Berikutnya: ${nextEntry.subject}` : dayTasks.some((task) => !task.done) ? "Ada tantangan menunggu" : "Rencanakan langkah kecil"}</h2>
                <p>{dayProgress.total > 0 && dayProgress.done === dayProgress.total ? "Semua target hari ini tuntas. Simpan tenaga untuk petualangan berikutnya." : nextEntry ? `${nextEntry.start}–${nextEntry.end}. Fokus pada satu kelas dulu, lalu tandai saat selesai.` : "Jadwal yang realistis lebih mudah ditaklukkan daripada target yang terlalu padat."}</p>
              </section>

              <section className="quest-surface quest-week-progress">
                <div className="quest-section-heading"><h2>Progres minggu ini</h2><strong>{weekProgress.percent}%</strong></div>
                <progress max={100} value={weekProgress.percent} aria-label="Progres agenda minggu ini" />
                <p>{weekProgress.done} dari {weekProgress.total} agenda selesai. Tugas dengan tenggat minggu ini ikut dihitung.</p>
              </section>

              <Link href="/dashboard/misi" className="quest-mission-link">
                <span className="quest-mission-icon"><Trophy size={21} aria-hidden="true" /></span>
                <span><strong>Misi belajar jangka panjang</strong><small>{activeMissions ? `${activeMissions} misi aktif menantimu` : "Buat target besar dan bagi menjadi checkpoint"}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </div>
      )}

      {tab === "jadwal" && (
        <section className="schedule-panel quest-surface quest-manage" aria-labelledby="schedule-manage-title">
          <div className="quest-section-heading">
            <div><span className="quest-section-kicker"><CalendarDays size={15} aria-hidden="true" /> Markas jadwal</span><h2 id="schedule-manage-title">Susun wilayah mingguanmu</h2><p>Kelas berulang setiap minggu. Kehadiran ditandai terpisah di Peta Misi.</p></div>
            <button type="button" className="quest-button quest-button-primary" onClick={() => setShowForm((value) => !value)} aria-expanded={showForm}><Plus size={17} aria-hidden="true" /> Tambah kelas</button>
          </div>

          {showForm && (
            <form className="quest-form" onSubmit={submitEntry}>
              <div className="quest-form-heading"><h3>Misi kelas baru</h3><button type="button" className="quest-text-button" onClick={() => setShowForm(false)}>Tutup form</button></div>
              <div className="quest-form-grid">
                <label htmlFor="schedule-subject">Mata pelajaran<input ref={subjectInput} id="schedule-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Contoh: Matematika" maxLength={80} /></label>
                <label htmlFor="schedule-day">Hari<select id="schedule-day" value={day} onChange={(event) => setDay(event.target.value as ScheduleDay)}>{SCHEDULE_DAYS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label htmlFor="schedule-start">Jam mulai<input id="schedule-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
                <label htmlFor="schedule-end">Jam selesai<input id="schedule-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
                <label htmlFor="schedule-room">Ruang <span>(opsional)</span><input id="schedule-room" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Contoh: Lab 2" maxLength={80} /></label>
                <fieldset className="quest-color-field"><legend>Warna penanda</legend><div>{SCHEDULE_COLORS.map((color, index) => <button key={color} type="button" className="quest-color-button" style={{ background: color }} aria-label={`Pilih warna ${index + 1}`} aria-pressed={entryColor === color} onClick={() => setEntryColor(entryColor === color ? null : color)}>{entryColor === color && <Check size={16} color={readableTextColor(color)} aria-hidden="true" />}</button>)}</div></fieldset>
              </div>
              <div className="quest-form-actions"><button type="button" className="quest-button quest-button-secondary" onClick={() => setShowForm(false)}>Batal</button><button type="submit" className="quest-button quest-button-primary">Simpan kelas <ArrowRight size={17} aria-hidden="true" /></button></div>
            </form>
          )}

          {entries.length === 0 && !showForm ? (
            <div className="quest-empty"><span className="quest-empty-icon"><CalendarDays size={30} aria-hidden="true" /></span><h3>Markasmu belum memiliki jadwal</h3><p>Tambahkan kelas pertamamu. Kelas itu akan muncul sebagai misi pada hari yang sama setiap minggu.</p><button type="button" className="quest-button quest-button-primary" onClick={() => openEntryForm("Senin")}><Plus size={17} aria-hidden="true" /> Tambah kelas pertama</button></div>
          ) : (
            <div className="quest-week-list">
              {SCHEDULE_DAYS.map((dayName) => {
                const items = entries.filter((entry) => entry.day === dayName).sort((a, b) => a.start.localeCompare(b.start));
                if (!items.length) return null;
                return (
                  <section className="quest-day-group" key={dayName} aria-labelledby={`day-${dayName}`}>
                    <div className="quest-day-group-heading"><h3 id={`day-${dayName}`}>{dayName}</h3><span>{items.length} kelas</span></div>
                    <div className="quest-class-list">
                      {items.map((entry) => (
                        <article className="quest-class-row" key={entry.id} style={{ "--stop-color": entry.color } as CSSProperties}>
                          <span className="quest-class-time"><Clock3 size={15} aria-hidden="true" />{entry.start}<span>–</span>{entry.end}</span>
                          <div className="quest-class-copy"><strong>{entry.subject}</strong><span>{entry.room || "Ruang belum diatur"}</span></div>
                          <div className="quest-row-actions">
                            {confirmDelete === entry.id && <button type="button" className="quest-text-button" onClick={() => setConfirmDelete("")}>Batal</button>}
                            <button type="button" className={`quest-icon-button${confirmDelete === entry.id ? " is-confirming" : ""}`} aria-label={`${confirmDelete === entry.id ? "Konfirmasi hapus" : "Hapus"} kelas ${entry.subject}`} onClick={() => removeEntry(entry)}><Trash2 size={16} aria-hidden="true" />{confirmDelete === entry.id && <span>Hapus</span>}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "kalender" && (
        <section className="schedule-panel quest-surface quest-calendar-panel" aria-label="Kalender belajar">
          {serverTaskState !== "ready" && <p className="quest-service-note" role="status">{serverTaskState === "loading" ? "Memuat tenggat dari Tugas & Ujian…" : "Tenggat dari Tugas & Ujian belum dapat dimuat. Jadwal dan tantangan lokal tetap tersedia. Muat ulang halaman untuk mencoba lagi."}</p>}
          <ScheduleCalendar entries={entries} tasks={tasks} serverTasks={serverTasks} accentOf={(name) => accentForSubject(name).light} />
        </section>
      )}

      {tab === "tugas" && (
        <section className="schedule-panel quest-surface quest-manage" aria-labelledby="task-board-title">
          <div className="quest-section-heading">
            <div><span className="quest-section-kicker"><ClipboardCheck size={15} aria-hidden="true" /> Papan tantangan</span><h2 id="task-board-title">Taklukkan tugas satu per satu</h2><p>{taskProgress.total ? `${taskProgress.done} dari ${taskProgress.total} tantangan selesai.` : "Tugas dengan tenggat akan muncul di Peta Misi dan Kalender."}</p></div>
            <button type="button" className="quest-button quest-button-primary" onClick={() => setShowTaskForm((value) => !value)} aria-expanded={showTaskForm}><Plus size={17} aria-hidden="true" /> Buat tantangan</button>
          </div>

          {taskProgress.total > 0 && <div className="quest-task-progress"><progress max={100} value={taskProgress.percent} aria-label="Progres semua tantangan" /><strong>{taskProgress.percent}%</strong></div>}

          {showTaskForm && (
            <form className="quest-form" onSubmit={submitTask}>
              <div className="quest-form-heading"><h3>Tantangan baru</h3><button type="button" className="quest-text-button" onClick={() => setShowTaskForm(false)}>Tutup form</button></div>
              <div className="quest-form-grid quest-task-form-grid">
                <label htmlFor="task-title">Nama tugas<input ref={taskInput} id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Contoh: Latihan bab 3" maxLength={120} /></label>
                <label htmlFor="task-subject">Mata pelajaran <span>(opsional)</span><input id="task-subject" value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)} placeholder="Contoh: Biologi" maxLength={80} /></label>
                <label htmlFor="task-due">Tenggat <span>(opsional)</span><input id="task-due" type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label>
              </div>
              <div className="quest-form-actions"><button type="button" className="quest-button quest-button-secondary" onClick={() => setShowTaskForm(false)}>Batal</button><button type="submit" className="quest-button quest-button-primary">Simpan tantangan <ArrowRight size={17} aria-hidden="true" /></button></div>
            </form>
          )}

          {sorted.length === 0 && !showTaskForm ? (
            <div className="quest-empty"><span className="quest-empty-icon"><ClipboardCheck size={30} aria-hidden="true" /></span><h3>Belum ada tantangan</h3><p>Buat tugas pertamamu. Centang saat selesai dan lihat progresmu bertumbuh.</p><button type="button" className="quest-button quest-button-primary" onClick={() => setShowTaskForm(true)}><Plus size={17} aria-hidden="true" /> Buat tantangan pertama</button></div>
          ) : (
            <div className="quest-task-list">
              {sorted.map((task) => (
                <article className={`quest-task-row${task.done ? " is-done" : ""}`} key={task.id}>
                  <label className="quest-task-check">
                    <input type="checkbox" checked={task.done} onChange={() => handleTaskToggle(task)} aria-label={`Tandai ${task.title} ${task.done ? "belum selesai" : "selesai"}`} />
                    <span aria-hidden="true">{task.done && <Check size={17} />}</span>
                  </label>
                  <div className="quest-task-copy"><strong>{task.title}</strong><span>{task.subject || "Umum"} · {formatDue(task.dueDate)}</span></div>
                  <span className={`quest-task-status${task.done ? " is-done" : ""}`}>{task.done ? <><CheckCircle2 size={15} aria-hidden="true" /> Ditaklukkan</> : "Menunggu"}</span>
                  <div className="quest-row-actions">
                    {confirmDelete === task.id && <button type="button" className="quest-text-button" onClick={() => setConfirmDelete("")}>Batal</button>}
                    <button type="button" className={`quest-icon-button${confirmDelete === task.id ? " is-confirming" : ""}`} aria-label={`${confirmDelete === task.id ? "Konfirmasi hapus" : "Hapus"} tantangan ${task.title}`} onClick={() => removeTask(task)}><Trash2 size={16} aria-hidden="true" />{confirmDelete === task.id && <span>Hapus</span>}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {toast && <div className="schedule-toast" role="status"><Info size={18} aria-hidden="true" />{toast}</div>}
    </div>
  );
}
