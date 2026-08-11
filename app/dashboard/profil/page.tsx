"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Flame,
  GraduationCap,
  LogOut,
  Mail,
  School,
  TrendingUp,
  User,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import InputClay from "@/components/ui/InputClay";
import { useOnboarding } from "@/context/OnboardingContext";
import { getUserId, getUserName, setUserName } from "@/lib/identity";
import { logoutUser } from "@/lib/auth";

const SCHOOL_KEY = "eureka_school";

function readSchool(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SCHOOL_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function ProfilPage() {
  const { data, update } = useOnboarding();
  const userId = getUserId();
  const [form, setForm] = useState({
    name: getUserName(),
    email: "",
    school: readSchool(),
    grade: "",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState({
    xp: 0,
    level: 1,
    streak: 0,
    rank: null as number | null,
    totalNotes: 0,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: getUserName(),
      email: prev.email || "akun-lokal@eureka.local",
      grade: data.grade || prev.grade,
    }));
  }, [data.grade]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [progressRes, notesRes] = await Promise.all([
        fetch(`/api/progress?userId=${encodeURIComponent(userId)}`),
        fetch("/api/notes"),
      ]);
      if (progressRes.ok) {
        const payload = await progressRes.json();
        if (payload.stats) {
          setStats((prev) => ({
            ...prev,
            xp: payload.stats.xp,
            level: payload.stats.level,
            streak: payload.stats.streak,
            rank: payload.stats.rank,
          }));
        }
      }
      if (notesRes.ok) {
        const payload = await notesRes.json();
        setStats((prev) => ({
          ...prev,
          totalNotes: Array.isArray(payload.notes) ? payload.notes.length : 0,
        }));
      }
    } catch {
      // biarkan nilai awal
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("Nama tidak boleh kosong! ⚠️");
      return;
    }
    setUserName(form.name);
    update({ name: form.name.trim(), grade: form.grade });
    try {
      window.localStorage.setItem(SCHOOL_KEY, form.school.trim());
    } catch {
      // abaikan
    }
    try {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          userId,
          name: form.name.trim(),
        }),
      });
    } catch {
      // abaikan
    }
    showToast("Profil berhasil disimpan! ✅");
  };

  const handleLogout = async () => {
    if (window.confirm("Yakin ingin keluar dari Eureka.AI?")) {
      await logoutUser();
      window.location.href = "/login";
    }
  };

  const statCards = [
    { icon: TrendingUp, label: "Total XP", value: stats.xp },
    { icon: BookOpen, label: "Total Catatan", value: stats.totalNotes },
    { icon: Flame, label: "Streak", value: stats.streak },
  ];

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Profil</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Kelola data diri dan pengaturan akunmu
      </p>

      {/* Avatar + info ringkas */}
      <div className="card-clay mt-6 flex flex-col items-center py-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-clay-primary/20 text-5xl shadow-clay-sm">
          🧑‍🎓
        </div>
        <p className="mt-4 text-2xl font-extrabold text-clay-dark">{form.name}</p>
        <p className="text-sm font-bold text-clay-muted">{form.email}</p>
        <span className="mt-3 inline-block rounded-clay-full border-2 border-clay-primary bg-clay-primary/10 px-5 py-1.5 text-sm font-extrabold text-clay-primary">
          Level {stats.level} · PELAJAR KONSISTEN
        </span>
      </div>

      {/* Statistik akun */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="card-clay flex flex-col items-center gap-1 !p-4 text-center sm:!p-5">
            <s.icon size={18} className="text-clay-primary sm:hidden" />
            <s.icon size={20} className="hidden text-clay-primary sm:block" />
            <p className="text-xl font-extrabold sm:text-2xl">
              {s.value.toLocaleString("id-ID")}
            </p>
            <p className="text-xs font-bold text-clay-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Form edit profil */}
      <CardClay className="mt-6">
        <h2 className="text-lg font-extrabold text-clay-dark">Edit Profil</h2>

        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <User size={15} className="text-clay-primary" />
              NAMA LENGKAP
            </label>
            <InputClay
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama lengkap"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <Mail size={15} className="text-clay-primary" />
              EMAIL
            </label>
            <InputClay
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@contoh.com"
              disabled
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <School size={15} className="text-clay-primary" />
              SEKOLAH
            </label>
            <InputClay
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              placeholder="Nama sekolah"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-clay-dark">
              <GraduationCap size={15} className="text-clay-primary" />
              KELAS
            </label>
            <div className="relative">
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full appearance-none rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-5 py-4 pr-12 text-base font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
              >
                {["", "10 SMA", "11 SMA", "12 SMA", "Mahasiswa"].map((g) => (
                  <option key={g} value={g}>
                    {g || "Pilih kelas..."}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-clay-muted">
                ▾
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <ButtonClay onClick={handleSave} className="sm:flex-1">
              Simpan Perubahan
            </ButtonClay>
            <ButtonClay
              variant="secondary"
              onClick={handleLogout}
              className="border-red-300 text-red-500 sm:flex-1"
            >
              <LogOut size={18} className="mr-2" />
              Keluar
            </ButtonClay>
          </div>
        </div>
      </CardClay>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn">
          {toast}
        </div>
      )}
    </div>
  );
}
