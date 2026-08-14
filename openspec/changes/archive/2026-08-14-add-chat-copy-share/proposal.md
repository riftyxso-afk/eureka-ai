## Why

Hasil chat asisten AI di halaman `/chat` sulit dibagikan: teksnya penuh simbol markdown (`*`, `#`, `**`, dsb.) sehingga menyalinnya menghasilkan output yang kotor, dan tidak ada cara berbagi percakapan ke orang lain. Pengguna ingin menyalin chat bersih dan membagikan percakapan melalui halaman khusus yang hanya bisa dilihat (view-only).

## What Changes

- Menambahkan tombol **copy per pesan** (bubble pesan user & asisten) yang menyalin isi pesan dalam bentuk teks bersih tanpa simbol markdown.
- Menambahkan tombol **copy seluruh percakapan** yang menyalin semua pesan (user + asisten) sebagai teks bersih, terformat rapi (label peran per pesan).
- Menambahkan tombol **share chat** di halaman `/chat` yang membuat snapshot percakapan saat itu dan menghasilkan link publik.
- Membuat **halaman share khusus** (view-only) yang bisa diakses siapa saja via link, tanpa login, menampilkan percakapan dengan format yang sama (markdown dirender, bukan teks mentah).
- Menambahkan tabel Supabase baru `ai_chat_shares` (snapshot pesan + token unik) beserta patch SQL mengikuti konvensi `supabase_patch_004_*`.
- Snapshot bersifat **fixed**: pesan yang ditambahkan setelah share tidak ikut tampil di halaman share.
- View-only: halaman share tidak punya composer, tombol edit, hapus, maupun akses ke data lain pemilik (catatan, sumber lengkap, dll).

## Capabilities

### New Capabilities
- `chat-share`: Kemampuan untuk mengekspor percakapan asisten AI — menyalin pesan individual atau seluruh percakapan dalam teks bersih (tanpa markdown), serta membagikan percakapan sebagai snapshot publik view-only via link.

### Modified Capabilities
- Tidak ada. Belum ada spec arsip di repo ini (change pertama).

## Impact

- **Frontend**:
  - `app/chat/[id]/page.tsx` — tombol copy seluruh chat & tombol share di topbar, integrasi copy per pesan.
  - `components/asisten/MessageBubble.tsx` — tombol copy per pesan.
  - `components/asisten/MarkdownView.tsx` atau helper baru di `lib/assistant/` — fungsi strip markdown menjadi teks bersih.
  - Baru: halaman view-only `app/share/[token]/page.tsx`.
- **API**:
  - Baru: `app/api/assistant/sessions/[sessionId]/share/route.ts` (POST buat share, DELETE batalkan bila masuk scope).
  - Baru: `app/api/shares/[token]/route.ts` (GET publik, tanpa auth).
- **Data**: Supabase — tabel baru `ai_chat_shares` dengan snapshot JSONB pesan, token unik, dan RLS publik (select by token) atau akses via service role di server.
- **Dependensi**: tidak ada library baru yang direncanakan; strip markdown cukup util sederhana (tidak perlu lib eksternal).
- **Keamanan**: akses publik hanya ke snapshot share, bukan ke data pemilik; token di-random keras.
