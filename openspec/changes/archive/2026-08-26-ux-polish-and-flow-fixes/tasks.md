# Tasks: UX Polish and Flow Fixes

## 1. Fondasi Visual (dikerjakan dulu — dipakai grup lain)

- [x] 1.1 Migrasikan palet `clay.*` di `tailwind.config.ts` ke referensi CSS variable, definisikan nilai `:root` + `.dark` di `app/globals.css`, hapus blok override `.dark .bg-*` lama; verifikasi mode terang tak berubah dan toggle gelap menggelapkan dashboard, catatan, jadwal, profil (screenshot before/after)
- [x] 1.2 Ganti warna hardcoded non-token (`bg-white`, hex inline) di komponen area login dengan token clay; audit dengan grep dan pastikan tidak ada permukaan putih tersisa saat mode gelap di modal/pop-up/overlay/skeleton
- [x] 1.3 Dokumentasikan skala radius resmi (clay 32 / clay-md 24 / clay-full 50) dan palet aksen multi-warna per mata pelajaran (≥10 hue) sebagai token Tailwind; sweep radius liar di komponen utama; verifikasi kontras WCAG AA tiap hue pada teks di kedua tema (skrip/cek manual tercatat)

## 2. Bug Fix Uji Pemahaman

- [x] 2.1 Tambah guard submit di `components/note/ComprehensionPage.tsx`: hitung soal kosong (MCQ belum dipilih / essay kosong), tampilkan modal konfirmasi jumlahnya sebelum menilai; verifikasi manual alur setup→work→result
- [x] 2.2 Perbaiki penanganan gagal grade essay: respons non-ok dari `/comprehension/grade` diperlakukan seperti error → status "essay belum dinilai", skor parsial MCQ, tombol "Nilai Ulang Essay" tanpa kerja ulang; verifikasi dengan mematikan endpoint (mock 500)
- [x] 2.3 Perbaiki race abort: assign `AbortController` ke ref sebelum `await fetch`, bersihkan dead code `streamEndRef`; verifikasi klik "Hentikan" cepat saat mulai generate kembali ke layar konfigurasi tanpa error

## 3. Profil ↔ Onboarding

- [x] 3.1 Buat modul kosakata grade kanonik + normalizer (label lama `"10 SMA"` → enum `kelas_*`) di lib, satu sumber opsi jenjang→kelas dari `lib/onboardingContent.ts`; tambahkan unit test mapping (npm test / skrip node)
- [x] 3.2 Ubah `app/dashboard/profil/page.tsx`: select jenjang dapat diedit (SD/SMP/SMA/mahasiswa) dengan opsi kelas dinamis sesuai jenjang, baca/tulis enum kanonik, tampilkan ringkasan hasil analisis onboarding (psyType, topik lemah, kebiasaan, jam puncak); verifikasi akun dengan data onboarding menampilkan nilai benar dan simpan profil tidak merusak grade
- [x] 3.3 Tambah tombol "Lewati" di semua langkah `app/onboarding/page.tsx` yang menyimpan `profile_data.onboarding_skipped=true` via PUT profile lalu menuju aplikasi; ubah redirect guard login/register/auth-callback agar melewatkan pengguna skipped; verifikasi register baru bisa masuk aplikasi tanpa isi onboarding
- [x] 3.4 Tambah kartu "Lengkapi orientasi" di profil untuk pengguna skipped yang membuka `/onboarding?resume=1`, dan bersihkan flag skipped setelah selesai; verifikasi resume menyimpan hasil lengkap seperti pengguna biasa

## 4. Dashboard Catatan & Sidebar

- [x] 4.1 Implementasikan peta subject→accent deterministik (hash nama mapel → indeks palet 1.3) + ikon mapel; render blok sampul berwarna di `components/dashboard/NoteItem.tsx` dengan fallback netral untuk catatan tanpa mapel; verifikasi kartu berbeda warna antar mapel dan konsisten lintas refresh/perangkat
- [x] 4.2 Ganti logika aktif sidebar (`components/layout/Sidebar.tsx`) menjadi pencocokan prefix + pemetaan induk (`/dashboard/note/*`→Dashboard, tepat satu item aktif); verifikasi buka detail catatan/bab/uji-pemahaman menyalakan highlight Dashboard dan tak ada dua item aktif bersamaan

## 5. Jadwal Berwarna

- [x] 5.1 Perluas `lib/schedule-store.ts`: `addScheduleEntry` menerima `color?` opsional (fallback perilaku giliran existing); verifikasi penyimpanan localStorage tetap kompatibel dengan data lama
- [x] 5.2 Tambah daftar swatch warna (palet token 1.3, ≥8 pilihan) pada form tambah kegiatan di `app/dashboard/jadwal/page.tsx` + pemilihan warna teks otomatis berbasis luminance agar label terbaca di kedua tema; verifikasi event tersimpan tampil berwarna pilihan dan terbaca di mode gelap

## 6. Perayaan & Feedback Animasi

- [x] 6.1 Bangun `components/CelebrationOverlay.tsx` (varian answer-correct / answer-wrong / complete / milestone) dengan framer-motion spring, hanya transform/opacity, `useReducedMotion()` degradasi statis, auto-unmount; verifikasi reduced motion mematikan gerak besar
- [x] 6.2 Pasang pop-up umpan balik saat menjawab di ComprehensionPage (benar/salah instan) dan perayaan di stage result uji pemahaman; verifikasi animasi tidak menghalangi pembacaan skor dan bisa dilewati
- [x] 6.3 Hubungkan varian milestone ke penyelesaian misi (integrasi alur misi existing, acuan pola `LevelUpOverlay`) dengan intensitas sadar-profil (skor ≥90% / misi naik → lebih meriah); verifikasi menyelesaikan misi memutar perayaan pencapaian

## 7. AI Terikat Konteks Catatan

- [x] 7.1 Perluas `app/api/notes/[id]/ask/route.ts`: terima maksimal 4 giliran pesan terakhir sebagai riwayat (dibingkai sebagai data), pertajam prompt penolakan di luar materi; verifikasi pertanyaan lanjutan nyambung dan pertanyaan di luar materi ditolak sopan
- [x] 7.2 Deteksi catatan belum siap (belum ada chunk/embedding) → balas kode spesifik; ubah `components/note/NoteAIChat.tsx` menampilkan panel "Materi sedang disiapkan…" berindikator progres job existing, bukan toast retry; verifikasi pada catatan yang masih diproses

## 8. Buku Panduan Web

- [x] 8.1 Buat route `app/dashboard/panduan/page.tsx`: konten statis Bahasa Indonesia per fitur inti (catatan, uji pemahaman, flashcards, jadwal, misi, streaks, referral) dengan daftar isi anchor-click memakai CardClay/ButtonClay; verifikasi lompat bagian bekerja dan konten terbaca di kedua tema
- [x] 8.2 Masukkan entri "Panduan" ke navigasi sidebar (grup bawah dekat Pengaturan); verifikasi reachable dari semua halaman area login termasuk sidebar collapse & drawer mobile
- [x] 8.3 Tambah banner dismissible sekali-saja "Kenali Eureka.AI → Panduan" di dashboard untuk pengguna skipped onboarding (flag localStorage); verifikasi hanya muncul bagi skipped, hilang setelah ditutup, dan tak muncul lagi

## 9. Verifikasi Akhir

- [x] 9.1 Jalankan lint + typecheck (`npm run lint`) dan build produksi (`npm run build`) sampai bersih
- [ ] 9.2 Uji integrasi manual end-to-end: mode gelap penuh di semua halaman + modal, alur skip-onboarding → pakai app → lengkapi dari profil, uji pemahaman lengkap dengan guard & nilai ulang essay, jadwal berwarna, perayaan misi; catat hasil di deskripsi PR
