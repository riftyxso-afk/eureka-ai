"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Construction, FileText, Flame, BookOpen, Trophy, User, type LucideIcon } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";

const LABELS: Record<string, { title: string; desc: string; icon: LucideIcon }> = {
  ujian: {
    title: "Ujian",
    desc: "Kelola jadwal ujian dan latihan soalmu di sini.",
    icon: FileText,
  },
  "mata-pelajaran": {
    title: "Mata Pelajaran",
    desc: "Jelajahi semua mata pelajaran dan topik yang tersedia.",
    icon: BookOpen,
  },
  streaks: {
    title: "Streaks",
    desc: "Pertahankan ritme belajarmu setiap hari.",
    icon: Flame,
  },
  leaderboard: {
    title: "Leaderboard",
    desc: "Lihat posisimu di antara teman-teman belajar.",
    icon: Trophy,
  },
  profil: {
    title: "Profil",
    desc: "Kelola data dirimu dan pengaturan akun.",
    icon: User,
  },
};

export default function DashboardSlugPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const meta = LABELS[slug] ?? {
    title: slug,
    desc: "Halaman ini sedang disiapkan.",
    icon: Construction,
  };

  return (
    <div className="flex items-center justify-center py-16">
      <CardClay className="flex w-full max-w-lg flex-col items-center py-14 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary/10 text-clay-primary">
          <meta.icon size={38} />
        </div>
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
