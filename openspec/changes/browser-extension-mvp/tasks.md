## 1. Scaffold ekstensi

- [ ] 1.1 Buat struktur `extension/` (manifest V3, background service worker, content script, side panel HTML/JS) dengan permissions `activeTab`, `contextMenus`, `sidePanel`, `storage`, `scripting`, dan verifikasi extension ter-load tanpa error di `chrome://extensions` mode developer
- [ ] 1.2 Terapkan tema clay dari `eureka-ai-extension-design.md` (token warna, Fredoka + Plus Jakarta Sans, radius 24/18/999, focus ring coral, `prefers-reduced-motion`) pada side panel, dan verifikasi tampilan sesuai mock §5 di lebar 360–400px

## 2. Auth dan sesi

- [ ] 2.1 Implementasi sinkron sesi akun web app ke `chrome.storage.local` (login sekali, sesi persisten, minta login ulang saat token kedaluwarsa), dan verifikasi ekstensi mengenali akun tanpa login ulang setelah login di web app

## 3. Highlight-to-Tanya

- [ ] 3.1 Implementasi context menu "Tanya Eureka" (muncul hanya saat ada teks terseleksi) yang membuka side panel dengan teks terpilih sebagai konteks, dan verifikasi di artikel umum, LMS umum, dan PDF viewer browser
- [ ] 3.2 Sambungkan pesan pertama ke endpoint chat backend agar Eureka merespons dengan pertanyaan pemandu Socratic yang merujuk teks terpilih, dan verifikasi respons pertama berupa pertanyaan, bukan jawaban langsung

## 4. Side panel persisten

- [ ] 4.1 Implementasi side panel via Chrome Side Panel API yang mempertahankan sesi saat pindah tab dalam window yang sama, dan verifikasi percakapan tidak hilang setelah 3x pindah tab

## 5. Tab-to-Note dan sinkron

- [ ] 5.1 Implementasi ekstraksi tab aktif (judul, URL, konten relevan, readability-style, hanya atas aksi eksplisit) menjadi draft yang bisa diedit, dan verifikasi draft muncul untuk artikel standar serta pesan jelas untuk halaman tanpa konten
- [ ] 5.2 Implementasi Smart Summarize (ringkasan + minimal satu pertanyaan reflektif, bukan copy mentah) lewat endpoint backend yang sudah ada, dan verifikasi draft berisi ringkasan plus pertanyaan reflektif
- [ ] 5.3 Implementasi simpan + sinkron ke dashboard (tambah endpoint `notes-from-extension` hanya bila payload URL/domain/snippet terbukti tidak muat), auto-tagging domain, dan verifikasi catatan muncul di dashboard dalam <5 detik

## 6. Streak badge

- [ ] 6.1 Implementasi badge streak harian pada icon toolbar (angka + animasi pop sekali saat berubah, netral saat belum login), dan verifikasi angka sesuai streak akun yang login

## 7. Verifikasi rilis

- [ ] 7.1 Uji DoD MVP §10 PRD end-to-end (3 jenis situs, panel persisten, ekstrak+ringkas, sinkron <5 detik, sesi persisten) dan catat hasil tiap kriteria lolos/gagal
- [ ] 7.2 Siapkan berkas review Chrome Web Store (privacy policy, justifikasi tiap permission, tanpa tracking pasif) dan verifikasi tidak ada ekstraksi konten tanpa aksi eksplisit via audit kode
