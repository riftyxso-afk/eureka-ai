"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import Link from "next/link";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import type { Subject } from "@/lib/subjects";

const ADD_COLORS = ["#8B5CF6", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#EC4899", "#14B8A6"];

interface SubjectWithCount extends Subject {
  totalNotes: number;
}

export default function MataPelajaranPage() {
  const [subjects, setSubjects] = useState<SubjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/subjects");
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects ?? []);
      }
    } catch {
      // biarkan kosong
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setError("Nama mata pelajaran kosong.");
      return;
    }
    try {
      const res = await apiFetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: ADD_COLORS[subjects.length % ADD_COLORS.length],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah.");
      setSubjects((prev) => [...prev, { ...data.subject, totalNotes: 0 }]);
      setNewName("");
      setAdding(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    }
  };

  const handleDelete = async (subject: SubjectWithCount) => {
    if (!window.confirm(`Hapus mata pelajaran "${subject.name}"?`)) return;
    try {
      await apiFetch(`/api/subjects/${subject.id}`, { method: "DELETE" });
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    } catch {
      setError("Gagal menghapus.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Mata Pelajaran</h1>
          <p className="mt-2 text-base font-semibold text-clay-muted">
            Pantau progress mastery setiap pelajaran
          </p>
        </div>
        <ButtonClay
          onClick={() => {
            setAdding((a) => !a);
            setError(null);
          }}
          className="!min-h-[44px] !px-5 text-sm"
        >
          <Plus size={18} className="mr-2" />
          Tambah Mata Pelajaran
        </ButtonClay>
      </div>

      {adding && (
        <CardClay className="mt-6 !p-5">
          <div className="flex items-center justify-between">
            <p className="text-base font-extrabold">Tambah Mata Pelajaran</p>
            <button
              onClick={() => setAdding(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset"
              aria-label="Tutup form"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <InputClay
              placeholder="Nama mata pelajaran (contoh: Teknologi)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <ButtonClay onClick={handleAdd} className="shrink-0 !min-h-[44px] !px-5 text-sm">
              Simpan
            </ButtonClay>
          </div>
          {error && <p className="mt-2 text-sm font-bold text-red-500">{error}</p>}
        </CardClay>
      )}

      {loading ? (
        <div className="card-clay mt-6 flex items-center justify-center py-14 text-clay-muted">
          <p className="text-base font-extrabold">Memuat...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card-clay mt-6 flex flex-col items-center py-14 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-beige shadow-clay-inset">
            <BookOpen size={36} className="text-clay-muted" />
          </div>
          <h3 className="mt-6 text-xl font-extrabold">Belum ada mata pelajaran</h3>
          <p className="mt-2 max-w-sm text-base font-semibold text-clay-muted">
            Tambahkan mata pelajaran pertamamu â€” otomatis muncul di menu Buat Catatan.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="card-clay flex flex-col gap-4 !p-6 transition-all duration-75 hover:-translate-y-0.5 hover:shadow-[0_12px_0_#C1B4A4]"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-clay-inset"
                  style={{ backgroundColor: `${subject.color}26` }}
                >
                  {subject.emoji}
                </div>
                <button
                  onClick={() => handleDelete(subject)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset transition-colors hover:text-red-500"
                  aria-label={`Hapus ${subject.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div>
                <p className="text-lg font-extrabold text-clay-dark">{subject.name}</p>
                <p className="mt-0.5 text-sm font-bold text-clay-muted">
                  {subject.totalNotes} catatan
                </p>
              </div>
              <div>
                <div className="h-4 overflow-hidden rounded-clay-full bg-clay-inputBg shadow-clay-inset">
                  <div
                    className="h-full rounded-clay-full transition-all duration-300"
                    style={{ width: `${subject.progress}%`, backgroundColor: subject.color }}
                  />
                </div>
                <p className="mt-1.5 text-xs font-extrabold text-clay-muted">
                  {subject.progress}% mastery
                </p>
              </div>
              <Link
                href={`/dashboard?subject=${encodeURIComponent(subject.name)}`}
                className="btn-clay-ghost !min-h-[44px] !px-4 text-sm"
              >
                Lihat Catatan
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
