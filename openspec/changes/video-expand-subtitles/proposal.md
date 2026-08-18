## Why

Saat pengguna mengklik "View" pada embed video, overlay expand menampilkan video di kiri dan poin-poin isi di kanan — namun ada ruang kosong di bawah embed video yang belum terisi. Ruang itu paling berguna untuk menampilkan **subtitle video yang berjalan sinkron dengan pemutaran**, sehingga pengguna bisa mengikuti alur materi sambil menonton.

## What Changes

- **Panel subtitle di overlay View**: slot kosong di bawah embed video diisi panel subtitle bergaya claymorphism (token clay yang sudah dipakai aplikasi) — teks berjalan otomatis, segmen yang sedang diputar ditandai, dan otomatis scroll agar teks aktif selalu terlihat.
- **Sinkronisasi akurat dengan pemutaran**: integrasi YouTube IFrame API (`enablejsapi=1` + polling `getCurrentTime()`) sehingga highlight subtitle mengikuti video secara realtime — termasuk saat pause, seek, atau buffering. Klik baris subtitle → video lompat ke waktu segmen itu.
- **Endpoint transkrip baru** `POST /api/video/transcript`: mengembalikan segmen subtitle bertimestamp (`text`, `offsetMs`, `durationMs`) dari `scrapeYoutubeTranscript`, di-cache per video agar buka/tutup overlay tidak memanggil YouTube berulang. Tanpa panggilan AI — murni baca subtitle.
- **CSP**: tambah `https://www.youtube.com` ke `script-src` (skrip IFrame API dimuat dari `youtube.com/iframe_api`); `frame-src` sudah mengizinkan domain YouTube.
- **Backend proxy**: mount `/api/video/transcript` di `backend/src/routes.ts` (pola yang sama dengan `/api/video/points`).
- **Perluasan kecil `lib/rag/extract.ts`**: `TranscriptSegment` ikut membawa `durationMs` (sudah tersedia dari library `youtube-transcript`), tanpa mengubah perilaku konsumen lain.

## Capabilities

### New Capabilities
- `video-expand-subtitles`: Panel subtitle sinkron bergaya claymorphism di bawah embed video pada overlay View (chat & halaman catatan), dengan teks berjalan mengikuti pemutaran video.

### Modified Capabilities
- (kosong — tidak ada requirement lama yang berubah; change `video-expand-key-points` belum di-archive sehingga capability-nya tetap spec terpisah)

## Impact

- **Baru**: `app/api/video/transcript/route.ts`, hook `components/video/useYoutubePlayer.ts` (atau setara), `lib/videoTranscript.ts` (logika murni segmen aktif, teruji), panel subtitle di `components/video/VideoViewOverlay.tsx`.
- **Diubah**: `components/video/YoutubeEmbed.tsx` (tambah `enablejsapi=1` + callback iframe), `next.config.mjs` (CSP `script-src`), `backend/src/routes.ts` (mount route), `lib/rag/extract.ts` (field `durationMs`).
- **Tanpa perubahan**: DB, dependency baru, rate-limit AI, alur pembuatan catatan.
