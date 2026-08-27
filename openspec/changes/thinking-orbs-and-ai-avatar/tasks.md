# Tasks: Thinking Orbs and AI Avatar

## 1. Dep & Fondasi

- [x] 1.1 Jalankan `npm install thinking-orbs` dan verifikasi versi terpasang di package.json + `npx tsc --noEmit` tetap bersih
- [x] 1.2 Buat `components/ui/EurekaOrb.tsx`: wrapper bertipe (`variant`: thinking/searching/working/connecting; `scale`: inline=20/avatar=64; theme auto) — verifikasi render manual satu orb di halaman sandbox/dev

## 2. Penerapan Pemetaan Loading

- [x] 2.1 Ganti indikator "berpikir" di `components/asisten/MessageBubble.tsx` (state streaming/kosong) dengan `<EurekaOrb variant="composing" scale="inline"/>`; verifikasi saat chat streaming orb tampil dan hilang bersih
- [x] 2.2 Ganti indikator tahap pencarian di `components/asisten/WebSearchPipeline.tsx` dengan variant `searching`; verifikasi saat pipeline web aktif
- [x] 2.3 Terapkan variant `working` pada proses pembuatan catatan: `components/dashboard/CreateNoteModal.tsx` (dan titik status proses catatan yang memakai teks/dots generik); verifikasi alur buat catatan
- [x] 2.4 Terapkan variant `composing` pada `NoteAIChat.tsx` & `ChapterAIChat.tsx` (loading jawaban AI catatan) dan variant `connecting` pada `ChatSkeleton.tsx` (muat sesi); verifikasi masing-masing permukaan

## 3. Avatar Blob AI

- [x] 3.1 Port SVG blob ke `components/asisten/EurekaBlobAvatar.tsx` (props `size`, default 32): pindahkan keyframes mata ke `app/globals.css` dengan nama berprefiks `eureka-blob-*`, hapus tag `<style>` internal, tambahkan blok reduced-motion yang membekukan mata; verifikasi dua instance sekaligus tidak bentrok
- [x] 3.2 Ganti `<img src="/logo.png">` pada cabang respons asisten `MessageBubble.tsx:167-172` dengan `<EurekaBlobAvatar/>`; verifikasi avatar tampil di setiap respons, ukuran ±32px, tanpa layout shift

## 4. Verifikasi Akhir

- [ ] 4.1 Uji visual lintas tema (terang/gelap toggle) untuk semua titik orb + avatar; uji `prefers-reduced-motion` (devtools emulation) → orb statis & mata avatar beku; jalankan `npm run lint` dan `npm run build` sampai bersih
