# Tasks: Merge Home into Dashboard

## 1. Ekstraksi Asisten

- [x] 1.1 Pindahkan badan `app/home/page.tsx` menjadi `components/dashboard/AssistantHub.tsx` (reuse hook `useAssistantChat`, ChatSidebar, Composer, AiCallModal, overlay intent, chips, EmptyNotesCta, TutorialHost, konsumsi PENDING_PROMPT_KEY) dan pastikan `npx tsc --noEmit` bersih
- [x] 1.2 Rapikan prop/dependency: hapus impor yang hanya relevan untuk routing halaman lama, pertahankan perilaku identik; verifikasi dengan mengirim satu prompt chat di dev

## 2. Layout Dashboard Hub

- [x] 2.1 Susun `app/dashboard/page.tsx`: grid responsif — ≥1280px dua kolom (AssistantHub + panel Aktivitas sticky), 1024–1279px bertumpuk, <1024px tab "Asisten"/"Aktivitas" (komponen tetap mounted via CSS hidden); terapkan max-height + scroll internal pada thread chat; verifikasi visual di 3 lebar viewport tersebut tidak ada elemen tergencet
- [x] 2.2 Pastikan GuideBanner, statistik, grid catatan, CreateNoteModal tetap berfungsi dalam susunan baru; verifikasi buat catatan & pin/unpin dari layout baru

## 3. Redirect & Titik Masuk

- [x] 3.1 Ganti `app/home/page.tsx` menjadi redirect tipis ke `/dashboard` (router.replace, tanpa konsumsi PENDING_PROMPT_KEY); ubah default `getSafeNext` di `lib/auth.ts` menjadi `/dashboard`; verifikasi akses `/home` mendarat di Dashboard dan login tanpa `next` mendarat di Dashboard
- [x] 3.2 Sweep tautan internal `href="/home"` / `router.push("/home")` → `/dashboard` (grep seluruh app/components); verifikasi tidak ada sisa rujukan aktif ke /home selain redirect-nya sendiri

## 4. Verifikasi Akhir

- [ ] 4.1 Uji manual end-to-end: kirim chat dari Dashboard, lampirkan catatan, intent buat catatan & gambar, buka riwayat sesi, prompt tertunda dari halaman lain mendarat di composer Dashboard, tab mobile berpindah tanpa kehilangan state chat; jalankan `npm run lint` dan `npm run build` sampai bersih
