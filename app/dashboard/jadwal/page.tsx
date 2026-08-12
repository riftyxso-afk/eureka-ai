"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import {
  SCHEDULE_DAYS,
  addScheduleEntry,
  addTask,
  deleteScheduleEntry,
  deleteTask,
  getSchedule,
  sortedTasks,
  toggleTask,
  type ScheduleEntry,
  type ScheduleDay,
  type TaskItem,
} from "@/lib/schedule-store";

type Tab = "jadwal" | "tugas";

function formatDue(dueDate?: string): string {
  if (!dueDate) return "Tanpa tenggat";
  const d = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(d.getTime())) return dueDate;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function JadwalPage() {
  const [tab, setTab] = useState<Tab>("jadwal");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Form jadwal
  const [showForm, setShowForm] = useState(false);
  const [day, setDay] = useState<ScheduleDay>("Senin");
  const [start, setStart] = useState("07:30");
  const [end, setEnd] = useState("09:00");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");

  // Form tugas
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const reload = () => {
    const storage = getSchedule();
    setEntries(storage.entries);
    setTasks(storage.tasks);
  };

  useEffect(() => {
    reload();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const submitEntry = () => {
    const name = subject.trim();
    if (!name) {
      notify("Nama mata pelajaran tidak boleh kosong ⚠️");
      return;
    }
    addScheduleEntry({
      day,
      start: start || "07:30",
      end: end || "09:00",
      subject: name,
      room: room.trim() || undefined,
    });
    setSubject("");
    setRoom("");
    setShowForm(false);
    reload();
    notify("Jadwal ditambahkan ✅");
  };

  const submitTask = () => {
    const title = taskTitle.trim();
    if (!title) {
      notify("Nama tugas tidak boleh kosong ⚠️");
      return;
    }
    addTask({
      title,
      subject: taskSubject.trim() || undefined,
      dueDate: taskDue || undefined,
    });
    setTaskTitle("");
    setTaskSubject("");
    setTaskDue("");
    setShowTaskForm(false);
    reload();
    notify("Tugas ditambahkan ✅");
  };

  const pending = tasks.filter((t) => !t.done).length;

  const groupByDay = (e: ScheduleEntry[]) =>
    SCHEDULE_DAYS.map((d) => ({
      day: d,
      items: e
        .filter((x) => x.day === d)
        .sort((a, b) => a.start.localeCompare(b.start)),
    }));

  const sorted = sortedTasks(tasks);

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Jadwal</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Atur jadwal mata pelajaran &amp; pantau tugas-tugasmu
      </p>

      {/* Tab */}
      <div className="mt-5 flex gap-2">
        {(
          [
            { id: "jadwal", label: "📅 Jadwal Mapel" },
            { id: "tugas", label: `📋 Tugas${pending > 0 ? ` (${pending})` : ""}` },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] shrink-0 rounded-clay-full border-3 px-4 text-xs font-extrabold transition-all duration-75 active:translate-y-0.5 sm:min-h-[40px] sm:px-4 sm:text-sm ${
              tab === t.id
                ? "border-clay-primary bg-clay-primary text-white shadow-clay-sm"
                : "border-clay-shadow/50 bg-white text-clay-dark shadow-clay-sm hover:-translate-y-0.5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "jadwal" ? (
          <motion.div
            key="jadwal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="mt-5"
          >
            <div className="flex justify-end">
              <ButtonClay
                onClick={() => setShowForm((v) => !v)}
                className="min-h-[44px] px-4 py-2 text-sm"
              >
                <Plus size={16} className="mr-2" />
                Tambah Jadwal
              </ButtonClay>
            </div>

            {showForm && (
              <CardClay className="mt-4 !p-4 sm:!p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      HARI
                    </label>
                    <div className="relative">
                      <select
                        value={day}
                        onChange={(e) => setDay(e.target.value as ScheduleDay)}
                        className="w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-4 py-3 pr-10 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                      >
                        {SCHEDULE_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-clay-muted"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      MATA PELAJARAN
                    </label>
                    <InputClay
                      placeholder="contoh: Matematika"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                        MULAI
                      </label>
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                        SELESAI
                      </label>
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      RUANG (opsional)
                    </label>
                    <InputClay
                      placeholder="contoh: A-101"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <ButtonClay
                    variant="secondary"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    Batal
                  </ButtonClay>
                  <ButtonClay onClick={submitEntry} className="flex-1">
                    Simpan Jadwal
                  </ButtonClay>
                </div>
              </CardClay>
            )}

            {entries.length === 0 && !showForm ? (
              <div className="card-clay mt-4 flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                  <CalendarDays size={30} className="text-clay-muted" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">Belum ada jadwal</h3>
                <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
                  Tambahkan jadwal mata pelajaranmu agar jadwal belajar terpantau.
                </p>
                <ButtonClay
                  onClick={() => setShowForm(true)}
                  className="mt-5 min-h-[44px] px-5 py-2 text-sm"
                >
                  <Plus size={16} className="mr-2" /> Tambah Jadwal Pertama
                </ButtonClay>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupByDay(entries).map(
                  (g) =>
                    g.items.length > 0 && (
                      <CardClay key={g.day} className="!p-4">
                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-clay-primary">
                          {g.day}
                        </h3>
                        <div className="mt-2 space-y-2">
                          {g.items.map((e) => (
                            <div
                              key={e.id}
                              className="rounded-clay-md border-2 border-clay-shadow/30 bg-clay-beige/60 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-extrabold text-clay-dark">
                                    {e.subject}
                                  </p>
                                  <p className="mt-0.5 text-xs font-bold text-clay-muted">
                                    {e.start} – {e.end}
                                    {e.room ? ` · ${e.room}` : ""}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    deleteScheduleEntry(e.id);
                                    reload();
                                    notify("Jadwal dihapus");
                                  }}
                                  aria-label="Hapus jadwal"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-red-100 hover:text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-clay-inputBg shadow-clay-inset">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: "100%", background: e.color }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardClay>
                    )
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="tugas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="mt-5"
          >
            <div className="flex justify-end">
              <ButtonClay
                onClick={() => setShowTaskForm((v) => !v)}
                className="min-h-[44px] px-4 py-2 text-sm"
              >
                <Plus size={16} className="mr-2" />
                Tambah Tugas
              </ButtonClay>
            </div>

            {showTaskForm && (
              <CardClay className="mt-4 !p-4 sm:!p-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      NAMA TUGAS
                    </label>
                    <InputClay
                      placeholder="contoh: PR Trigonometri"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      MAPEL (opsional)
                    </label>
                    <InputClay
                      placeholder="contoh: Matematika"
                      value={taskSubject}
                      onChange={(e) => setTaskSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-clay-dark">
                      TENGGAT (opsional)
                    </label>
                    <input
                      type="date"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                      className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <ButtonClay
                    variant="secondary"
                    onClick={() => setShowTaskForm(false)}
                    className="flex-1"
                  >
                    Batal
                  </ButtonClay>
                  <ButtonClay onClick={submitTask} className="flex-1">
                    Simpan Tugas
                  </ButtonClay>
                </div>
              </CardClay>
            )}

            {sorted.length === 0 ? (
              <div className="card-clay mt-4 flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
                  <ClipboardList size={30} className="text-clay-muted" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">Belum ada tugas</h3>
                <p className="mt-1.5 max-w-sm text-sm font-semibold text-clay-muted">
                  Catat tugas dari guru/dosen agar tidak ada yang terlewat.
                </p>
                <ButtonClay
                  onClick={() => setShowTaskForm(true)}
                  className="mt-5 min-h-[44px] px-5 py-2 text-sm"
                >
                  <Plus size={16} className="mr-2" /> Tambah Tugas Pertama
                </ButtonClay>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {sorted.map((t) => {
                  const overdue =
                    !t.done && t.dueDate && new Date(`${t.dueDate}T23:59:59`) < new Date();
                  return (
                    <div
                      key={t.id}
                      className={`card-clay flex items-center gap-3 !p-4 transition-all ${
                        t.done ? "opacity-60" : ""
                      }`}
                    >
                      <button
                        onClick={() => {
                          toggleTask(t.id);
                          reload();
                        }}
                        aria-label={t.done ? "Tandai belum selesai" : "Tandai selesai"}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-3 transition-all duration-75 active:scale-90 ${
                          t.done
                            ? "border-clay-success bg-clay-success text-white"
                            : "border-clay-shadow/50 bg-white text-transparent hover:border-clay-primary"
                        }`}
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-extrabold text-clay-dark ${
                            t.done ? "line-through" : ""
                          }`}
                        >
                          {t.title}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-clay-muted">
                          {t.subject ? `${t.subject} · ` : ""}
                          {formatDue(t.dueDate)}
                          {overdue && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-600">
                              Terlambat!
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          deleteTask(t.id);
                          reload();
                          notify("Tugas dihapus");
                        }}
                        aria-label="Hapus tugas"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-red-100 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
