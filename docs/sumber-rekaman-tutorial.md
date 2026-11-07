# Rekaman panduan dalam aplikasi

Video pada `public/tutorials/` direkam langsung dari UI Eureka menggunakan akun
demo khusus dan materi contoh Sistem Pernapasan Manusia. Perekaman mencakup gerak
kursor dan interaksi nyata pada komponen aplikasi. Petunjuk Bahasa Indonesia
ditambahkan pada bidang subtitle di bawah rekaman.

- Format: MP4 H.264, 1920 × 1080, 24 fps, tanpa audio.
- Poster: WebP 960 × 540.
- Jeda diam yang panjang dipersingkat untuk memudahkan mengikuti langkah.
- Kuis dan kartu memakai data latihan contoh yang disimpan pada akun demo.
- Editor memperlihatkan perubahan yang disimpan, mindmap memperlihatkan cabang
  serta zoom, dan kuis/flashcard memperlihatkan respons interaksi sebenarnya.
- Video AI yang memerlukan layanan berbayar memperlihatkan pengaturan dan cara
  memulai permintaan. Respons AI tidak dibuat palsu untuk keperluan rekaman.
- Halaman pendukung berisi pengenalan area dan urutan penggunaan fitur. Halaman
  yang terkunci tetap memperlihatkan status pengembangannya.

Pemetaan video ke pop-up berada di `lib/pageGuideRecordings.ts`. Rekaman dapat
diganti dengan file bernama sama atau melalui properti `recording` pada panduan
di `lib/pageGuides.ts`; properti tersebut mengutamakan video pengganti.

Langkah perekaman yang lebih lengkap ada di `docs/alur-rekaman-tutorial.md`.
