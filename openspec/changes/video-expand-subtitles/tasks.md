## 1. Fondasi transkrip (server)

- [x] 1.1 Tambah `durationMs?` ke `TranscriptSegment` di `lib/rag/extract.ts` dan isi dari `t.duration` library pada `scrapeYoutubeTranscript` (tanpa mengubah konsumen lain)
- [x] 1.2 Buat `lib/videoTranscript.ts`: `TranscriptCache` (Map + TTL 1 jam, jam injectable), helper murni `activeSegmentIndex(segments, timeMs)` (rentang `offset..offset+duration`, fallback jarak ke segmen berikutnya), dan `getVideoTranscript(url)` (dynamic import `scrapeYoutubeTranscript`, cap 2000 segmen, buang teks kosong)
- [x] 1.3 Buat `app/api/video/transcript/route.ts`: POST `{url, userId}` + Authorization → `authorizeAssistantUser`, validasi `extractYoutubeVideoId`, cache hit langsung, miss → scrape + rate limit ringan 30/jam (hanya miss); respon 200 `{title, segments}` / 400 / 401 / 422 / 429
- [x] 1.4 Mount `/api/video/transcript` di `backend/src/routes.ts` (di samping `/api/video/points`)

## 2. Sinkronisasi pemutaran & panel subtitle (client)

- [x] 2.1 Buat `components/video/useYoutubePlayer.ts`: loader singleton skrip `https://www.youtube.com/iframe_api`, bungkus iframe dengan `new YT.Player`, polling `getCurrentTime()` tiap 250 ms saat overlay terbuka (stop saat `ENDED`/unmount), expose `currentTime`, `seekTo(seconds)`, dan status API tersedia/tidak
- [x] 2.2 `YoutubeEmbed.tsx`: tambah `enablejsapi=1` ke src iframe dan prop `onIframeReady` (callback node iframe saat mount)
- [x] 2.3 Tambah `https://www.youtube.com` ke `script-src` CSP di `next.config.mjs`
- [x] 2.4 `VideoViewOverlay.tsx`: kolom kiri jadi `flex flex-col` — video di atas, panel subtitle claymorphism di bawah (fetch `POST /api/video/transcript`, highlight segmen aktif + auto-scroll `scrollIntoView({block:"nearest"})`, klik baris → `seekTo` + play, state loading/error/"Coba lagi", pesan jujur saat subtitle tak tersedia, daftar statis + catatan kecil saat IFrame API tak tersedia)

## 3. Verifikasi

- [x] 3.1 Tulis `scripts/test-video-subtitles.mjs` (node:test): `activeSegmentIndex` (awal/akhir/antara/gap/durasi 0/posisi di luar), pembersihan segmen kosong, cap segmen — jalankan dan pastikan lulus
- [x] 3.2 `openspec validate`, `tsc --noEmit`, lint (tanpa error baru di file tersentuh), `npm run build`, dan typecheck backend
- [ ] 3.3 Uji manual (butuh login + video asli): buka View → subtitle berjalan sinkron (pause/seek ikut), klik baris → video lompat, video tanpa subtitle → pesan jujur, mobile → panel menumpuk rapi
