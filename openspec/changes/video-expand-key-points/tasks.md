## 1. API & logika poin video (AI-only)

- [x] 1.1 Buat `lib/videoPoints.ts` (MURNI, tanpa import agar bisa diuji node:test): `parsePoints(raw, max = 8)` — strip prefix `-`/`•`/`*`/nomor, filter kosong, dedupe, cap 8; class `VideoPointsCache` (Map `videoId → { points, fetchedAt }`, TTL 1 jam, jam bisa di-inject, `get`/`set`, expired → hapus & null); singleton `videoPointsCache`; `getVideoPoints(url)` — cek cache → miss: dynamic import `scrapeYoutubeTranscript` (potong ~20.000 karakter) + `aiChat` (prompt 5–8 poin bahasa Indonesia format "- poin", maxTokens ~600, temperature 0.4) → `parsePoints` → simpan cache → `{ points, source: "ai", cached }`; transkrip tak tersedia → `{ error: "no-transcript" }` (jangan throw)
- [x] 1.2 Buat `app/api/video/points/route.ts` (POST `{ url, userId }`): validasi URL via `extractYoutubeVideoId`, `authorizeAssistantUser`, `hasAiKey`, rate limit `video-points:${userId}` 15/jam (`ensureRateLimitPrune` + `checkRateLimit`); respon `{ points, source: "ai", cached }` (200) / `{ error: "no-transcript" }` (422) / 401 / 429 / 400
- [x] 1.3 Mount `/api/video/points` di `backend/src/routes.ts` (pola mount eksplisit `/api/assistant/*`)

## 2. UI overlay expand + tombol View

- [x] 2.1 `components/video/YoutubeEmbed.tsx`: tambah prop opsional `onView?: (url: string) => void` dan `autoPlay?: boolean` (iframe langsung `?autoplay=1` saat true); tombol "View" kecil di pojok kanan atas (label + ikon, ≥44px, `aria-label`) hanya saat `onView` ada; perilaku click-to-play lama tetap
- [x] 2.2 Buat `components/video/VideoViewOverlay.tsx` — overlay full-screen (`AnimatePresence`, `fixed inset-0 z-50`, scroll halaman terkunci): grid `lg:grid-cols-2` = `YoutubeEmbed` (autoPlay) di kiri + panel poin di kanan; tombol tutup (X) & klik area luar; state loading/sukses/error; "Coba lagi" untuk error transien; label "dirangkum AI"; fetch via `apiFetch` ke `/api/video/points`; mobile stack vertikal
- [x] 2.3 `app/chat/[id]/page.tsx`: state `viewVideo: { url: string; title?: string } | null`; `MessageBubble` menerima `onViewVideo` → `YoutubeEmbed` `onView` → buka overlay; render `VideoViewOverlay`
- [x] 2.4 `app/dashboard/note/[id]/page.tsx`: `YoutubeEmbed` di kartu "Video Sumber" diberi `onView` → buka overlay dengan `title: data.title`; render `VideoViewOverlay`

## 3. Verification

- [x] 3.1 Uji unit `node:test` di `scripts/` (tanpa jaringan): `parsePoints` (format "- " / "•" / nomor, filter kosong, dedupe, cap 8, teks tanpa bullet), `VideoPointsCache` TTL (belum expired → poin sama; expired → null / generate lagi)
- [ ] 3.2 `openspec validate` (change), `npm run lint` (tanpa error baru), `npx tsc --noEmit`, `npm run build`, backend `npm run typecheck` (backend/src/routes.ts berubah)
- [ ] 3.3 Verifikasi manual (butuh login + API key AI): klik View pada embed di chat → overlay video kiri + poin kanan (generate AI); buka/tutup → poin dari cache; halaman catatan bersumber YouTube → poin generate AI dari transkrip; video tanpa subtitle → pesan jujur; mobile → panel menumpuk di bawah video
