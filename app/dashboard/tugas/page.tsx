"use client";

/**
 * Tugas & Ujian (task-reminders) — halaman pengelola tugas dengan tenggat,
 * pengingat otomatis (cron 1×/jam), dan tab ujian.
 *
 * Fitur:
 * - Tambah tugas: judul, mapel, tenggat (tanggal+jam), prioritas, jarak pengingat.
 * - Klik status chip → siklus belum → progres → selesai.
 * - Kartu prioritas tinggi diberi aksen; overdue diberi label merah.
 * - Ringkasan: total tugas aktif, selesai minggu ini, terlambat.
 * - Tab Ujian: kelola jadwal ujian (fitur lama) + pengingat H-1 otomatis.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Clock,
  Flame,
  Loader2,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { REMIND_CHOICES, type TaskEntry, type TaskPriority } from "@/lib/tasks-store";

interface Exam {
  id: string;
  subject: string;
  title: string;
  date: string;
  status: "upcoming" | "completed";
  score: number | null;
}

const PRIORITY_META = {
  tinggi: { label: "Tinggi", chip: "bg-red-500/15 text-red-600" },
  sedang: { label: "Sedang", chip: "bg-amber-500/15 text-amber-600" },
  rendah: { label: "Rendah", chip: "bg-emerald-500/15 text-emerald-600" },
} as const;

const STATUS_LABEL = { belum: "Belum", progres: "Progres", selesai: "Selesai" } as const;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string): number {
  const due = new Date(`${iso}T23:59:59+07:00`).getTime();
  return Math.ceil((due - Date.now()) / 86_400_000);
}

export default function TugasPage() {
  const [tab, setTab] = useState<"tugas" | "ujian">("tugas");
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tugas baru.
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueHour, setDueHour] = useState("23");
  const [priority, setPriority] = useState<TaskPriority>("sedang");
  const [remind, setRemind] = useState<number>(24);

  // Form ujian.
  const [showExamForm, setShowExamForm] = useState(false);
  const [examForm, setExamForm] = useState({ subject: "", title: "", date: "" });

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        apiFetch("/api/tasks"),
        apiFetch(`/api/exams?userId=${encodeURIComponent(getUserId())}`),
      ]);
      if (tRes.ok) {
        const data = await tRes.json().catch(() => null);
        if (Array.isArray(data?.tasks)) setTasks(data.tasks);
      }
      if (eRes.ok) {
        const data = await eRes.json().catch(() => null);
        if (Array.isArray(data?.exams)) setExams(data.exams);
      }
    } catch {
      // biarkan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const timer = setInterval(() => void loadAll(), 30_000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const submitTask = async () => {
    if (!title.trim() || !dueDate) {
      notify("Isi judul tugas dan tenggatnya!");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          title: title.trim(),
          subject: subject.trim(),
          dueDate,
          dueHour: Number(dueHour) || 0,
          priority,
          remindHoursBefore: remind,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Gagal menambah tugas.");
      setTitle(""); setSubject(""); setDueDate(""); setPriority("sedang"); setRemind(24);
      setShowForm(false);
      notify("Tugas ditambahkan — pengingat otomatis aktif ⏰");
      void loadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal menambah tugas.");
    } finally {
      setBusy(false);
    }
  };

  const cycleStatus = async (task: TaskEntry) => {
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", taskId: task.id }),
      });
      if (res.ok) void loadAll();
    } catch {
      notify("Gagal memperbarui status.");
    }
  };

  const deleteTask = async (task: TaskEntry) => {
    if (!window.confirm(`Hapus tugas "${task.title}"?`)) return;
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", taskId: task.id }),
      });
      if (res.ok) {
        notify("Tugas dihapus.");
        void loadAll();
      }
    } catch {
      notify("Gagal menghapus.");
    }
  };

  const submitExam = async () => {
    if (!examForm.title.trim() || !examForm.date) {
      notify("Isi nama ujian dan tanggalnya!");
      return;
    }
    try {
      const res = await apiFetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          userId: getUserId(),
          subject: examForm.subject,
          title: examForm.title,
          date: examForm.date,
        }),
      });
      if (!res.ok) throw new Error("Gagal menambah ujian.");
      setExamForm({ subject: "", title: "", date: "" });
      setShowExamForm(false);
      notify("Ujian ditambahkan — pengingat H-1 aktif 📚");
      void loadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal menambah ujian.");
    }
  };

  const deleteExam = async (exam: Exam) => {
    if (!window.confirm(`Hapus ujian "${exam.title}"?`)) return;
    try {
      await apiFetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId: getUserId(), examId: exam.id }),
      });
      notify("Ujian dihapus.");
      void loadAll();
    } catch {
      notify("Gagal menghapus.");
    }
  };

  // Ringkasan.
  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "selesai");
    const overdue = active.filter((t) => daysUntil(t.dueDate) < 0);
    const doneWeek = tasks.filter(
      (t) =>
        t.status === "selesai" &&
        Date.now() - new Date(t.createdAt).getTime() < 7 * 86_400_000
    ).length;
    return { active: active.length, overdue: overdue.length, doneWeek };
  }, [tasks]);

  const upcomingExams = exams.filter((e) => e.status === "upcoming");
  const completedExams = exams.filter((e) => e.status === "completed");

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Tugas &amp; Ujian</h1>
          <p className="mt-2 text-base font-semibold text-clay-muted">
            Kelola tugas dengan pengingat otomatis — tidak ada lagi yang kelewat
          </p>
        </div>
        {tab === "tugas" ? (
          <ButtonClay onClick={() => setShowForm((v) => !v)} className="!min-h-[44px] !px-4 text-sm">
            <Plus size={16} className="mr-2" /> Tugas Baru
          </ButtonClay>
        ) : (
          <ButtonClay onClick={() => setShowExamForm((v) => !v)} className="!min-h-[44px] !px-4 text-sm">
            <Plus size={16} className="mr-2" /> Ujian Baru
          </ButtonClay>
        )}
      </div>

      {/* Ringkasan */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-clay-md bg-clay-cream px-4 py-3 text-center shadow-clay-sm">
          <p className="text-2xl font-extrabold text-clay-primary">{stats.active}</p>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">Aktif</p>
        </div>
        <div className="rounded-clay-md bg-clay-cream px-4 py-3 text-center shadow-clay-sm">
          <p className={`text-2xl font-extrabold ${stats.overdue > 0 ? "text-red-500" : "text-clay-dark"}`}>
            {stats.overdue}
          </p>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">Terlambat</p>
        </div>
        <div className="rounded-clay-md bg-clay-cream px-4 py-3 text-center shadow-clay-sm">
          <p className="text-2xl font-extrabold text-clay-success">{stats.doneWeek}</p>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">Selesai/7hari</p>
        </div>
      </div>

      {/* Tab */}
      <div className="mt-5 flex gap-2">
        {(["tugas", "ujian"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-full px-4 text-sm font-extrabold capitalize transition-all ${
              tab === t
                ? "bg-clay-primary text-white shadow-clay-sm"
                : "bg-clay-cream text-clay-muted shadow-clay-sm hover:text-clay-dark"
            }`}
          >
            {t === "tugas" ? <Timer size={14} /> : <ClipboardCheck size={14} />} {t === "tugas" ? "Tugas" : "Ujian"}
          </button>
        ))}
      </div>

      {/* ── TAB TUGAS ── */}
      {tab === "tugas" && (
        <>
          {/* Form tambah */}
          {showForm && (
            <div className="card-clay mt-5 space-y-4 !p-5">
              <h2 className="text-base font-extrabold">Tugas Baru</h2>
              <InputClay
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul tugas (contoh: PR Trigonometri hal. 88)"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputClay
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Mata pelajaran (contoh: Matematika)"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-4 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
                  />
                  <select
                    value={dueHour}
                    onChange={(e) => setDueHour(e.target.value)}
                    className="shrink-0 rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-2 py-3 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
                    title="Jam tenggat"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-clay-muted">Prioritas</p>
                  <div className="flex gap-2">
                    {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        aria-pressed={priority === p}
                        className={`min-h-[36px] flex-1 rounded-clay-full px-3 text-xs font-extrabold transition-all ${
                          priority === p
                            ? `${PRIORITY_META[p].chip} ring-2 ring-clay-primary/40`
                            : "bg-clay-cream text-clay-muted shadow-clay-sm"
                        }`}
                      >
                        {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-clay-muted">
                    <AlarmClock size={12} /> Ingatkan sebelum
                  </p>
                  <div className="flex gap-2">
                    {REMIND_CHOICES.map((h) => (
                      <button
                        key={h}
                        onClick={() => setRemind(h)}
                        aria-pressed={remind === h}
                        className={`min-h-[36px] flex-1 rounded-clay-full px-2 text-xs font-extrabold transition-all ${
                          remind === h
                            ? "bg-clay-primary/15 text-clay-primary ring-2 ring-clay-primary/40"
                            : "bg-clay-cream text-clay-muted shadow-clay-sm"
                        }`}
                      >
                        {h >= 24 ? `H-${h / 24}` : `${h}j`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                  <AlarmClock size={13} className="text-clay-primary" />
                  Pengingat otomatis via lonceng &amp; notifikasi browser
                </p>
                <ButtonClay onClick={() => void submitTask()} disabled={busy} className="!min-h-[44px] !px-5 text-sm">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : "Simpan Tugas"}
                </ButtonClay>
              </div>
            </div>
          )}

          {/* Daftar tugas */}
          <div className="mt-5 flex flex-col gap-3">
            {loading ? (
              <div className="flex justify-center py-10 text-clay-muted">
                <Loader2 className="animate-spin" size={26} />
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-clay-md border-2 border-dashed border-clay-shadow/30 py-14 text-center">
                <Timer size={36} className="mx-auto text-clay-shadow/50" />
                <p className="mt-3 text-base font-extrabold text-clay-dark">Belum ada tugas</p>
                <p className="mt-1 text-sm font-semibold text-clay-muted">
                  Tambah tugas pertamamu — pengingat otomatis siap menjaga tenggatmu.
                </p>
              </div>
            ) : (
              [...tasks]
                .sort((a, b) => {
                  // Aktif dulu, lalu paling dekat tenggat; selesai di bawah.
                  if (a.status === "selesai" !== (b.status === "selesai"))
                    return a.status === "selesai" ? 1 : -1;
                  return a.dueDate.localeCompare(b.dueDate);
                })
                .map((task) => {
                  const days = daysUntil(task.dueDate);
                  const overdue = task.status !== "selesai" && days < 0;
                  const dueLabel = task.dueHour != null ? `${String(task.dueHour).padStart(2, "0")}:00` : "23:59";
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 rounded-clay-md border-2 bg-clay-cream p-4 shadow-clay-sm transition-all ${
                        overdue
                          ? "border-red-300"
                          : task.priority === "tinggi" && task.status !== "selesai"
                            ? "border-amber-300"
                            : "border-clay-borderLight/70"
                      }`}
                    >
                      {/* Toggle status */}
                      <button
                        onClick={() => void cycleStatus(task)}
                        title={`Status: ${STATUS_LABEL[task.status]} — klik untuk ubah`}
                        aria-label={`Ubah status tugas ${task.title}`}
                        className="shrink-0 transition-transform active:scale-90"
                      >
                        {task.status === "selesai" ? (
                          <CheckCircle2 size={26} className="text-clay-success" />
                        ) : task.status === "progres" ? (
                          <span className="relative flex h-[26px] w-[26px] items-center justify-center">
                            <Circle size={26} className="absolute text-clay-primary/40" strokeWidth={2.5} />
                            <Loader2 size={14} className="animate-spin text-clay-primary" />
                          </span>
                        ) : (
                          <Circle size={26} className="text-clay-shadow/40" strokeWidth={2.5} />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[14.5px] font-extrabold ${
                            task.status === "selesai" ? "text-clay-muted line-through" : "text-clay-dark"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-clay-full bg-clay-beige px-2 py-0.5 text-[10.5px] font-extrabold text-clay-muted">
                            {task.subject}
                          </span>
                          <span className={`rounded-clay-full px-2 py-0.5 text-[10.5px] font-extrabold ${PRIORITY_META[task.priority].chip}`}>
                            {PRIORITY_META[task.priority].label}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-clay-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                              overdue ? "bg-red-500/15 text-red-600" : "bg-clay-primary/10 text-clay-primary"
                            }`}
                          >
                            {overdue ? <TriangleAlert size={10} /> : <Clock size={10} />}
                            {overdue
                              ? `Terlambat ${Math.abs(days)} hari`
                              : days === 0
                                ? "Hari ini!"
                                : `${fmtDate(task.dueDate)} · ${dueLabel}`}
                          </span>
                          {task.status !== "selesai" && !overdue && (
                            <span className="hidden items-center gap-1 rounded-clay-full bg-clay-beige px-2 py-0.5 text-[10.5px] font-bold text-clay-muted sm:flex">
                              <AlarmClock size={10} />
                              {task.remindHoursBefore >= 24 ? `H-${task.remindHoursBefore / 24}` : `${task.remindHoursBefore}j`} sebelum
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => void deleteTask(task)}
                        aria-label={`Hapus ${task.title}`}
                        className="shrink-0 rounded-full p-2 text-clay-muted transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}

      {/* ── TAB UJIAN ── */}
      {tab === "ujian" && (
        <>
          {showExamForm && (
            <div className="card-clay mt-5 space-y-4 !p-5">
              <h2 className="text-base font-extrabold">Ujian Baru</h2>
              <InputClay
                value={examForm.title}
                onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                placeholder="Nama ujian (contoh: UTS Matematika)"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputClay
                  value={examForm.subject}
                  onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                  placeholder="Mata pelajaran"
                />
                <input
                  type="date"
                  value={examForm.date}
                  onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                  className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <ButtonClay onClick={() => void submitExam()} className="!min-h-[44px] !px-5 text-sm">
                  Simpan Ujian
                </ButtonClay>
              </div>
            </div>
          )}

          {[
            { label: "Akan Datang", list: upcomingExams },
            { label: "Selesai", list: completedExams },
          ].map(({ label, list }) => (
            <div key={label} className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-clay-muted">
                {label === "Akan Datang" ? <Flame size={14} className="text-clay-secondary" /> : <CheckCircle2 size={14} className="text-clay-success" />}
                {label} ({list.length})
              </h2>
              {list.length === 0 ? (
                <p className="mt-2 rounded-clay-md border-2 border-dashed border-clay-shadow/30 px-4 py-6 text-center text-sm font-bold text-clay-muted">
                  Belum ada.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {list.map((exam) => {
                    const days = daysUntil(exam.date);
                    return (
                      <div
                        key={exam.id}
                        className={`flex items-center gap-3 rounded-clay-md border-2 bg-clay-cream p-4 shadow-clay-sm ${
                          label === "Akan Datang" && days <= 1 ? "border-amber-300" : "border-clay-borderLight/70"
                        }`}
                      >
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                          <span className="text-[15px] font-extrabold leading-none">{new Date(exam.date).getDate()}</span>
                          <span className="text-[9px] font-extrabold uppercase">
                            {new Date(exam.date).toLocaleDateString("id-ID", { month: "short" })}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-extrabold text-clay-dark">{exam.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-clay-full bg-clay-beige px-2 py-0.5 text-[10.5px] font-extrabold text-clay-muted">
                              {exam.subject}
                            </span>
                            {label === "Akan Datang" && (
                              <span className="flex items-center gap-1 rounded-clay-full bg-clay-primary/10 px-2 py-0.5 text-[10.5px] font-extrabold text-clay-primary">
                                <CalendarDays size={10} />
                                {days === 0 ? "Hari ini!" : days === 1 ? "Besok — pengingat aktif" : `${days} hari lagi`}
                              </span>
                            )}
                          </div>
                        </div>
                        {exam.status === "completed" && exam.score != null ? (
                          <span className="text-2xl font-extrabold text-clay-primary">{exam.score}</span>
                        ) : null}
                        <button
                          onClick={() => void deleteExam(exam)}
                          aria-label={`Hapus ${exam.title}`}
                          className="shrink-0 rounded-full p-2 text-clay-muted transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Info pengingat */}
      <div className="mt-6 flex items-start gap-2 rounded-clay-md bg-clay-primary/5 px-4 py-3 text-xs font-semibold text-clay-muted">
        <AlarmClock size={14} className="mt-0.5 shrink-0 text-clay-primary" />
        <span>
          Pengingat dikirim otomatis ke lonceng notifikasi &amp; browser. Ujian
          diingatkan otomatis H-1. Perlu bantuan belajar?{" "}
          <Link href="/chat" className="font-extrabold text-clay-primary underline underline-offset-2">
            tanya Eureka
          </Link>
          .
        </span>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
