# Rekaman panduan halaman

Pop-up sudah diisi rekaman layar dari aplikasi menggunakan akun demo. Setiap video
memiliki petunjuk singkat dalam Bahasa Indonesia dan poster dengan nama yang sama.
Daftar video terpasang ada di `lib/pageGuideRecordings.ts`. Panduan baru yang belum
memiliki video tetap menampilkan placeholder.

Rekaman memperlihatkan interaksi UI yang nyata. Materi, kuis, dan kartu pada akun
demo disiapkan sebagai contoh. Video pengaturan AI menunjukkan cara menyiapkan
permintaan; video tidak mensimulasikan jawaban atau hasil generasi AI.
Jeda diam selama perekaman dipersingkat. Rekaman tidak memiliki audio.

Untuk mengganti rekaman:

1. Simpan rekaman MP4/WebM di folder ini, misalnya `editor.mp4`.
2. Ganti file video dan poster yang namanya sesuai daftar. Untuk URL atau nama
   khusus, tambahkan properti pada panduan di `lib/pageGuides.ts`:

   ```ts
   "room-notes": {
     // Judul, langkah, dan tombol yang sudah ada tetap digunakan.
     recording: { src: "/tutorials/editor.mp4", poster: "/tutorials/editor.webp" },
   }
   ```

`poster` opsional. URL video HTTPS juga dapat digunakan. Pemutar memiliki kontrol,
tidak autoplay, dan berhenti saat pop-up ditutup. Rekaman lanskap 16:9 disarankan;
video ditampilkan utuh tanpa dipotong. Jangan sertakan data akun atau API key
dalam rekaman.

ID ruang belajar: `room-learn`, `room-notes`, `room-mindmap`, `room-quiz`,
`room-cards`, `room-sources`, `room-ask`, `room-podcast`, `room-scratch`.
Beranda menggunakan `dashboard`, percakapan umum menggunakan `chat`.

Tutorial muncul sekali per fitur per akun pada browser yang sama. Tombol
**Panduan** membuka ulang. Mengganti video tidak menghapus pilihan pengguna.
