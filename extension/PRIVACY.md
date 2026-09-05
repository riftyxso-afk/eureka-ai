# Kebijakan Privasi — Eureka.AI Browser Extension (MVP)

**Tanggal:** 3 September 2026
**Kontak:** support@eureka-ai.web.id

## Data yang diakses (hanya atas aksi eksplisit pengguna)

| Aksi pengguna | Data yang dibaca | Tujuan |
|---|---|---|
| Klik kanan → "Tanya Eureka" pada teks terseleksi | Teks seleksi + URL halaman | Konteks dialog Socratic |
| Menekan tombol "Catat" | Judul, URL, dan teks konten tab aktif | Draft catatan |
| Login | Email + kode OTP | Autentikasi akun Eureka.AI |

Ekstensi TIDAK membaca, menyimpan, atau mengirim konten halaman di luar
dua aksi di atas. Tidak ada analytics, iklan, atau penjualan data pihak ketiga.

## Justifikasi permission (untuk review Chrome Web Store)

- `activeTab` — membaca tab aktif HANYA saat pengguna menekan "Catat".
- `contextMenus` — menampilkan "Tanya Eureka" HANYA saat ada teks terseleksi.
- `sidePanel` — menampilkan panel chat Eureka di sisi browser.
- `storage` — menyimpan sesi login, riwayat chat lokal, dan draft (perangkat lokal).
- `scripting` — menyuntik `content.js` HANYA saat pengguna menekan "Catat"
  (tanpa content script persisten, tanpa observer, tanpa background tracking).
- Host `https://eureka-ai.web.id/*` (+ `http://localhost:3000/*` untuk dev) —
  komunikasi ke backend Eureka.AI milik sendiri (chat, catatan, progres).

## Penyimpanan & keamanan

- Token sesi disimpan di `chrome.storage.local` (perangkat lokal, tidak dibagikan).
- Komunikasi backend memakai HTTPS + header `Authorization: Bearer`.
- Pengguna dapat menghapus seluruh data lokal via "Hapus data situs" atau
  uninstall extension; catatan yang sudah tersinkron dihapus lewat dashboard web app.

## Anak & sekolah

Eureka.AI ditujukan untuk siswa. Ekstensi tidak menampilkan iklan, tidak
melakukan profiling perilaku, dan tidak membagikan data belajar ke pihak ketiga.
