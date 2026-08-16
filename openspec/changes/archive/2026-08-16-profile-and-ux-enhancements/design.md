## Context

Lihat proposal.md — Why. Kondisi saat ini yang membentuk pendekatan:

- Nama pengguna hidup di 3 tempat: `public.users.name` (diubah via `/api/profile` PUT), cache sesi `eureka_session` di localStorage (dibuat `cacheSession()` saat login, di-refresh `syncAuthSession()` dari `user_metadata.name` Supabase), dan `eureka_user_name` di localStorage (`getUserName()`, fallback hardcoded `"Riftyxso"`). Halaman berbeda membaca sumber berbeda: profil & dashboard → database (via profil/onboarding context), home → sesi, sidebar/leaderboard/chat → identity.
- Pembayaran: `pakasir_payment_requests` (order_id, amount, tier, status, paid_at) + `users.is_premium/premium_until/premium_tier/trial_claimed_at/pakasir_invoice_number` sudah tersedia. RLS tabel payment requests = service_role only → butuh endpoint server-side (pola `db()` dari `lib/supabase/admin.ts`, sama seperti `/api/profile`).
- Tema: `tailwind.config.ts` tanpa `darkMode` (default `media`); palet clay statis (hex) tanpa CSS variables; sudah ada beberapa kelas `dark:` pada widget study-buddy (belum berfungsi karena tak ada `darkMode: "class"`).
- Pin: belum ada kolom `pinned`; `lib/rag/store.ts` `listNotes()` memakai `select('*')` (kolom baru otomatis ikut) tapi mapper menghilangkan field tak dikenal; `PATCH /api/notes/[id]` saat ini mewajibkan `title`.
- Emoji: tersebar di UI (halaman + komponen) dan data (`subjects.icon`, `mission-store`, `onboardingContent`, rekomendasi AI di `onboardingAnalysis.recommendations[].icon`). lucide-react sudah jadi dependency.

## Goals / Non-Goals

**Goals:**
- Satu sumber kebenaran nama tampilan (database) dengan sesi lokal & metadata Supabase ikut sinkron — tanpa relogin dan tanpa nama salah ("Riftyxso").
- Halaman `/pricing` menampilkan status langganan + riwayat pembelian dari data yang sudah ada (era Pakasir).
- Mode gelap di area login: toggle + ikut preferensi sistem, disimpan di localStorage; halaman publik tetap terang.
- Pin catatan di dashboard: kolom DB + toggle di kartu + urutan pin paling atas.
- Emoji UI & data diganti ikon lucide via mapping; konten hasil AI tidak disentuh.

**Non-Goals:**
- Dark mode untuk landing/login/register (tetap terang).
- Migrasi data emoji di database (mapping di kode, nilai DB tetap).
- Riwayat pembelian era Mayar/DOKU (data sudah di-drop saat migrasi gateway — hanya era Pakasir yang tampil).
- Merombak palet clay ke CSS variables menyeluruh (pendekatan: varian `dark:` per komponen, bukan refactor warna global).
- Mengganti emoji di template email (`lib/email.ts`) — email bukan React, lucide tidak bisa dirender di sana; emoji dipertahankan.

## Decisions

### 1. Konsistensi nama — sumber kebenaran database + sinkronisasi tiga arah

- `getUserName()` di `lib/identity.ts`: baca sesi dulu (parse `eureka_session` dari localStorage — hindari circular import dengan `lib/auth.ts`), fallback `eureka_user_name`, fallback terakhir `"Pengguna"` (hapus `"Riftyxso"`).
- `lib/auth.ts`: tambah `updateSessionName(name)` yang memperbarui nama di sesi cache + identity (dipakai halaman profil & onboarding setelah simpan).
- `/api/profile` PUT: setelah update `users.name`, panggil `db().auth.admin.updateUserById(userId, { user_metadata: { ...existing, name } })` agar `syncAuthSession()` (yang membaca `user_metadata.name`) tetap benar setelah refresh.
- Dashboard sudah membaca database (onboarding context); home membaca `session?.name || getUserName()`; sidebar/leaderboard memakai `getUserName()` — ketiganya jadi konsisten karena sesi & identity kini sinkron.
- Alternatif yang ditolak: provider React global untuk nama (overkill; perubahan terbatas, 3 titik tulis + 1 fungsi baca cukup).

### 2. Riwayat pembelian — endpoint server-side + kartu di pricing

- Route baru `app/api/payments/history/route.ts` (GET, `runtime = "nodejs"`, service role): ambil `users` (is_premium, premium_tier, premium_until, trial_claimed_at) + `pakasir_payment_requests` milik user (order created_at DESC), kembalikan `{ plan: {...}, history: [...] }`. Validasi `userId` wajib (pola sama seperti `/api/profile`).
- Halaman `/pricing`: fetch history saat mount (bila `isLoggedIn()`), render kartu "Status Langganan" (sudah ada sebagian untuk premium — perluas agar juga tampil untuk non-premium yang pernah bayar) + daftar "Riwayat Pembelian" (order_id, amount Rp, tier label, status, tanggal; state kosong "Belum ada pembelian").
- Alternatif: baca via `usePremium()` yang diperluas — ditolak karena mencampur status (ringan, sering dipanggil) dengan riwayat (berat, jarang dibuka); endpoint terpisah lebih bersih.

### 3. Dark mode — `darkMode: "class"` + provider tema di root layout

- `tailwind.config.ts`: `darkMode: "class"`.
- `context/ThemeContext.tsx` (client provider): state `"light" | "dark" | "system"`; resolusi akhir mengikuti `prefers-color-scheme` saat `"system"`; toggle class `dark` di `document.documentElement`; persist di localStorage `eureka_theme`.
- Root layout (`app/layout.tsx`): inline script kecil sebelum render (hindari FOUC) yang membaca localStorage/system dan menetapkan class; bungkus `children` dengan `ThemeProvider`.
- Halaman publik tidak punya varian `dark:` → otomatis tetap terang meski class `dark` ada di `<html>`.
- Toggle: di `components/layout/Sidebar.tsx` (ikon Sun/Moon).
- Varian `dark:` diterapkan pada komponen bersama dulu (CardClay, ButtonClay, InputClay, Sidebar/SidebarItem, NoteItem, halaman dashboard/home/chat/profil/pricing) — urutan prioritas ini membuat sebagian besar halaman langsung terbaca.
- Alternatif ditolak: refactor palet ke CSS variables di globals.css (perubahan global berisiko regresi; varian per komponen lebih bertahap dan bisa diverifikasi per halaman).

### 4. Pin catatan — kolom DB + PATCH diperluas + urutan di dashboard

- Patch SQL `supabase_patch_011_pin_notes.sql`: `ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;` + indeks parsial `notes_user_pinned_idx ON notes(user_id) WHERE pinned = TRUE`. RLS `notes update own` sudah mencakup kolom baru (tanpa policy baru).
- `lib/types.ts`: tambah `pinned?: boolean` ke `Note`; `lib/rag/store.ts`: `listNotes()` mapper sertakan `pinned`, `updateNote()` terima `pinned`; `PATCH /api/notes/[id]` izinkan body `{ pinned }` tanpa mewajibkan title (title tetap wajib hanya bila body berisi title).
- Dashboard: `NoteItem` jadi client component dengan tombol pin (Pin/PinOff, `stopPropagation` karena dibungkus `Link`); `app/dashboard/page.tsx` urutkan `pinned` dulu lalu `createdAt` desc di `filteredNotes`.

### 5. Emoji → icon lucide

- UI: ganti emoji dekoratif di halaman & komponen dengan komponen lucide (mengikuti pola yang sudah ada, mis. `StatsCard icon={...}`). Sumber referensi daftar file ada di proposal (Impact).
- Data: buat `lib/emojiIcon.ts` — `emojiToIcon(emoji): LucideIcon` dengan map (🧮→Calculator, ⚡→Zap, 🧪→FlaskConical, 🧬→Dna, 📊→BarChart3, 📜→ScrollText, 📖→BookOpen, 🎯→Target, 📚→BookOpen, 🧠→Brain, dst.) + fallback default (BookOpen). Dipakai di: `app/dashboard/mata-pelajaran/page.tsx`, `CreateNoteModal` (daftar subjek), `app/dashboard/misi/page.tsx`, `app/onboarding/page.tsx`, render rekomendasi onboarding (icon dari AI), `app/dashboard/[slug]/page.tsx`.
- Email (`lib/email.ts`) & konten AI: tidak diubah (Non-Goals).

## Risks / Trade-offs

- [Regresi visual dark mode di area login] → Terapkan bertahap per halaman (komponen bersama dulu), verifikasi render via build + cek manual tiap halaman utama; class `dark` hanya di html — halaman publik tidak terpengaruh.
- [Patch SQL pin tidak otomatis jalan] → Tugas eksplisit: jalankan `supabase_patch_011_pin_notes.sql` di Supabase SQL Editor setelah deploy; kolom `ADD COLUMN IF NOT EXISTS` idempoten & aman untuk rollback.
- [Perubahan nama via metadata Supabase bisa gagal (admin key / rate limit)] → Best-effort: update metadata dibungkus try/catch; sumber kebenaran tetap database, jadi nama tidak hilang — hanya sinkronisasi refresh yang bisa tertunda.
- [PATCH /api/notes/[id] kini menerima body tanpa title → bisa memengaruhi pemanggil lama] → Validasi title hanya bila `title` ada di body; pemanggil lama (edit judul) tidak berubah perilakunya.
- [Penggantian emoji berisiko kehilangan makna] → Pilih ikon yang bermakna sama (mis. 🎁→Gift, 👑→Crown, 🎉→PartyPopper) dan tambahkan `aria-label`/`title` bila ikon berdiri sendiri.
- [Riwayat hanya era Pakasir] → Tampilkan apa adanya; jangan klaim riwayat lama. Dinyatakan di UI sebagai "Riwayat Pembelian" tanpa implikasi kelengkapan lintas gateway.

## Migration Plan

1. Implementasi & `npm run build` + verifikasi local (`next start`).
2. Commit + push `master` → auto-deploy Vercel.
3. Jalankan `supabase_patch_011_pin_notes.sql` di Supabase Dashboard > SQL Editor (satu-satunya perubahan DB; idempoten).
4. Verifikasi live: nama konsisten di profil/dashboard/home/chat, pin muncul & tersimpan, mode gelap aktif di area login & terang di publik, riwayat tampil di `/pricing`.
5. Rollback: revert commit (frontend) — patch SQL aman dibiarkan (kolom ekstra tak dipakai) atau di-drop manual bila perlu.

## Open Questions

Tidak ada — keputusan cakupan (pin catatan, dark mode area login, emoji UI+data) sudah dikonfirmasi user.
