"use client";

import {
  BookOpenCheck,
  CalendarDays,
  Flame,
  Gift,
  Layers,
  Sparkles,
  StickyNote,
  Target,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";

/**
 * Buku Panduan — halaman bantuan dalam aplikasi (Bahasa Indonesia).
 * Konten statis per fitur inti + daftar isi anchor-click.
 */

interface GuideSection {
  id: string;
  icon: typeof Sparkles;
  title: string;
  intro: string;
  steps: string[];
}

const SECTIONS: GuideSection[] = [
  {
    id: "catatan",
    icon: StickyNote,
    title: "Catatan Otomatis",
    intro:
      "Ubah video YouTube, artikel web, atau dokumen (PDF/DOCX/PPTX/TXT) jadi catatan lengkap — bisa gabung sampai 5 sumber sekaligus.",
    steps: [
      "Buka Dashboard → tombol Buat Catatan.",
      "Pilih sumber: unggah dokumen atau tempel link YouTube/web (bisa campur).",
      "Tunggu AI mengolah — kamu bisa tutup halaman, proses tetap jalan.",
      "Catatan jadi? Baca per bab, stabilo poin penting, atau minta AI meringkas.",
    ],
  },
  {
    id: "uji-pemahaman",
    icon: BookOpenCheck,
    title: "Uji Pemahaman",
    intro:
      "Latihan soal pilihan ganda & essay yang dibuat dari isi catatanmu, lengkap dengan pembahasan.",
    steps: [
      "Buka catatan → pilih Uji Pemahaman.",
      "Atur jumlah soal, tingkat kesulitan, dan tipe soal.",
      "Jawab semua soal lalu tekan Kumpulkan Jawaban.",
      "Belum sempat jawab semua? Sistem akan bertanya dulu sebelum menilai.",
    ],
  },
  {
    id: "flashcards",
    icon: Layers,
    title: "Flashcards",
    intro:
      "Kartu hafalan otomatis dari materi untuk latihan ingatan cepat sebelum ulangan.",
    steps: [
      "Buka catatan → pilih Flashcards.",
      "Balik kartu untuk melihat definisi atau jawaban.",
      "Ulangi bagian yang sering keliru — AI membantu membuat variasi soal.",
    ],
  },
  {
    id: "jadwal",
    icon: CalendarDays,
    title: "Jadwal Belajar",
    intro:
      "Susun jadwal mingguan mata pelajaran plus daftar tugas dengan tenggat.",
    steps: [
      "Buka Jadwal di menu samping → Tambah Jadwal.",
      "Isi hari, jam, mata pelajaran, dan ruang (opsional).",
      "Pilih warna kesukaanmu supaya jadwal mudah dibedakan.",
      "Tab Tugas menyimpan daftar PR beserta tanggalnya.",
    ],
  },
  {
    id: "misi",
    icon: Target,
    title: "Misi Belajar",
    intro:
      "Target besar (naik kelas, lolos SNBT, IPK bagus) dipecah AI jadi langkah harian yang realistis.",
    steps: [
      "Buka Misi → Misi Baru, pilih jenis target.",
      "Isi kondisi sekarang, target, dan deadline.",
      "Tekan Minta Panduan untuk langkah-langkah dari AI.",
      "Selesaikan langkahnya, lalu tandai misi selesai dan rayakan!",
    ],
  },
  {
    id: "streaks",
    icon: Flame,
    title: "Streaks & XP",
    intro:
      "Belajar konsisten dapat hadiah: XP menaikkan level, streak menghitung hari belajar beruntun.",
    steps: [
      "Setiap aktivitas belajar memberi XP otomatis.",
      "Jaga streak dengan belajar minimal satu aktivitas per hari.",
      "Cek halaman Streaks dan Leaderboard buat memantau progresmu.",
    ],
  },
  {
    id: "referral",
    icon: Gift,
    title: "Ajak Teman (Referral)",
    intro:
      "Bagikan link undangan — setiap teman yang mendaftar mengantarimu lebih dekat ke Premium gratis.",
    steps: [
      "Buka Bagikan Link (Referral) di menu samping.",
      "Salin atau bagikan link ke teman lewat chat/media sosial.",
      "Kumpulkan rujukan valid sesuai target untuk klaim Premium 30 hari.",
    ],
  },
];

export default function PanduanPage() {
  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Panduan</h1>
      <p className="mt-2 max-w-2xl text-base font-semibold text-clay-muted">
        Cara memakai fitur-fitur Eureka.AI — pilih topik yang mau kamu kuasai,
        tidak perlu baca urut dari atas.
      </p>

      {/* Daftar isi */}
      <CardClay className="mt-5 !p-4 sm:!p-5">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-clay-muted">
          Daftar isi
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="rounded-clay-full border-2 border-clay-shadow/40 bg-clay-beige px-4 py-2 text-xs font-extrabold text-clay-dark transition-all duration-75 hover:-translate-y-0.5 hover:border-clay-primary hover:text-clay-primary"
            >
              {s.title}
            </button>
          ))}
        </div>
      </CardClay>

      {/* Bagian panduan */}
      <div className="mt-5 space-y-4">
        {SECTIONS.map((s) => (
          <CardClay key={s.id} className="scroll-mt-24">
            <section id={s.id}>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
                <span className="flex h-10 w-10 items-center justify-center rounded-clay-md bg-clay-primary/10 text-clay-primary">
                  <s.icon size={20} />
                </span>
                {s.title}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-clay-muted">
                {s.intro}
              </p>
              <ol className="mt-4 space-y-2">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay-primary/15 text-xs font-extrabold text-clay-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-bold leading-relaxed text-clay-dark">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </CardClay>
        ))}
      </div>

      <p className="mt-8 text-center text-xs font-bold text-clay-muted">
        Ada yang masih bikin bingung? Coba tanya langsung lewat fitur Tanya AI
        di dalam catatanmu.
      </p>
    </div>
  );
}
