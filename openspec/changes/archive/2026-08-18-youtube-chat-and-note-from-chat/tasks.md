## 1. Fondasi: komponen & util video

- [x] 1.1 Buat `components/video/YoutubeEmbed.tsx` — click-to-play: thumbnail `https://i.ytimg.com/vi/<id>/hqdefault.jpg` + tombol play; saat diklik ganti ke iframe `https://www.youtube-nocookie.com/embed/<id>?autoplay=1`; pakai `extractYoutubeId` dari `lib/rag/extract.ts`; styling clay, tombol aksesibel (≥44px), `aria-label`; ID video invalid → render null
- [x] 1.2 Buat util deteksi link YouTube pertama dari teks pesan (mis. `lib/assistant/videoUrl.ts`): regex untuk youtube.com/watch, youtu.be, shorts, embed → `{ url, videoId } | null`; dipakai klien (render embed) & server (video aktif)

## 2. Konteks video untuk AI di chat

- [x] 2.1 `lib/assistant/types.ts`: tambah field opsional `videoUrl?: string | null` pada `ChatToolOptions` (dan `AssistantChatMessage` untuk pesan optimis user)
- [x] 2.2 `lib/assistant-stream.ts`: tambah `videoUrl?: string | null` ke `AssistantChatInput` dan sertakan di `buildAssistantChatBody`
- [x] 2.3 `app/api/assistant/chat/route.ts`: baca `videoUrl` dari body; tentukan video aktif = `videoUrl` turn ini ATAU link YouTube terbaru di pesan user riwayat (≤16 pesan terakhir); ekstrak transkrip via `scrapeYoutubeTranscript` dalam try/catch (gagal → log warn + lanjut tanpa konteks), potong ~20.000 karakter, append blok `MODE "DISKUSI VIDEO"` ke system prompt; tidak ada event SSE baru
- [x] 2.4 `lib/assistant/useAssistantChat.ts` + `app/chat/[id]/page.tsx`: saat `handleSend`, deteksi link YouTube pada `input.question` via util 1.2 → set `videoUrl` di input & di pesan optimis user
- [x] 2.5 `components/asisten/MessageBubble.tsx`: pesan user yang memuat link YouTube merender `YoutubeEmbed` di bawah teks (dari field `videoUrl` / deteksi ulang dari content)

## 3. Embed video di halaman catatan

- [x] 3.1 `app/dashboard/note/[id]/page.tsx`: bila `data.subject === "YouTube"` dan `extractYoutubeId(data.sourceUrl)` valid → render kartu `YoutubeEmbed` di bawah ringkasan, di atas daftar bab
- [x] 3.2 `next.config.mjs`: tambah `https://www.youtube.com` dan `https://www.youtube-nocookie.com` ke CSP `frame-src`

## 4. Catatan dari topik chat

- [x] 4.1 `components/note/NoteProgressOverlay.tsx`: tambah prop opsional `history?: { role: string; content: string }[]`; saat prompt TANPA URL, konten `file0` = `intent.topic || prompt` + `\n\n=== PERCAKAPAN (materi tambahan) ===\n` + transkrip (maks ~12 pesan terakhir / ~20.000 karakter); saat prompt ber-URL → URL tetap sumber utama, history diabaikan (perilaku lama)
- [x] 4.2 `app/chat/[id]/page.tsx`: saat intent catatan terdeteksi, bangun `history` dari `chat.renderedMessages` (role user/assistant, 12 terakhir) dan teruskan ke `NoteProgressOverlay` (lewat state wizard yang sudah ada)

## 5. Verification

- [x] 5.1 Uji unit `node:test` di `scripts/` (tanpa jaringan): deteksi link YouTube berbagai format (watch/youtu.be/shorts/embed + non-YouTube), pemilihan video aktif terbaru dari daftar pesan user, pembatasan transkrip percakapan di builder file sumber
- [ ] 5.2 `openspec validate` (change), `npm run lint`, `npx tsc --noEmit`, `npm run build`; verifikasi manual: kirim link YouTube di chat → embed muncul & AI menjawab dari transkrip; buka catatan bersumber YouTube → player tampil; diskusi panjang lalu "buatkan catatan" → catatan sesuai topik chat
