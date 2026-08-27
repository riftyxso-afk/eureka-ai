# Design: Merge Home into Dashboard

## Context

- `app/home/page.tsx` (~600 baris) memuat seluruh pengalaman asisten: `useAssistantChat`, `ChatSidebar`/`MobileSessionButton` (sesi), `Composer` (lampiran + web search), `AiCallModal`, deteksi intent (`detectNoteIntent`/`detectImageIntent`) dengan overlay progres, chips fitur, `EmptyNotesCta` + `TutorialHost`, dan alur `PENDING_PROMPT_KEY`.
- `app/dashboard/page.tsx` (~535 baris) berisi greeting, statistik, grid catatan, GuideBanner.
- Login default mendarat di `/home` (`getSafeNext(defaultPath = "/home")`); sidebar sudah tidak menautkan Home; sebagian tombol internal masih mengarah ke `/home`.
- Sistem layout existing: Tailwind breakpoint standar, komponen CardClay, pola tab sudah ada di halaman Jadwal.

## Goals / Non-Goals

**Goals:**
- Satu rumah untuk asisten + aktivitas: pindahkan state & komponen asisten apa adanya (reuse, bukan rewrite).
- Layout dua kolom desktop / tab mobile yang tervalidasi tidak sempit.
- Kontrak redirect rapi: bookmark lama dan default login mendarat benar.

**Non-Goals:**
- Mengubah perilaku/logika asisten (hook, endpoint, sesi) — hanya domisili render.
- Menghapus route `/home` secara permanen (tetap ada sebagai redirect tipis).
- Redesign visual composer/kartu.

## Decisions

### D1 — Ekstraksi tanpa rewrite: jadikan isi Home komponen `AssistantHub`
Pindahkan badan `HomePage` menjadi `components/dashboard/AssistantHub.tsx` (props: tidak perlu banyak — hook self-contained). Dashboard merender `<AssistantHub/>` di kolom asisten. Logika 100% reuse → risiko regresi minimal. Alternatif (menulis ulang ringkas) ditolak karena permukaan bug besar.

### D2 — Layout: grid responsif + tab mobile
Desktop ≥1280px: CSS Grid `[minmax(420px,1fr)_minmax(380px,520px)]` — asisten kolom utama kiri, panel Aktivitas kanan sticky. 1024–1279px: satu kolom bertumpuk (asisten dulu). <1024px: dua tab ("Asisten" | "Aktivitas") ala halaman Jadwal — tiap konten dapat lebar penuh. Tinggi thread chat dibatasi `max-h` dengan scroll internal agar halaman tidak melar tak terkendali. Alternatif (semua bertumpuk di semua ukuran) ditolak: menyebabkan "sempit/melar" yang dikeluhkan user.

### D3 — Redirect `/home` via `router.replace`
`app/home/page.tsx` diganti client component tipis: `useEffect(() => router.replace("/dashboard"), [])` + render null (pertahankan metadata kosong). `getSafeNext` default → `/dashboard`. Semua `href="/home"` internal diganti `/dashboard` (grep sweep). Alternatif (next.config redirects) ditolak: campur konfigurasi deploy untuk halaman app-router sederhana.

### D4 — PENDING_PROMPT_KEY ikut pindah
Konsumsi prompt tertunda tetap di dalam `AssistantHub` (sudah bagian dari HomePage lama) — otomatis bekerja di Dashboard karena komponennya sama; cukup pastikan halaman redirect `/home` TIDAK mengonsumsi/membersihkan key tersebut sebelum hub terpasang.

## Risks / Trade-offs

- [State asisten hilang saat navigasi antar-tab mobile] → tab memakai kondisi render terkontrol yang menjaga komponen tetap mounted (CSS hidden), bukan unmount.
- [Thread chat panjang memakan viewport kolom] → max-height + scroll internal + auto-scroll existing dipertahankan.
- [Duplikasi key PENDING saat redirect] → redirect dilakukan sebelum mount apapun; hanya AssistantHub yang membaca key.
- [Bookmark lama /home kehilangan deep-state] → diterima; fitur deep-state tidak ada sebelumnya.

## Migration Plan

1. Ekstraksi AssistantHub → pasang di Dashboard dengan layout D2.
2. Ganti `/home` menjadi redirect + ubah `getSafeNext` + sweep tautan internal.
3. Verifikasi manual: kirim chat, buat catatan via intent, gambar, lampiran, sesi lama, login baru, URL /home, prompt tertunda.

## Open Questions

- Tidak ada — keputusan cukup matang untuk dieksekusi.
