"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { CalendarDays, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { getUserId } from "@/lib/identity";

interface Exam {
  id: string;
  subject: string;
  title: string;
  date: string;
  status: "upcoming" | "completed";
  score: number | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UjianPage() {
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", title: "", date: "" });
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadExams = useCallback(async () => {
    try {
      const userId = getUserId();
      const res = await apiFetch(`/api/exams?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const payload = await res.json();
      if (Array.isArray(payload.exams)) setExams(payload.exams);
    } catch {
      // biarkan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
    const timer = setInterval(loadExams, 15000);
    return () => clearInterval(timer);
  }, [loadExams]);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.date) {
      notify("Isi nama ujian dan tanggalnya! ⚠️");
      return;
    }
    try {
      const userId = getUserId();
      const res = await apiFetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          userId,
          subject: form.subject,
          title: form.title,
          date: form.date,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Gagal menambah ujian.");
      setForm({ subject: "", title: "", date: "" });
      setShowForm(false);
      notify("Ujian ditambahkan! ✅");
      loadExams();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal menambah ujian.");
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (!window.confirm(`Hapus ujian "${exam.title}"?`)) return;
    try {
      const userId = getUserId();
      const res = await apiFetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          userId,
          examId: exam.id,
        }),
      });
      if (res.ok) {
        notify("Ujian dihapus.");
        loadExams();
      }
    } catch {
      // abaikan
    }
  };

  const filtered = exams.filter((e) => e.status === tab);

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Ujian</h1>
          <p className="mt-2 text-base font-semibold text-clay-muted">
            Kelola jadwal ujian dan lihat hasilmu
          </p>
        </div>
        <ButtonClay
          onClick={() => setShowForm((v) => !v)}
          className="!min-h-[44px] !px-4 text-sm"
        >
          <Plus size={16} className="mr-2" />
          Tambah Ujian
        </ButtonClay>
      </div>

      {/* Form tambah */}
      {showForm && (
        <div className="card-clay mt-6 space-y-4 !p-5">
          <h2 className="text-base font-extrabold">Ujian Baru</h2>
          <InputClay
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Nama ujian (contoh: UTS Matematika)"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputClay
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Mata pelajaran (contoh: Matematika)"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end">
            <ButtonClay onClick={handleAdd} className="!min-h-[44px] !px-5 text-sm">
              Simpan Ujian
            </ButtonClay>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {(
          [
            { id: "upcoming", label: "Akan Datang" },
            { id: "completed", label: "Selesai" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`btn-clay-ghost !min-h-[44px] flex-1 !px-4 !py-2 text-sm ${
              tab === t.id
                ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                : ""
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {loading ? (
          <div className="card-clay flex items-center justify-center py-14 text-center">
            <p className="text-sm font-bold text-clay-muted">Memuat ujian...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-clay flex flex-col items-center py-14 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
              <ClipboardCheck size={36} className="text-clay-muted" />
            </div>
            <h3 className="mt-6 text-xl font-extrabold">
              {tab === "upcoming" ? "Tidak ada ujian mendatang" : "Belum ada ujian selesai"}
            </h3>
            <p className="mt-2 max-w-sm text-base font-semibold text-clay-muted">
              {tab === "upcoming"
                ? "Santai dulu — tambah ujianmu agar jadwalnya terpantau."
                : "Selesaikan ujian dan hasilnya akan tampil di sini."}
            </p>
          </div>
        ) : (
          filtered.map((exam) => (
            <div key={exam.id} className="card-clay flex flex-col gap-3 !p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-lg font-extrabold">{exam.title}</p>
                <p className="mt-1 text-sm font-bold text-clay-muted">
                  {exam.subject}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="flex items-center gap-1.5 text-sm font-bold text-clay-muted">
                  <CalendarDays size={15} />
                  {formatDate(exam.date)}
                </span>
                {exam.status === "upcoming" ? (
                  <span className="flex items-center gap-3">
                    <span className="rounded-clay-full bg-clay-secondary/20 px-3 py-1 text-xs font-extrabold text-clay-secondary">
                      Akan Datang
                    </span>
                    <button
                      onClick={() => handleDelete(exam)}
                      aria-label="Hapus ujian"
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-clay-shadow/30 bg-white/90 text-clay-muted transition-colors hover:border-red-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span className="rounded-clay-full bg-clay-success/20 px-3 py-1 text-xs font-extrabold text-clay-success">
                      Selesai
                    </span>
                    <span className="text-2xl font-extrabold text-clay-primary">
                      {exam.score}
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
