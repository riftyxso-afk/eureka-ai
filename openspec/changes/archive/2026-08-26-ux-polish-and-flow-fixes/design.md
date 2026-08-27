# Design: UX Polish and Flow Fixes

## Context

Kondisi saat ini yang membatasi pendekatan:

- **Dark mode** dikelola lewat override CSS per-kelas (`​.dark .bg-clay-beige`, dst.) di `app/globals.css` (~485 baris) — bukan token variabel. Setiap warna hardcoded baru (`bg-white`, hex inline) tidak ikut gelap; inilah sumber "bocor terang".
- **Onboarding** (`app/onboarding/page.tsx`, ~798 baris) menyimpan nilai kelas sebagai enum mesin (`kelas_1` … `semester_5`) ke `profile_data` JSONB via `PUT /api/profile`. Tidak ada jalur skip: register/auth-callback selalu me-redirect ke `/onboarding` sampai `onboarding_completed=true`.
- **Profil** (`app/dashboard/profil/page.tsx`) punya select kelas hardcoded label (`"10 SMA"` dst.) → bentrok dengan enum onboarding; jenjang tidak bisa diedit; hasil analisis onboarding tidak tampil.
- **Uji pemahaman**: MCQ dinilai klien-side; essay via `POST .../comprehension/grade` — respons non-ok membuat `essayResult = []` diam (skor turun tanpa penjelasan); tidak ada guard soal kosong; `streamAbortRef` di-assign setelah `await` (race saat klik Hentikan).
- **Sidebar**: `active={pathname === item.href}` — persis saja, sub-halaman seperti `/dashboard/note/[id]` tidak menyalakan highlight.
- **Jadwal**: persisten per-user di localStorage (`lib/schedule-store.ts`); `addScheduleEntry` mengisi warna otomatis bergiliran dari `DEFAULT_COLORS` — pengguna tidak bisa memilih.
- **AI catatan**: `/api/notes/[id]/ask` sudah RAG (top-4 chunk) + system prompt pembatas konteks, tapi stateless (riwayat chat klien tak dikirim) dan belum membedakan "catatan masih diproses" dari error generik.
- **Bahan desain ada**: framer-motion sudah dipakai luas (AnimatePresence di Sidebar dll.), sistem claymorphism solid-shadow di `tailwind.config.ts`.

## Goals / Non-Goals

**Goals:**
- Satu strategi tema (token CSS variable) sehingga mode gelap otomatis mengikuti palet.
- Kosakata grade kanonik tunggal + normalizer data lama.
- Perbaikan reliabilitas alur uji pemahaman tanpa mengubah arsitektur penilaian.
- Komponen perayaan/feedback yang reusable dan sadar reduced-motion.
- Standar visual terdokumentasi (radius scale, palet mapel) yang dipakai semua item lain.

**Non-Goals:**
- Migrasi jadwal dari localStorage ke database (tetap lokal).
- Mengganti mesin penilaian MCQ menjadi server-side penuh (diluar lingkup; hanya validasi & error handling).
- Menambah kolom database wajib baru untuk fitur-fitur ini.
- Mendesain ulang halaman publik (landing/login/register tetap terang).

## Decisions

### D1 — Dark mode: migrasi palet clay ke CSS variables
Ubah definisi warna `clay.*` di `tailwind.config.ts` menjadi referensi `var(--clay-primary)` dst., lalu definisikan nilai variabel di `:root` dan ganti seluruh blok override `.dark .bg-*` dengan satu blok `.dark { --clay-beige: ... }`. Utilitas Tailwind yang sudah tersebar (`bg-clay-beige`, `text-clay-dark`, shadow clay) otomatis ikut gelap tanpa edit ratusan file.
*Alternatif:* melanjutkan pola override per-kelas → ditolak karena justru penyebab bocornya cakupan sekarang; setiap komponen baru menuntut override manual. Warna hardcoded non-token (mis. `bg-white` di beberapa file) diganti token semantik (`clay.cream`) selama sweep.

### D2 — Grade: enum onboarding sebagai kanon + normalizer baca
Nilai kanonik = enum mesin onboarding (`kelas_7`…`semester_5`). Profil membaca/menulis enum itu; select profil dirender dari `onboardingContent.ts` (satu sumber opsi jenjang→kelas). Normalizer kecil memetakan nilai label lama (`"10 SMA"`) → enum saat membaca `profile_data`, sehingga data lama tidak rusak.
*Alternatif:* migrasi massal data lama sekali jalan → ditolak (berisiko; normalizer cukup dan reversibel).

### D3 — Uji pemahaman: perbaikan presisi, bukan rombak besar
(a) Guard submit: modal konfirmasi bila ada soal kosong. (b) Kegagalan grade essay: respons non-ok diperlakukan sama dengan throw → status "essay belum dinilai" + skor parsial + tombol "Nilai Ulang Essay". (c) Race abort: simpan `AbortController` ke ref **sebelum** `await fetch`; bersihkan `streamEndRef` mati. (d) Server grade tetap menerima payload sesi (validasi kepemilikan catatan sudah ada di route).

### D4 — Sidebar: pencocokan prefix dengan tabel induk
Item aktif bila `pathname === href || pathname.startsWith(href + "/")`, plus pemetaan khusus: `/dashboard/note/*` → menu "Dashboard", `/quiz/*` & `/share/*` → tidak ada yang aktif. Aturan "tepat satu aktif": urutkan match terpanjang menang.

### D5 — Sampul catatan: warna deterministik dari subject, tanpa kolom baru
Peta `subject → accent` (hash stabil nama mata pelajaran → indeks palet 10 warna). Kartu render blok sampul berwarna + ikon mapel. Tidak menyimpan apa pun; konsisten lintas perangkat karena deterministik. Ikon mapel dipetakan dari daftar mata pelajaran resmi (ada spec `subjects`).
*Alternatif:* gambar sampul uploadable → ditolak untuk iterasi ini (biaya storage/moderasi); bisa jadi pengembangan berikutnya.

### D6 — Warna jadwal: picker dari palet tetap
Perluas `addScheduleEntry(input)` menerima `color?` opsional; form tambah kegiatan merender swatch palet (≥8 warna, token yang sama dengan palet mapel D5 agar satu sistem warna). Tanpa pilihan → perilaku giliran existing tetap (sudah sesuai spec). Label teks pada event diberi warna teks kontras otomatis (luminance check sederhana) agar aman di kedua tema.

### D7 — Perayaan: satu komponen overlay berbasis framer-motion
`CelebrationOverlay` (varian: `answer-correct`, `answer-wrong`, `complete`, `milestone`) memakai spring physics + `useReducedMotion()` (framer-motion) untuk degradasi statis. Trigger: submit uji pemahaman (stage result), selesai kuis, event misi selesai (hook ke alur misi existing). Intensitas dibaca dari profil (`profile_data.grade` + progres misi): skor ≥90% atau misi naik level → varian lebih meriah (`LevelUpOverlay` yang sudah ada dijadikan acuan pola, bukan diduplikasi).

### D8 — Skip onboarding: flag terpisah dari completed
Tambah tombol "Lewati" (setiap langkah) → `PUT /api/profile` dengan `profile_data.onboarding_skipped=true` (tanpa menyentuh `onboarding_completed`). Redirect guard login/register/callback berubah: lewati redirect bila `completed OR skipped`. Halaman profil mendapat kartu "Lengkapi orientasi" yang membuka `/onboarding?resume=1` bagi pengguna skipped; setelah selesai, flag skipped dibersihkan. Draft localStorage lama tidak dihapus agar resume mulai dari data tersimpan.
*Alternatif:* menandai skip sebagai completed → ditolak (kehilangan jejak siapa yang perlu ditawari melengkapi).

### D9 — Buku panduan: halaman statis area login
Route baru `app/dashboard/panduan` — konten statis Indonesia (per fitur inti), daftar isi anchor-click, memakai komponen CardClay/ButtonClay existing. Masuk lewat sidebar (grup bawah, dekat Pengaturan). Pintasan sekali-saja untuk pengguna skipped: banner dismissible di dashboard (flag di localStorage) — bukan modal paksa.

### D10 — AI terikat konteks: riwayat singkat + state proses
`POST /ask` menerima N pesan terakhir (maks 4) sebagai ringkasan giliran dalam prompt; topK tetap 4. Deteksi "belum siap": bila catatan belum punya chunk/embedding, balas kode spesifik (bukan 422 generik) → UI menampilkan panel "Materi sedang disiapkan…" dengan indikator progres job yang sudah ada (`notes/process-progress`). Prompt penolakan dipertajam (contoh frasa tolak). Biaya token naik sedikit (4 giliran ≈ ratusan token) — diterima.

## Risks / Trade-offs

- [Migrasi token tema mengubah nuansa visual halaman yang sudah oke] → bandingkan screenshot before/after per halaman utama saat sweep; nilai variabel dark dipertahankan sama dengan override `.dark` existing.
- [Normalizer grade salah memetakan label lama] → unit test tabel mapping + fallback aman (nilai tak dikenal ditampilkan mentah, tidak crash).
- [Overlay animasi berat di perangkat murah] → hanya animasi transform/opacity, durasi <2s, hormati reduced-motion, unmount setelah selesai.
- [Riwayat chat menaikkan biaya token & risiko prompt injection via riwayat] → batas 4 giliran, riwayat dibingkai sebagai data (pola yang sudah dipakai untuk konteks chunk), rate limit existing 30/jam tetap.
- [Skip onboarding membuat personalisasi kosong] → fallback konten default sudah ada (`FALLBACK` pada analyze); pintasan panduan + kartu "lengkapi orientasi" menjaga jalur aktivasi.

## Migration Plan

1. Deploy bersama (front-end + API ask/profile). Tanpa migrasi skema DB.
2. Data lama: label grade lama dinormalisasi saat baca (D2); localStorage jadwal/onboarding lama tetap valid.
3. Rollback: revert deploy — tidak ada perubahan data permanen selain `profile_data.onboarding_skipped` yang harmless.

## Open Questions

- Palet warna final (10 hue mapel): perlu approval visual dari kamu saat implementasi — proposal hue akan dilampirkan di PR pertama bagian visual.
