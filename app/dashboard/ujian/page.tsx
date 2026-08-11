"use client";

import { useState } from "react";
import { CalendarDays, ClipboardCheck } from "lucide-react";

interface Exam {
  id: number;
  subject: string;
  title: string;
  date: string;
  status: "upcoming" | "completed";
  score: number | null;
}

const mockExams: Exam[] = [
  { id: 1, subject: "Matematika", title: "UTS Matematika Wajib", date: "2026-08-15", status: "upcoming", score: null },
  { id: 2, subject: "Fisika", title: "UAS Fisika", date: "2026-08-20", status: "upcoming", score: null },
  { id: 3, subject: "Kimia", title: "Ulangan Harian Kimia", date: "2026-08-05", status: "completed", score: 85 },
  { id: 4, subject: "Biologi", title: "UTS Biologi", date: "2026-07-28", status: "completed", score: 90 },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UjianPage() {
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");

  const filtered = mockExams.filter((e) => e.status === tab);

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Ujian</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Kelola jadwal ujian dan lihat hasilmu
      </p>

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
        {filtered.length === 0 ? (
          <div className="card-clay flex flex-col items-center py-14 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
              <ClipboardCheck size={36} className="text-clay-muted" />
            </div>
            <h3 className="mt-6 text-xl font-extrabold">
              {tab === "upcoming" ? "Tidak ada ujian mendatang" : "Belum ada ujian selesai"}
            </h3>
            <p className="mt-2 max-w-sm text-base font-semibold text-clay-muted">
              {tab === "upcoming"
                ? "Santai dulu — ujian baru akan muncul di sini."
                : "Selesaikan ujian dan hasilnya akan tampil di sini."}
            </p>
          </div>
        ) : (
          filtered.map((exam) => (
            <div key={exam.id} className="card-clay flex items-center justify-between gap-4 !p-5">
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold">{exam.title}</p>
                <p className="mt-1 text-sm font-bold text-clay-muted">
                  {exam.subject}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-clay-muted">
                  <CalendarDays size={15} />
                  {formatDate(exam.date)}
                </span>
                {exam.status === "upcoming" ? (
                  <span className="rounded-clay-full bg-clay-secondary/20 px-3 py-1 text-xs font-extrabold text-clay-secondary">
                    Akan Datang
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
    </div>
  );
}
