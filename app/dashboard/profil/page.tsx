"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
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

const mockUserProfile = {
  name: "Riftyxso",
  email: "riftyxso@email.com",
  school: "SMA Negeri 1 Jakarta",
  grade: "11 SMA",
  level: 5,
  levelTitle: "PELAJAR KONSISTEN",
  xp: 4200,
  totalNotes: 12,
  streak: 7,
  joinedAt: "2026-01-15",
  avatar: "🧑‍🎓",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfilPage() {
  const [form, setForm] = useState({
    name: mockUserProfile.name,
    email: mockUserProfile.email,
    school: mockUserProfile.school,
    grade: mockUserProfile.grade,
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      showToast("Nama tidak boleh kosong! ⚠️");
      return;
    }
    showToast("Profil berhasil disimpan! ✅");
  };

  const handleLogout = () => {
    if (window.confirm("Yakin ingin keluar dari Eureka.AI?")) {
      showToast("Sampai jumpa lagi! 👋");
    }
  };

  const stats = [
    { icon: TrendingUp, label: "Total XP", value: mockUserProfile.xp },
    { icon: BookOpen, label: "Total Catatan", value: mockUserProfile.totalNotes },
    { icon: Flame, label: "Streak", value: mockUserProfile.streak },
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
          {mockUserProfile.avatar}
        </div>
        <p className="mt-4 text-2xl font-extrabold text-clay-dark">{form.name}</p>
        <p className="text-sm font-bold text-clay-muted">{form.email}</p>
        <span className="mt-3 inline-block rounded-clay-full border-2 border-clay-primary bg-clay-primary/10 px-5 py-1.5 text-sm font-extrabold text-clay-primary">
          Level {mockUserProfile.level} · {mockUserProfile.levelTitle}
        </span>
      </div>

      {/* Statistik akun */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-clay flex flex-col items-center gap-1 !p-5 text-center">
            <s.icon size={20} className="text-clay-primary" />
            <p className="text-2xl font-extrabold">{s.value}</p>
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
                {["10 SMA", "11 SMA", "12 SMA", "Mahasiswa"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-clay-muted">
                ▾
              </span>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-sm font-bold text-clay-muted">
            <Calendar size={15} />
            Bergabung sejak {formatDate(mockUserProfile.joinedAt)}
          </p>

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
