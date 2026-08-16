## 1. Perketat pencocokan & batas panjang di lib/ai-highlights.ts

- [x] 1.1 Ubah `findExactInContent`: hapus fallback "kalimat dengan mayoritas kata kunci", hanya cocokkan teks ternormalisasi (collapse whitespace + lowercase) ke konten bab
- [x] 1.2 Tambah filter panjang di kode: buang kandidat dengan teks hasil pencocokan < 6 atau > 120 karakter
- [x] 1.3 Terapkan panjang final dari teks persis hasil pencocokan (bukan panjang usulan AI) sebelum disimpan

## 2. Cegah overlap & jaga kepadatan

- [x] 2.1 Urutkan kandidat per bab (yang lebih panjang dulu) lalu buang yang saling mengandung/terkandung dengan highlight yang sudah dipilih pada bab yang sama
- [x] 2.2 Turunkan `MAX_PER_CHAPTER` 4 → 3 dan `MAX_TOTAL` 24 → 15
- [x] 2.3 Pastikan urutan penyimpanan menghasilkan distribusi merata antar-bab (bab yang kuotanya penuh dilewati, sisanya tetap diproses sampai total tercapai)

## 3. Perkuat prompt AI

- [x] 3.1 Tambah aturan prompt: salin teks PERSIS dari konten (jangan parafrase), segmen 6–120 karakter (idealnya 8–60), jangan menstabilo judul bab/heading, maksimal 3 per bab & 15 total

## 4. Verifikasi & feedback UI

- [x] 4.1 Jalankan `npm run build` dan pastikan kompilasi sukses
- [x] 4.2 Uji `generateHighlightsForChapters` pada catatan contoh: pastikan stabilo hanya di poin penting, tidak ada overlap, dan jumlah total ≤ 15
- [x] 4.3 Pastikan regenerasi stabilo AI (hapus lama → simpan baru) tidak menghasilkan duplikat
- [x] 4.4 Cek pesan notifikasi di `app/dashboard/note/[id]/page.tsx` tetap akurat dengan jumlah baru
