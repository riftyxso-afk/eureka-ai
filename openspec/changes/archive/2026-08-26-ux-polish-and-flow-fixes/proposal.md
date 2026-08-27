# Proposal: UX Polish and Flow Fixes

## Why

Pengguna melaporkan pengalaman Eureka.AI terasa "setengah jadi": mode gelap bocor di banyak halaman, profil tidak sinkron dengan data onboarding (nilai kelas rusak karena konflik kosakata), uji pemahaman punya bug penilaian yang diam-diam menurunkan skor, dan tampilan keseluruhan monoton serta kurang playful untuk audiens pelajar. Perbaikan ini menggabungkan bug fix fungsional dengan perombakan bahasa visual agar produk terasa utuh dan menyenangkan.

## What Changes

**Bug fix / logic**
- Uji pemahaman: guard jawaban belum terisi, penanganan gagal grade essay yang saat ini diam (skor turun tanpa penjelasan), race condition tombol hentikan, dan validasi submit.
- Profil ↔ onboarding: satukan kosakata nilai kelas (`kelas_10` vs `"10 SMA"`), buat jenjang pendidikan dapat diedit, dan pastikan hasil onboarding tampil benar di profil.
- Mode gelap: lengkapi cakupan override `.dark` sehingga tidak ada lagi halaman/komponen yang tetap terang atau teks tak terbaca.
- Respons AI di luar konteks catatan: perkuat penegakan konteks pada tanya-jawab catatan dan tambahkan state jelas saat catatan masih diproses (bukan error generik yang bisa di-retry tanpa akhir).
- Highlight aktif di sidebar: item menu ikut aktif untuk sub-halaman (mis. `/dashboard/note/[id]` menyorot "Dashboard"), bukan pencocokan path persis.

**Fitur baru**
- Skip onboarding: pengguna bisa melewati alur onboarding dan mengisinya nanti dari profil.
- Thumbnail/sampul di kartu catatan dashboard (warna sampul otomatis per mata pelajaran + ikon).
- Daftar pilihan warna saat menambah kegiatan jadwal.
- Buku panduan web: halaman panduan pengguna dalam aplikasi (cara pakai fitur-fitur inti).
- Animasi perayaan saat menyelesaikan aktivitas belajar (jawaban benar, uji pemahaman selesai, misi terselesaikan) yang sadar-konteks profil.

**Bahasa visual (anti-slop)**
- Skala rounded konsisten di seluruh komponen (satu aturan radius, bukan campuran acak).
- Palet warna lebih ceria dan variatif namun terkontrol (aksen per-mata-pelajaran, bukan ungu-monoton), tetap dalam sistem claymorphism yang sudah ada.
- Micro-interaction pop-up saat menjawab soal (feedback benar/salah instan).

## Capabilities

### New Capabilities
- `onboarding`: alur onboarding yang bisa dilewati (skip) dan dilengkapi belakangan, termasuk kontrak penyimpanan datanya.
- `study-schedule`: manajemen jadwal belajar dengan palet warna kegiatan.
- `learning-celebrations`: animasi umpan balik dan perayaan untuk event belajar (menjawab, menyelesaikan uji/quiz, menyelesaikan misi) berbasis profil pengguna.
- `user-guide`: buku panduan pengguna dalam aplikasi.
- `visual-language`: standar bahasa visual lintas aplikasi — skala radius, sistem warna ceria per-mapel, status aktif sidebar, dan prinsip anti-slop.

### Modified Capabilities
- `comprehension-test`: pengerjaan wajib menangani soal tak terjawab dan kegagalan penilaian essay secara eksplisit; hasil tidak boleh mendiamkan error.
- `app-theme`: cakupan mode gelap diperluas menjadi keharusan menyeluruh (semua permukaan dan komponen terbakar `.dark`, bukan sebagian).
- `user-profile`: profil harus membaca/menulis nilai kelas memakai kosakata yang sama dengan onboarding dan menampilkan jenjang pendidikan yang dapat diubah.
- `notes`: kartu catatan dashboard menampilkan thumbnail/sampul; tanya-jawab AI catatan wajib terikat konteks catatan dengan state "sedang diproses" yang jelas.

## Impact

- **Kode**: `components/layout/Sidebar.tsx`, `components/dashboard/NoteItem.tsx`, `app/dashboard/note/[id]/uji-pemahaman/*`, `components/note/ComprehensionPage.tsx`, `app/onboarding/page.tsx`, `app/dashboard/profil/page.tsx`, `app/dashboard/jadwal/page.tsx`, `context/ThemeContext.tsx`, `app/globals.css`, `tailwind.config.ts`, `components/ui/*`, endpoint `app/api/notes/[id]/ask`, `app/api/notes/[id]/comprehension/*`, `app/api/profile`.
- **Database**: tidak ada migrasi skema baru yang wajib — warna sampul/warna jadwal disimpan pada kolom JSONB/kolom teks yang tersedia (mis. `profile_data`, tabel jadwal existing). Jika perlu kolom, ditambahkan lewat patch SQL bernomor lanjutan.
- **Risiko utama**: perubahan kosakata grade harus backward-compatible (data lama `kelas_*` dan label lama tetap terbaca); animasi harus menghormati `prefers-reduced-motion`; ekspansi palet tidak boleh merusak kontras WCAG AA maupun mode gelap.
