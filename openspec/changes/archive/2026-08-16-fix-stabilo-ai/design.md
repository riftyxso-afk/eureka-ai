## Context

Stabilo AI saat ini diimplementasikan di `lib/ai-highlights.ts` (generate kandidat via `aiChatJson` + simpan ke tabel `highlights` dengan `userId "ai"`), dipanggil dari `lib/notesProcessor.ts` saat pembuatan catatan dan dari endpoint `POST /api/notes/[id]/highlights/generate` (tombol "Stabilo AI" di dashboard). Lihat proposal.md — Why untuk motivasi.

Masalah teknis yang ditemukan di kode saat ini:

1. `findExactInContent` punya fallback "kalimat dengan mayoritas kata kunci" yang longgar → teks AI yang tidak cocok bisa menandai kalimat LAIN.
2. Prompt meminta 8–60 karakter, tapi kode tidak menegakkan batas; `addHighlight` memotong di 500 → kalimat/paragraf panjang ikut tersorot.
3. Tidak ada cek overlap: dua highlight bisa saling beririsan atau satu mengandung yang lain (dedupe di `addHighlight` hanya teks+chapter+color persis).
4. `MAX_PER_CHAPTER = 4` dan `MAX_TOTAL = 24` terlalu longgar untuk catatan panjang → hampir semua teks tersorot.

## Goals / Non-Goals

**Goals:**
- Stabilo hanya menandai poin penting: teks pendek (frasa/kalimat singkat) yang cocok persis dengan konten bab.
- Tidak ada sorotan di kalimat yang tidak dimaksud AI (hapus fallback kata kunci yang melompat ke kalimat lain).
- Tidak ada highlight yang saling tumpang tindih/bertumpuk di bab yang sama.
- Kepadatan wajar: jumlah stabilo per bab & per catatan dibatasi dan disebar merata.
- Regenerasi tetap idempoten (hapus lama → simpan baru, tanpa duplikat).

**Non-Goals:**
- Tidak mengubah skema DB (`highlights` tetap sama) — murni perbaikan logika + prompt.
- Tidak menambah fitur baru (mis. warna custom, stabilo manual, pengaturan jumlah oleh user).
- Tidak mengubah rendering `renderInlineText`/`splitHighlightMatches` di `lib/parseNoteContent.tsx` (rendering sudah bekerja; masalah ada di sisi pembuatan data).

## Decisions

### D1 — Hapus fallback kata kunci, pakai pencocokan persis + normalisasi ringan
`findExactInContent` diubah: hanya cocokkan teks kandidat ke konten bab setelah normalisasi spasi (collapse whitespace + lowercase). Fallback "kalimat dengan mayoritas kata kunci" DIHAPUS — kandidat yang tidak cocok diabaikan.

- Kenapa: mencegah stabilo muncul di tempat yang tidak dimaksud AI (akar "kacau").
- Alternatif dipertimbangkan: fallback per-kalimat dengan skor lebih ketat (semua kata kunci harus ada) — ditolak karena masih bisa salah posisi; prompt diperkuat agar AI menyalin teks persis.

### D2 — Enforce batas panjang di kode (bukan hanya prompt)
Setelah parsing kandidat, filter: `text.length < 6` atau `> 120` karakter → buang. Panjang disesuaikan ke teks persis hasil `findExactInContent` (bukan panjang usulan AI).

- Kenapa: kalimat panjang = mayoritas paragraf tersorot; batas kode tidak bisa diabaikan AI.
- Alternatif: potong ke 60 karakter — ditolak karena memotong kalimat di tengah menghasilkan stabilo aneh; buang lebih baik daripada potong.

### D3 — Filter overlap & duplikat per bab sebelum simpan
Urutkan kandidat per bab (yang lebih panjang dulu), lalu simpan hanya yang TIDAK terkandung dalam / TIDAK mengandung highlight yang sudah dipilih pada bab itu. Cek dilakukan pada teks ternormalisasi.

- Kenapa: mencegah sorotan bertumpuk (dua stabilo menimpa teks yang sama) yang membuat tampilan kacau.
- Implementasi: setelah `findExactInContent`, cek `chosen.some(h => h.includes(exact) || exact.includes(h))` pada bab yang sama → lewati.

### D4 — Kepadatan lebih ketat & tersebar
Turunkan `MAX_PER_CHAPTER` 4 → 3 dan `MAX_TOTAL` 24 → 15. Setelah penyimpanan, jika bab yang lebih awal sudah memenuhi kuota, kandidat bab berikutnya tetap bisa masuk sampai total tercapai (distribusi alami mengikuti urutan bab).

- Kenapa: 15–20 stabilo pendek sudah cukup menandai poin penting; lebih banyak = teks penuh sorotan.
- Alternatif: hitung kepadatan dari panjang bab (mis. 1 per 500 kata) — ditolak karena kompleks dan hasil tidak bisa diprediksi user; batas tetap lebih jelas.

### D5 — Prompt diperkuat (copy-paste persis, segmen pendek, hindari heading)
Prompt di `generateHighlightsForChapters` ditambahkan aturan: salin teks PERSIS apa adanya dari konten (jangan parafrase), segmen 6–120 karakter (biasanya 8–60), jangan menstabilo judul bab/heading, dan maksimal 3 per bab / 15 total. Ini melengkapi filter kode (D1–D4) — filter kode adalah pengaman utama, prompt mengurangi kandidat yang terbuang.

## Risks / Trade-offs

- [Kandidat AI sering tidak cocok persis (AI cenderung parafrase) → hasil stabilo lebih sedikit dari yang diharapkan] → Prompt diperkuat (D5) untuk menyalin persis + ambang 6–120 karakter cukup lebar; jumlah yang tersimpan tetap dilaporkan ke user via notifikasi.
- [Filter overlap membuang kandidat yang "menyerupai tapi bukan bagian persis" → ada poin penting yang tidak tersorot] → Trade-off yang disengaja: lebih baik kurang dari pada salah posisi/kacau (sesuai permintaan user).
- [Catatan sangat pendek menghasilkan 0 stabilo] → Sudah ada pesan "Tidak ada bagian baru yang layak distabilo" di UI; tidak berubah.
- [Kinerja: cek overlap O(n²) per bab] → n ≤ 3 per bab, trivially kecil; tidak perlu optimasi.

## Migration Plan

- Deploy frontend + backend bersama (route `highlights/generate` dipakai dashboard; `lib/ai-highlights.ts` juga dipakai `notesProcessor.ts` untuk catatan baru).
- Tidak ada perubahan DB/schema — tidak perlu migrasi data. Stabilo AI lama tetap valid; regenerasi berikutnya otomatis memakai logika baru.
- Rollback: revert commit — tabel & API tidak berubah, jadi aman.

## Open Questions

- Tidak ada — keputusan (batas panjang, jumlah, strategi overlap) sudah mencukupi dan dapat disesuaikan nilainya di kode tanpa mengubah spec.
