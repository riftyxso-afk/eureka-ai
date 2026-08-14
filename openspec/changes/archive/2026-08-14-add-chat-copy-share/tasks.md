## 1. Database & Data Layer

- [x] 1.1 Buat `supabase_patch_004_chat_share.sql`: tabel `ai_chat_shares` (id UUID PK, session_id UUID NULL tanpa FK, user_id UUID NULL, title TEXT, token TEXT UNIQUE, snapshot JSONB, created_at), indeks token & user_id, RLS enable dengan policy select/insert/delete untuk pemilik (user_id = auth.uid()), mengikuti gaya patch 001–003
- [x] 1.2 Tambah fungsi `createShare(sessionId, userId, title, messages)` di `lib/assistant/store.ts`: generate token via `crypto.randomBytes(16).toString("hex")`, insert snapshot JSONB, return share record
- [x] 1.3 Tambah fungsi `getShare(token)` di `lib/assistant/store.ts`: cari baris berdasarkan token, kembalikan `{ title, messages }` atau `null`; tambah tipe `ShareRecord` di `lib/assistant/types.ts`
- [x] 1.4 Jika `unified`/`remark-parse` tidak terdeklarasi di `package.json`, tambahkan sebagai dependency (dipakai task 2.1)

## 2. Ekstraksi Teks Bersih

- [x] 2.1 Buat `lib/assistant/plainText.ts`: util `markdownToPlainText(content)` memakai unified + remark-parse (mdast) — heading/paragraf jadi baris terpisah, list ber-prefix, code block & inline code tanpa backtick, math `\(...\)`/`\[...\]` dihapus delimiter-nya, tautan jadi teks label
- [x] 2.2 Tambah unit test untuk `markdownToPlainText`: bold/italic, heading, list, code block, link, inline math — pastikan tidak ada simbol `*`/`#`/backtick tersisa di output
- [x] 2.3 Buat helper `copyText(text)` di `lib/assistant/clipboard.ts` (navigator.clipboard + fallback execCommand) dengan nilai balik sukses/gagal

## 3. UI Copy di Halaman /chat

- [x] 3.1 Tambah tombol copy per pesan di `components/asisten/MessageBubble.tsx` (ikon kecil, tampil di bubble user & asisten, feedback "Tersalin" ±2 detik) — memakai `markdownToPlainText` + `copyText`
- [x] 3.2 Tambah tombol "Salin chat" di topbar `app/chat/[id]/page.tsx` (hidden saat sesi kosong): gabungkan pesan terurut dengan label `Anda:`/`Eureka:`, tanpa metadata lain (timestamp/sumber/model), copy via `copyText` dengan feedback
- [x] 3.3 Pastikan streaming/error bubble tidak memunculkan tombol copy yang berfungsi (state `isStreaming` / konten kosong)

## 4. Backend Share

- [x] 4.1 Buat `app/api/assistant/sessions/[sessionId]/share/route.ts` (POST): `authorizeAssistantUser`, validasi kepemilikan via `getSession`, snapshot semua pesan via `getMessages`, `createShare`, kembalikan `{ token, url }`; error 401/403/404 sesuai pola route asisten lain
- [x] 4.2 Buat `app/api/shares/[token]/route.ts` (GET, publik tanpa auth): `getShare(token)`, 404 bila null (bukan 403), kembalikan `{ title, messages }`

## 5. UI Share & Halaman Publik

- [x] 5.1 Buat komponen `ShareModal` di `components/asisten/ShareModal.tsx`: panggil POST share, tampilkan link + tombol copy, state loading/error, tutup setelah selesai
- [x] 5.2 Tambah tombol share di topbar `app/chat/[id]/page.tsx` yang membuka `ShareModal`
- [x] 5.3 Buat halaman `app/share/[token]/page.tsx` (server component): `getShare(token)`, `notFound()` bila null, render judul + percakapan view-only dengan gaya clay yang sama (bubble user & `MarkdownView` untuk asisten), tanpa composer/sidebar, layout mandiri (tidak memakai layout `/chat`)

## 6. Verifikasi

- [x] 6.1 Jalankan `openspec validate` untuk change ini (pastikan artifact konsisten)
- [x] 6.2 Jalankan lint/typecheck project (`npm run lint`, `npm run build` atau perintah yang berlaku di `package.json`)
- [ ] 6.3 Uji manual per skenario di spec: copy per pesan & seluruh chat (hasil bersih), share → link publik terbuka di mode incognito (view-only, markdown ter-render), token acak → not found, pesan baru setelah share tidak muncul, hapus sesi asli → link share tetap hidup
