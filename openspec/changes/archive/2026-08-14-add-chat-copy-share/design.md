## Context

Lihat `proposal.md` — Why. Konteks teknis yang relevan:

- Chat asisten dirender di `app/chat/[id]/page.tsx`; tiap pesan dirender `MessageBubble` (`components/asisten/MessageBubble.tsx`) dengan `MarkdownView` (react-markdown + remark-gfm + remark-math + rehype-katex).
- Riwayat chat di Supabase (`ai_chat_sessions`, `ai_chat_messages`) dengan RLS owner-only; semua akses server lewat admin/service-role client (`lib/supabase/admin` → `db()`).
- Auth server-side via `authorizeAssistantUser(header, userId)` (Bearer token Supabase dipaksa cocok dengan param userId). Route-route API asisten ada di dalam app Next.js (`app/api/assistant/**`), bukan di `backend/` (Hono).
- Konvensi repo: setiap perubahan schema Supabase jadi file patch `supabase_patch_00X_*.sql` yang dijalankan manual di dashboard.

## Goals / Non-Goals

**Goals:**
- Satu util teks-bersih yang dipakai bersama untuk copy per-pesan maupun seluruh chat (konsisten hasilnya).
- Share = snapshot: tidak ada dependensi ke sesi asli setelah dibuat (aman dari hapus/edit/mutasi sesi).
- Halaman publik di-render server-side via admin client sehingga RLS owner-only tidak menghalangi tamu, dan tidak ada data pemilik lain yang bocor.

**Non-Goals:**
- Revoke/hapus share, expiry link, atau daftar "shares saya" — bisa jadi change terpisah di kemudian hari.
- Share ke aplikasi lain (WhatsApp API, dll.) — cukup copy link.
- Menyertakan lampiran/sumber lengkap di halaman share — hanya teks percakapan + judul.

## Decisions

### D1. Ekstraksi teks bersih memakai mdast (remark), bukan regex

Strip markdown dengan mem-parsing konten lewat pipeline yang sudah ada sebagai dependency transitif react-markdown (`unified` + `remark-parse`), lalu berjalan di pohon mdast menggabungkan node teks: paragraf & heading jadi baris terpisah, list item diberi prefiks `- `/nomor, code block & inline code ambil isinya tanpa backtick, math `\(...\)`/`\[...\]` dibuang delimiter-nya tapi isinya dipertahankan.

- **Mengapa**: regex strip markdown rapuh terhadap penulisan bersarang (bold di dalam list, link, table). mdast menangani semuanya terstruktur; dependency sudah ada di node_modules sehingga tidak ada library baru yang berat.
- **Alternatif**: regex sederhana (gagal di kasus bersarang), atau `mdast-util-to-string` (terlalu datar — kehilangan pemisahan baris/list). Util sendiri (±60 baris) di `lib/assistant/plainText.ts` dengan output per-pesan berupa string teks bersih.

### D2. Tabel baru `ai_chat_shares` dengan snapshot JSONB — tanpa FK ke sesi

```
ai_chat_shares
├── id          UUID PK
├── session_id  UUID NULL          -- referensi longgar, TANPA FK (sesi boleh dihapus)
├── title       TEXT               -- judul sesi saat di-share (copy, bukan join)
├── token       TEXT UNIQUE        -- 32 hex dari randomBytes(16)
├── snapshot    JSONB              -- [{role, content}, ...] diurutkan kronologis
├── created_at  TIMESTAMPTZ
```

- **Mengapa snapshot JSONB, bukan relasi ke `ai_chat_messages`**: persyaratan "snapshot beku" dan "hapus sesi asli tidak menghapus share" hanya bisa dipenuhi jika konten disalin. Menyimpan relasi FK dengan `ON DELETE CASCADE` justru memutus share saat sesi dihapus.
- **Token unguessable**: `crypto.randomBytes(16).toString("hex")` (32 char, 128 bit entropy). Dicari via indeks unik.
- **RLS**: enable RLS dengan policy owner-only (`session_id` via join tidak dipakai — pemilik dilacak lewat kolom... *lihat catatan di bawah*). Praktiknya semua akses lewat server dengan service-role client sehingga RLS hanya lapisan belakang; tidak pernah ada akses langsung anon dari client.
- **Catatan kepemilikan**: untuk menegakkan "hanya pemilik yang bisa share" di lapisan RLS sekalipun, simpan juga `user_id` UUID di baris share (denormalisasi, tanpa FK karena tabel `users` memakai UUID sendiri). Server route tetap memverifikasi lewat `authorizeAssistantUser` — `user_id` ini murni untuk konsistensi/housekeeping.

### D3. API baru (semua di app Next.js, pola sama dengan route asisten yang ada)

```
POST /api/assistant/sessions/[sessionId]/share   → buat snapshot + token
      (auth: authorizeAssistantUser; validasi kepemilikan via getSession)
      → { token, url }

GET  /api/shares/[token]                          → publik, TANPA auth
      → { title, messages: [{role, content}] } atau 404
```

Route publik membaca via admin client (`db().from("ai_chat_shares").select(...)`), jadi RLS owner-only tidak menghalangi; 404 bila token tidak dikenal (bukan 403, agar tidak mengungkap keberadaan token).

### D4. Halaman share: server component di `app/share/[token]/page.tsx`

Komponen server memanggil `getShare(token)` dari `lib/assistant/store` (atau langsung admin client), `notFound()` bila tidak ada, lalu me-render percakapan read-only: judul, pesan user (bubble) & asisten (kartu) dalam gaya clay yang sama, `MarkdownView` untuk rendering markdown. Tanpa composer, tanpa sidebar, tanpa akses data lain.

```
app/share/[token]/page.tsx (server component, publik)
   │
   ├─ getShare(token) ──► db() service-role ──► ai_chat_shares
   └─ render: judul + pesan (MarkdownView) — view-only
```

- **Mengapa server component**: tidak ada kebutuhan interaktif; fetch server-side menghindari menyimpan admin client di client bundle dan menghindari route tambahan.
- **Alternatif**: client component + fetch ke `/api/shares/[token]` — ditolak karena butuh lapisan auth/dedup tambahan tanpa manfaat.

### D5. Clipboard & feedback UI

Helper kecil `copyText` (navigator.clipboard dengan fallback `execCommand` untuk konteks non-secure). Per-pesan: tombol ikon copy di `MessageBubble` (state "Tersalin" ±2 detik). Seluruh chat & share: tombol di topbar `/chat`; share menampilkan modal (`ShareModal`) berisi link + tombol copy.

### D6. Dependency

Tanpa dependency baru. Util mdast memakai `unified`/`remark-parse` yang sudah ada di node_modules sebagai transitive react-markdown; jika `openspec validate`/CI butuh deklarasi eksplisit, tambahkan `unified` + `remark-parse` ke `package.json` devDependencies saat implementasi.

## Risks / Trade-offs

- [Strip markdown tetap punya edge case (tabel GFM, math kompleks, HTML yang lolos markdown)] → mdast menangani struktur; tabel dirender sebagai baris teks per sel; kasus langka diterima sebagai trade-off. Tes unit untuk kasus umum: bold, heading, list, code, math.
- [Halaman share publik bisa di-scrape atau disebar ke pihak tak diinginkan] → inherent ke "siapa saja dengan link"; token 128-bit membuat tebakan mustahil. Tidak ada info user pemilik (hanya judul + pesan).
- [Snapshot JSONB tumbuh bila percakapan panjang] → pesan teks kecil (KB); tidak ada batasan eksplisit, terima.
- [Server component share melakukan satu query per kunjungan] → cukup murah untuk Supabase; bila perlu nanti ditambahkan caching (di luar scope).

## Migration Plan

1. Terapkan `supabase_patch_004_chat_share.sql` manual di Supabase dashboard (konvensi repo; sama seperti patch 001–003).
2. Deploy aplikasi (API route + halaman share) — satu deploy, tidak ada urutan dependen antara patch SQL dan kode (route share 404 sampai patch dijalankan, tapi halaman `/chat` tetap berfungsi penuh untuk fitur copy).
3. Rollback: fitur copy tanpa risiko (UI + util, tanpa state DB). Untuk share: hapus route/halaman; data `ai_chat_shares` yang sudah ada tidak mengganggu operasi lain.

## Open Questions

Tidak ada yang mengubah spec/approach saat ini. (Kandidat untuk change berikutnya: revoke share, expiry, meta OG untuk preview link.)
