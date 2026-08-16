## Why

Stabilo AI (highlighter otomatis) saat ini sering menstabilo terlalu banyak teks hingga tampilan catatan kacau: teks yang tidak dimaksud AI ikut tersorot (fallback pencocokan kata kunci terlalu longgar), kalimat panjang ikut kestabilo (panjang tidak dibatasi di kode), dan highlight bisa saling menimpa/beririsan. User meminta stabilo otomatis hanya menandai poin-poin penting dengan rapi.

## What Changes

- **Ketatkan pencocokan teks** (`findExactInContent`): teks hasil AI yang tidak cocok persis dengan konten bab TIDAK lagi jatuh ke fallback "kalimat berisi mayoritas kata kunci" yang bisa menandai kalimat lain. Ganti dengan pencocokan yang aman: hapus kandidat yang tidak cocok, atau cocokkan dengan normalisasi minimal (spasi/gaya) tanpa melompat ke kalimat berbeda.
- **Batasi panjang teks stabilo di kode** (bukan hanya di prompt): potong/lewati kandidat yang terlalu pendek (< 6 karakter) atau terlalu panjang (> 120 karakter) sehingga stabilo tetap berupa frasa/kalimat singkat, bukan paragraf.
- **Cegah overlap & duplikat antar-highlight**: sebelum menyimpan, buang kandidat yang menjadi bagian dari / mengandung highlight lain pada bab yang sama, dan jaga jarak antar-segmen agar stabilo tidak bertumpuk.
- **Jaga kepadatan per bab & per catatan**: batasi jumlah stabilo per bab (mis. 3) dan total per catatan (mis. 15) dengan distribusi merata, agar tidak semua teks tersorot.
- **Regenerasi idempoten**: menghapus stabilo AI lama lalu menyimpan yang baru tetap berjalan tanpa duplikat.

## Capabilities

### New Capabilities

- *(tidak ada — perbaikan logika pada fitur yang sudah ada)*

### Modified Capabilities

- `notes`: Requirement baru "Stabilo AI menandai poin penting tanpa kacau" — perilaku stabilo AI berubah (batas panjang, anti-overlap, kepadatan, pencocokan ketat).

## Impact

- `lib/ai-highlights.ts` — logika inti: prompt, parsing kandidat, `findExactInContent`, filter panjang/overlap/kepadatan, penyimpanan.
- `lib/highlights-store.ts` — (kecil) kemungkinan tambahan helper cek overlap/duplikat jika diperlukan.
- `app/api/notes/[id]/highlights/generate/route.ts` — pesan feedback jumlah stabilo yang dihasilkan.
- `app/dashboard/note/[id]/page.tsx` — teks notifikasi hasil stabilo AI (sedikit).
- Tidak ada perubahan API/DB schema — tabel `highlights` tetap sama.
