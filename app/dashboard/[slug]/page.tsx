"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";

const LABELS: Record<string, { title: string; desc: string; emoji: string }> = {
  ujian: {
    title: "Ujian",
    desc: "Kelola jadwal ujian dan latihan soalmu di sini.",
    emoji: "📝",
  },
  "mata-pelajaran": {
    title: "Mata Pelajaran",
    desc: "Jelajahi semua mata pelajaran dan topik yang tersedia.",
    emoji: "📚",
  },
  streaks: {
    title: "Streaks",
    desc: "Pertahankan ritme belajarmu setiap hari.",
    emoji: "🔥",
  },
  leaderboard: {
    title: "Leaderboard",
    desc: "Lihat posisimu di antara teman-teman belajar.",
    emoji: "🏆",
  },
  profil: {
    title: "Profil",
    desc: "Kelola data dirimu dan pengaturan akun.",
    emoji: "👤",
  },
};

export default function DashboardSlugPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const meta = LABELS[slug] ?? {
    title: slug,
    desc: "Halaman ini sedang disiapkan.",
    emoji: "🚧",
  };

  return (
    <div className="flex items-center justify-center py-16">
      <CardClay className="flex w-full max-w-lg flex-col items-center py-14 text-center">
        <div className="text-6xl">{meta.emoji}</div>
        <h1 className="mt-4 text-3xl font-extrabold">{meta.title}</h1>
        <p className="mt-2 max-w-sm text-base font-semibold text-clay-muted">
          {meta.desc}
        </p>
        <Link href="/dashboard" className="mt-8">
          <ButtonClay>Kembali ke Dashboard</ButtonClay>
        </Link>
      </CardClay>
    </div>
  );
}
