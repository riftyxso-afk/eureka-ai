## Why

Empat masalah UX yang saling terkait: (1) nama pengguna tampil berbeda di halaman profil, dashboard, home, dan chat karena ada 3 sumber nama yang tidak sinkron (database `users.name`, cache sesi `eureka_session.name`, dan `eureka_user_name` di localStorage — yang fallback-nya bahkan hardcoded "Riftyxso"); (2) halaman pricing belum menampilkan riwayat pembelian dan status langganan padahal datanya sudah ada di `pakasir_payment_requests` dan kolom premium di `users`; (3) tidak ada mode gelap maupun fitur semat (pin) catatan; (4) puluhan emoji tersebar di UI dan data (ikon subjek/misi/onboarding) sehingga tampilan tidak konsisten dengan desain ikon lucide yang sudah dipakai.

## What Changes

- **Perbaiki konsistensi nama pengguna**: jadikan database `users.name` (via `/api/profile`) satu-satunya sumber kebenaran. `getUserName()` membaca sesi dulu, fallback-nya diganti dari "Riftyxso" menjadi "Pengguna". Simpan nama di profil → perbarui sesi lokal + metadata Supabase (server-side) sekaligus, sehingga home/chat/sidebar ikut sinkron tanpa relogin.
- **Riwayat pembelian & status langganan di `/pricing`**: tambah endpoint API baru `GET /api/payments/history` (server-side, service role) yang mengembalikan status premium terkini + daftar order dari `pakasir_payment_requests` (order_id, amount, tier, status, paid_at), lalu tampilkan kartu "Status Langganan" + daftar "Riwayat Pembelian" di halaman pricing.
- **Dark mode area login**: aktifkan `darkMode: "class"` di Tailwind, tambah provider tema (toggle di sidebar/profil + ikut preferensi sistem, disimpan di localStorage), dan terapkan varian gelap pada halaman area login (dashboard, home, chat, profil, pricing, dst.). Landing, login, dan register tetap terang.
- **Pin catatan di dashboard**: tambah kolom `pinned` di tabel `notes` (+ patch SQL + RLS), toggle pin di kartu catatan dashboard, dan urutkan catatan tersemat paling atas.
- **Ganti emoji → icon lucide**: ganti emoji dekoratif di komponen/halaman dengan icon lucide (UI), dan ganti emoji data (subjek, misi, onboarding, rekomendasi) lewat mapping emoji→icon saat render — tanpa migrasi data. Emoji di konten hasil AI (jawaban chat, isi catatan) tidak diubah karena output model.

## Capabilities

### New Capabilities

- `user-profile`: konsistensi nama tampilan pengguna di seluruh aplikasi — satu sumber kebenaran (database), sinkronisasi sesi lokal & metadata Supabase, fallback yang benar.
- `app-theme`: mode gelap untuk area login — toggle tema, persistensi preferensi, dan varian gelap pada halaman terautentikasi.
- `notes`: fitur semat (pin) catatan — kolom `pinned`, toggle di kartu dashboard, dan pengurutan catatan tersemat paling atas.
- `ui-icons`: penggantian emoji dengan icon lucide di UI dan pemetaan emoji data (subjek/misi/onboarding/rekomendasi) ke icon saat render.

### Modified Capabilities

- `pakasir-payments`: menambah requirement "Riwayat pembelian & status langganan" — halaman pricing menampilkan status langganan terkini dan daftar riwayat pembelian dari `pakasir_payment_requests`.

## Impact

- **Database**: patch SQL baru (`supabase_patch_011_pin_notes.sql`) — kolom `notes.pinned BOOLEAN DEFAULT FALSE` + indeks + kebijakan RLS (update own sudah mencakup kolom baru). Tidak ada migrasi data emoji (mapping dilakukan di kode).
- **API**: endpoint baru `app/api/payments/history/route.ts`; modifikasi `app/api/profile/route.ts` (update metadata Supabase saat nama berubah) dan `app/api/notes/route.ts` (baca/tulis `pinned`).
- **Frontend**: `lib/identity.ts`, `lib/auth.ts`, `context/` (provider tema baru), `tailwind.config.ts` (`darkMode: "class"` + varian gelap), `app/globals.css`, `app/dashboard/page.tsx`, `components/dashboard/NoteItem.tsx`, `components/layout/Sidebar.tsx`, `app/home/page.tsx`, `app/pricing/page.tsx`, `app/dashboard/profil/page.tsx`, plus banyak komponen yang mengganti emoji dengan icon lucide.
- **Dependency**: lucide-react sudah ada — tidak ada dependency baru.
- **Risiko**: dark mode mengubah tampilan seluruh area login (regresi visual) → dikerjakan bertahap per halaman dan diverifikasi build + render; pin catatan butuh patch SQL dijalankan di Supabase (tidak auto-migrate).
