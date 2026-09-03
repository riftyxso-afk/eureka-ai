## Why

Siswa belajar tersebar di banyak platform (LMS, video, PDF, artikel) dan harus copy-paste manual ke web app Eureka.AI — friksi ini menurunkan konsistensi pakai dan membuka godaan beralih ke AI "jawaban instan" tepat di titik keputusan. Ekstensi browser Manifest V3 menghadirkan Eureka di mana pun siswa belajar, tanpa pindah tab.

## What Changes

- **Highlight-to-Tanya**: select teks di halaman apa pun → klik kanan → "Tanya Eureka" → side panel muncul dengan pertanyaan pemandu Socratic (bukan jawaban langsung).
- **Side Panel Persistent Chat**: panel chat menempel di browser (Chrome Side Panel API), sesi tetap ada saat pindah tab dalam window yang sama.
- **Tab-to-Note**: ekstrak judul, URL, dan konten relevan dari tab aktif (readability-style parsing) → jadi draft catatan yang bisa diedit/dikonfirmasi.
- **Smart Summarize**: draft catatan diringkas + disisipi pertanyaan reflektif Socratic, bukan copy mentah.
- **Sinkron Catatan ke Web App**: catatan dari ekstensi tersimpan ke akun Eureka.AI dan muncul di dashboard dalam <5 detik, reuse endpoint chat & notes backend yang sudah ada.
- **Auto-tagging Domain**: tag otomatis berdasarkan domain/topik halaman (mis. Ruangguru → Matematika).
- **Daily Streak Badge**: badge counter streak harian di icon toolbar.
- Cakupan ini adalah MVP Fase 1 PRD (fitur 1–7); Fase 2/3 (Homework Detector, OCR, Voice, dsb.) eksplisit di luar scope.

## Capabilities

### New Capabilities

- `extension-highlight-ask`: Select teks → context menu "Tanya Eureka" → side panel terbuka dengan dialog Socratic berbasis teks terpilih.
- `extension-side-panel`: Side panel chat persisten (Chrome Side Panel API) dengan sesi yang bertahan saat pindah tab dan sinkron sesi dengan akun web app.
- `extension-tab-note`: Ekstraksi konten tab aktif → draft catatan (ringkasan + pertanyaan reflektif) → simpan & sinkron ke dashboard dengan tag domain/topik otomatis.
- `extension-streak-badge`: Badge streak harian pada icon toolbar ekstensi.

### Modified Capabilities

- (none) — perilaku web app yang ada (chat, notes, dashboard) tidak berubah; ekstensi hanya menjadi klien baru dari endpoint yang sudah ada.

## Impact

- **Code baru**: direktori `extension/` terpisah (manifest V3, background service worker, content script ekstraksi, side panel UI mengikuti `eureka-ai-extension-design.md` — claymorphism, Fredoka + Plus Jakarta Sans, tombol 2 aksi Tanya/Catat).
- **Backend**: reuse endpoint chat & notes yang sudah ada; tambah satu endpoint `notes-from-extension` bila payload (URL, domain, snippet) butuh bentuk berbeda.
- **Auth**: sinkron sesi akun web app ke `chrome.storage.local` (login sekali, sesi persisten).
- **Permissions**: `activeTab`, `contextMenus`, `sidePanel`, `storage`, `scripting` — ekstraksi hanya pada tab aktif atas aksi eksplisit user (syarat review Chrome Web Store).
- **Di luar scope**: fitur Fase 2/3 PRD, Firefox, OCR, voice mode, on-device grading.
