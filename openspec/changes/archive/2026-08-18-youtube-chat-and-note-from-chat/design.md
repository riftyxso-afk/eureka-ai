## Context

Chat asisten (`/chat/[id]`) sudah streaming jawaban AI via SSE (`app/api/assistant/chat/route.ts`), punya pipeline tool (web search, attachment, RAG catatan, klarifikasi), dan sudah mendeteksi intent "buat catatan" (`lib/assistant/noteIntent.ts`) yang membuka `NoteProgressOverlay`. Ekstraksi transkrip YouTube sudah ada dan dipakai pipeline pembuatan catatan (`lib/rag/extract.ts` → `scrapeYoutubeTranscript`), dan catatan menyimpan `sourceUrl` + `subject: "YouTube"`. Yang belum ada: render player video di chat/note, konteks video untuk AI, dan pemakaian riwayat percakapan sebagai materi catatan. Lihat proposal.md — Why untuk motivasi, dan specs untuk kontrak perilaku.

## Goals / Non-Goals

**Goals:**
- Video YouTube aktif di sesi chat → AI menjawab dengan konteks transkrip; player dirender inline tanpa reload.
- Player video tampil di halaman catatan yang bersumber YouTube.
- "Buatkan catatan" di `/chat` memakai topik percakapan sebagai materi, tanpa mengubah alur wizard/overlay/halaman hasil.
- Tanpa perubahan skema DB.

**Non-Goals:**
- Transkripsi audio secara realtime untuk video tanpa subtitle (fallback cukup: AI jujur tidak punya transkrip).
- Q&A dengan timestamp transkrip (menit-detik) — `segments` tersedia tapi di luar scope v1.
- Embed video untuk catatan yang *bukan* dari YouTube.
- Perubahan alur `/home` (intent buat catatan dari home tetap seperti sekarang).

## Decisions

### 1. Video aktif sesi diturunkan dari riwayat pesan, bukan kolom DB

Saat user mengirim pesan berisi link YouTube, `videoUrl` dikirim di body request turn tersebut agar server langsung mengekstrak transkrip. Untuk turn-turn berikutnya, server memindai pesan user terakhir (≤16 pesan) pada sesi dan mengambil link YouTube terbaru (`extractYoutubeId`) sebagai "video aktif" — sama persis dengan logika yang dipakai klien untuk render embed.

- **Alasan**: memenuhi spec "konteks video bertahan setelah reload" tanpa migrasi DB; riwayat sudah tersimpan di `ai_chat_messages`. Alternatif (kolom `video_url` di `ai_chat_sessions`) lebih eksplisit tapi butuh patch SQL + sinkronisasi.
- **Trade-off**: video "aktif" dianggap yang terbaru di riwayat; sesi dengan banyak video hanya membawa video terakhir ke konteks jawaban (spec sudah mendefinisikan perilaku ini).

### 2. Konteks video disuntikkan ke system prompt (pola yang sama dengan RAG/attachment)

Di `app/api/assistant/chat/route.ts`, setelah konteks user & RAG dibangun: bila ada video aktif, panggil `scrapeYoutubeTranscript(url)` dalam try/catch, potong teks ke ~20.000 karakter, lalu append blok `MODE "DISKUSI VIDEO"` ke system prompt (mirip `notesContext` di `/api/chat` dan `attachedDocument` di `buildSystemPrompt`). Gagal ekstraksi (video tanpa subtitle / timeout) → jangan blokir jawaban: log warn + lanjut tanpa konteks (spec: AI mengaku jujur).

- **Alasan**: konsisten dengan pola konteks yang ada; tidak menambah event SSE baru; jawaban tetap streaming seperti biasa (memenuhi "realtime").
- **Alternatif**: event `pipeline`/`video` baru untuk menampilkan "menganalisis video…" di UI — nice-to-have, ditunda agar scope kecil.

### 3. Komponen `YoutubeEmbed` click-to-play (thumbnail → iframe)

Komponen bersama (dipakai chat & note): ekstrak ID via `extractYoutubeId`, tampilkan thumbnail `https://i.ytimg.com/vi/<id>/hqdefault.jpg` + tombol play; saat diklik, ganti ke iframe `https://www.youtube-nocookie.com/embed/<id>?autoplay=1`.

- **Alasan**: tidak memuat iframe sampai user benar-benar menonton (privasi + performa), menghindari autoplay yang diblokir browser, dan memenuhi spec "player dimuat saat diklik". `youtube-nocookie.com` memenuhi spec "mode privasi".
- **Alternatif**: iframe langsung — lebih sederhana tapi berat & melanggar spec click-to-play.

### 4. Bubble pesan user merender embed dari URL di konten

`MessageBubble` (atau pembungkusnya) mendeteksi link YouTube pada `content` pesan user (regex sama dengan `detectNoteIntent`) dan merender `YoutubeEmbed` di bawah teks. Tidak ada field DB baru — URL sudah tersimpan sebagai bagian dari `content` (snapshot share & judul otomatis tidak terpengaruh).

### 5. Embed di halaman catatan lewat `sourceUrl`

`app/dashboard/note/[id]/page.tsx`: bila `data.subject === "YouTube"` dan `extractYoutubeId(data.sourceUrl)` valid → render kartu `YoutubeEmbed` di atas bab-bab (di bawah ringkasan). `NoteAIChat` tidak berubah — bab-bab sudah memuat materi dari transkrip, jadi AI sudah bisa membahas video.

### 6. Konteks percakapan untuk "buat catatan" via file sumber yang diperkaya

Di `NoteProgressOverlay`, bila prompt tidak memuat URL (jalur "dokumen"/topik) dan ada prop `history` baru (transkrip percakapan, maks ~12 pesan terakhir / ~20.000 karakter): konten `file0` diubah dari `intent.topic || prompt` menjadi `topik prompt + "\n\n=== PERCAKAPAN (materi tambahan) ===\n" + transkrip`. Pipeline `notesProcessor` yang sudah ada memperlakukan file teks sebagai materi sumber — **nol perubahan di processor**. Bila prompt memuat URL, URL tetap sumber utama (riwayat tidak dicampur).

- **Alasan**: reuse total pipeline; tanpa field FormData baru, tanpa perubahan `notesProcessor`/`parseSources`.
- **Alternatif**: field FormData `chatContext` + penanganan khusus di processor — lebih eksplisit tapi menambah surface API & logika baru.
- **Trade-off**: percakapan tercampur dalam satu file sumber, jadi judul/topik tetap berasal dari prompt (lebih tepat — topik diskusi ada di prompt "buatkan catatan tentang X"; percakapan jadi materi).

### 7. CSP `frame-src` ditambah domain YouTube

`next.config.mjs`: tambah `https://www.youtube.com` dan `https://www.youtube-nocookie.com` ke `frame-src` (ada preseden: Google Drive ditambahkan sebelumnya). Tanpa ini iframe player diblokir.

## Risks / Trade-offs

- **Ekstraksi transkrip lambat/mati di tengah stream** → bungkus try/catch dengan timeout; gagal = lanjut menjawab tanpa konteks video (jawaban tidak pernah tertahan oleh video).
- **Video tanpa subtitle** → `scrapeYoutubeTranscript` melempar error; ditangkap dan AI menjawab tanpa transkrip (spec sudah mendefinisikan perilaku jujur).
- **Transkrip sangat panjang** → potong ~20.000 karakter sebelum disuntik (pola sama dengan konteks lain); AI menjawab dari bagian yang ada.
- **Video aktif salah deteksi (link acak di pesan lama)** → hanya pesan *user* yang dipindai dan hanya URL YouTube valid; link terbaru yang menang.
- **Riwayat percakapan besar saat buat catatan** → batasi pesan terakhir & panjang karakter; file sumber tetap dalam batas wajar.
- **Iframe diblokir CSP/CORS** → `youtube-nocookie.com` di `frame-src`; embed via iframe tidak butuh CORS.
- **Rollback** → perubahan murni frontend + CSP: revert commit cukup; tidak ada migrasi DB.

## Migration Plan

1. Deploy normal (tidak ada perubahan skema DB, env, atau dependency baru — `youtube-transcript` sudah terpasang).
2. Rollback: revert perubahan `next.config.mjs` (CSP) dan halaman/komponen; konteks video dihilangkan otomatis.

## Open Questions

Tidak ada yang mengubah spec/approach/task breakdown. Detail kecil yang bisa diputus belakangan: (a) apakah perlu indikator kecil "berdiskusi tentang: <judul video>" di atas embed — bisa ditambahkan tanpa mengubah spec; (b) apakah Q&A berbasis timestamp transkrip dibutuhkan — di luar scope v1.
