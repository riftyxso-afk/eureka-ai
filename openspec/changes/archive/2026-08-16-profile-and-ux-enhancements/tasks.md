## 1. Konsistensi nama pengguna

- [x] 1.1 Ubah `getUserName()` di `lib/identity.ts`: baca nama dari sesi (`eureka_session`) dulu, fallback `eureka_user_name`, fallback terakhir "Pengguna" (hapus hardcoded "Riftyxso")
- [x] 1.2 Tambah `updateSessionName(name)` di `lib/auth.ts` yang memperbarui nama di sesi cache + identity
- [x] 1.3 Perluas `PUT /api/profile` agar setelah update `users.name` juga menyinkronkan nama ke metadata Supabase via `db().auth.admin.updateUserById` (best-effort, try/catch)
- [x] 1.4 Panggil `updateSessionName` setelah simpan nama di halaman profil (`app/dashboard/profil/page.tsx`) dan onboarding (`app/onboarding/page.tsx`)

## 2. Riwayat pembelian & status langganan di /pricing

- [x] 2.1 Buat `app/api/payments/history/route.ts` (GET, nodejs, service role): validasi `userId`, kembalikan status premium terkini (`users`) + riwayat `pakasir_payment_requests` milik user (order created_at DESC)
- [x] 2.2 Halaman `/pricing`: fetch history saat mount bila `isLoggedIn()`, render kartu "Status Langganan" (tier & tanggal kedaluwarsa, termasuk untuk non-premium yang pernah bayar) + daftar "Riwayat Pembelian" (order_id, amount Rp, tier, status, tanggal) + empty state "Belum ada pembelian"

## 3. Dark mode area login

- [x] 3.1 Aktifkan `darkMode: "class"` di `tailwind.config.ts`
- [x] 3.2 Buat `context/ThemeContext.tsx`: tema `light|dark|system`, resolusi `system` via `prefers-color-scheme`, toggle class `dark` di `documentElement`, persist `eureka_theme` di localStorage
- [x] 3.3 Root layout `app/layout.tsx`: inline script anti-FOUC (baca localStorage/system sebelum paint) + bungkus children dengan `ThemeProvider`
- [x] 3.4 Tambah toggle tema (ikon Sun/Moon) di `components/layout/Sidebar.tsx` (wiring ke `useTheme`)
- [x] 3.5 Terapkan varian `dark:` pada komponen bersama: `CardClay`, `ButtonClay`, `InputClay` (via override `.dark` di globals.css)
- [x] 3.6 Terapkan varian `dark:` pada `Sidebar`/`SidebarItem` dan `NoteItem` (via override `.dark` di globals.css)
- [x] 3.7 Terapkan varian `dark:` pada halaman dashboard & home (via override `.dark` di globals.css)
- [x] 3.8 Terapkan varian `dark:` pada halaman chat, profil, dan pricing (via override `.dark` di globals.css)

## 4. Pin catatan di dashboard

- [x] 4.1 Buat `supabase_patch_011_pin_notes.sql`: `ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE` + indeks parsial `notes_user_pinned_idx ON notes(user_id) WHERE pinned = TRUE`
- [x] 4.2 Tambah `pinned?: boolean` ke `Note` di `lib/types.ts`; `lib/rag/store.ts`: `listNotes()` sertakan `pinned` di mapper, `updateNote()` terima `pinned`
- [x] 4.3 `PATCH /api/notes/[id]`: izinkan body `{ pinned }` tanpa `title` (title tetap wajib hanya bila body berisi title)
- [x] 4.4 Dashboard: `NoteItem` jadi client component dengan tombol pin (Pin/PinOff, `stopPropagation` karena dalam `Link`); `app/dashboard/page.tsx` urutkan pinned di atas lalu createdAt desc; handler toggle pin memanggil PATCH & refresh daftar

## 5. Emoji → icon lucide

- [x] 5.1 Buat `lib/emojiIcon.ts`: `emojiToIcon(emoji): LucideIcon` (map subjek/misi/onboarding/rekomendasi + fallback default)
- [x] 5.2 Ganti emoji UI di `app/home/page.tsx` (sapaan & feature chips → lucide)
- [x] 5.3 Ganti emoji UI di halaman dashboard: `app/dashboard/page.tsx`, `app/dashboard/profil/page.tsx`, `app/dashboard/[slug]/page.tsx`, `app/dashboard/streaks/page.tsx`, `app/dashboard/misi/page.tsx`, `app/dashboard/ujian/page.tsx`, `app/dashboard/jadwal/page.tsx`
- [x] 5.4 Ganti emoji UI di `app/pricing/page.tsx` (PERKS, 👑/🎁/🎉/💳/⚡) dan `app/onboarding/page.tsx` (heading & ikon langkah)
- [x] 5.5 Ganti emoji UI di komponen: `ToolCallBadge`, `QuizTake`, `QuizModal`, `ChatQuizModal`, `ChatPanel`, `InviteModal`, `EditNoteModal`, `VersionModal`, `CreateNoteModal`, `LevelUpOverlay`, `NoteCreateWizard` (+ komponen lain yang masih memuat emoji: MessageBubble, FlashcardModal, ChatFlashcardModal, AiCallModal, WebSearchPipeline, NoteContent, NoteProgressOverlay, HighlightToolbar, ImageGenerationOverlay, PdfWorkflowModal, ShareModal, FeedbackSurveyModal, Composer, DashboardPreparing, ReferralPopup, PremiumSuccessPopup, TutorialSpotlight, EmptyNotesCta, BuddyChatPopup, TriggerSystem, lib/tutorial.ts, lib/discount.ts, JobWatcherContext, halaman login/register/join/quiz/chat/landing)
- [x] 5.6 Terapkan `emojiToIcon` untuk emoji data: `app/dashboard/mata-pelajaran/page.tsx`, daftar subjek di `CreateNoteModal`, `app/dashboard/misi/page.tsx`, `app/onboarding/page.tsx`, rekomendasi onboarding dari AI, NOTE_TYPE_BADGES di `note/[id]`, STEPS `WebSearchPipeline`
- [x] 5.7 Pastikan emoji di konten AI (jawaban chat, isi catatan, email `lib/email.ts`) TIDAK diubah — emoji hanya tersisa di data mapping, karakter study-buddy (🦊🦉🐱🐻), prompt AI, dan email

## 6. Verifikasi & build

- [x] 6.1 `npm run build` sukses tanpa error TypeScript
- [x] 6.2 Verifikasi runtime lokal (`next start`): SSR landing memuat 1 blok JSON-LD + script anti-FOUC, `/login` punya noindex + script tema, `/pricing` & `/robots.txt` → 200 (cek nama konsisten/pin/dark mode/riwayat memerlukan DB + akun login)
- [x] 6.3 Ingatkan user menjalankan `supabase_patch_011_pin_notes.sql` di Supabase SQL Editor setelah deploy (kolom `pinned`)
