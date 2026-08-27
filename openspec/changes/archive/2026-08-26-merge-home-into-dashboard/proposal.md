# Proposal: Merge Home into Dashboard

## Why

Setelah pemangkasan sidebar, "Home" tidak lagi tertaut namun masih menjadi rumah bagi seluruh pengalaman asisten AI (prompt composer, riwayat sesi chat, intent buat catatan/gambar). Akibatnya fitur inti produk tersembunyi di halaman yatim, sementara Dashboard — pusat aktivitas harian siswa — tidak punya akses langsung ke asisten. Pengguna meminta semua kemampuan Home dipindahkan ke Dashboard, halaman tidak menjadi sempit, dan prompt composer hidup di Dashboard (bukan di Home lagi).

## What Changes

- **Dashboard menjadi hub tunggal**: seluruh kemampuan halaman `/home` dipindahkan ke `/dashboard` — greeting, prompt composer AI (lampiran catatan, web search), riwayat sesi chat (ChatSidebar/mobile trigger), intent buat catatan & gambar (overlay progres), AiCallModal, chips fitur, EmptyNotesCta/TutorialHost.
- **Layout lapang, tidak sempit**: desktop lebar memakai layout dua kolom (kolom asisten + kolom aktivitas catatan); layang menengah menyusun ulang; mobile memakai tab/panel agar tiap elemen mendapat ruang penuh — tanpa konten tergencet.
- **Prompt composer berpindah domisili**: composer utama dirender di Dashboard; halaman `/home` berhenti menjadi tempat tinggal composer.
- **Redirect & titik masuk**: `/home` dialihkan ke `/dashboard`; default setelah login (`getSafeNext`) menjadi `/dashboard`; alur "kirim prompt dari halaman lain" (PENDING_PROMPT_KEY) mendarat di composer Dashboard.
- Sidebar tidak berubah (Home memang sudah dihapus); tombol/tautan internal yang tadinya menuju `/home` diperbarui ke `/dashboard`.

## Capabilities

### New Capabilities
- `dashboard-hub`: Dashboard sebagai satu-satunya pusat aplikasi — menghosting asisten AI penuh (composer + sesi chat + intent) di atas ringkasan aktivitas, dengan kontrak layout responsif yang menjamin keterbacaan dan redirect dari jalur-jalur lama.

### Modified Capabilities
<!-- Tidak ada spec existing untuk /home maupun dashboard; perilaku baru ditampung sebagai capability baru. -->

## Impact

- **Kode**: `app/dashboard/page.tsx` (host baru), `app/home/page.tsx` (dijadikan redirect tipis / dihapus), `lib/auth.ts` (`getSafeNext` default), komponen `components/asisten/*` (Composer, ChatSidebar) dipakai ulang tanpa rewrite besar, tautan internal `href="/home"` → `/dashboard`, `PENDING_PROMPT_KEY` consumer.
- **Rute**: `/home` tetap ada sebagai redirect agar bookmark lama tidak mati.
- **Risiko UX**: kepadatan Dashboard naik → dimitigasi lewat kontrak layout responsif di spec (dua kolom desktop, tab mobile).
- Tidak ada perubahan database/API backend.
