## 1. Backend Session Exchange

- [x] 1.1 Buat endpoint `/api/auth/session-exchange` di backend yang menerima POST `{ sessionToken }` dari Supabase, memvalidasi token, dan mengembalikan `{ userId, token, expiresAt }` untuk extension. Verifikasi: `curl -X POST localhost:3001/api/auth/session-exchange -H 'Content-Type: application/json' -d '{"sessionToken":"..."}'` mengembalikan JSON valid
- [x] 1.2 Tambahkan rate limiting (max 10 requests per minute per IP) pada endpoint session-exchange. Verifikasi: request ke-11 dalam semenit mengembalikan 429
- [x] 1.3 Tambahkan validasi origin header — hanya terima dari `chrome-extension://` origins. Verifikasi: request tanpa Origin atauOrigin salah mengembalikan 403

## 2. Extension Session Sync

- [x] 2.1 Implementasi fungsi `tryAutoLogin()` di sidepanel.js yang membuka popup ke website untuk ambil session token. Verifikasi: jika user sudah login di website, popup tertutup otomatis dan session tersimpan di `chrome.storage.local`
- [x] 2.2 Implementasi fallback ke OTP manual jika session sync gagal. Verifikasi: jika website tidak login, form OTP ditampilkan
- [x] 2.3 Implementasi session refresh — cek expired token setiap kali extension dibuka. Verifikasi: session expired otomatis trigger re-login

## 3. UI Loading States

- [x] 3.1 Tambahkan CSS skeleton placeholder untuk chat messages dan draft area. Verifikasi: skeleton muncul saat loading dan menghilang saat konten muncul
- [x] 3.2 Implementasi view transition animation (fade-in 200ms untuk login→chat, slide-up 250ms untuk chat→draft). Verifikasi: transisi terlihat halus tanpa flicker
- [x] 3.3 Tambahkan empty state yang informatif untuk chat kosong dan draft kosong. Verifikasi: empty state menampilkan saran pertanyaan dan cara penggunaan

## 4. Typing Indicator

- [x] 4.1 Buat CSS animation untuk typing indicator (tiga titik bergerak). Verifikasi: animasi berjalan smooth di Chrome
- [x] 4.2 Tampilkan typing indicator saat menunggu respons AI, sembunyikan saat respons lengkap. Verifikasi: indicator muncul tepat setelah user kirim pesan dan hilang saat AI selesai

## 5. Keyboard Shortcuts

- [x] 5.1 Implementasi Ctrl+Enter untuk kirim pesan di chat input. Verifikasi: tekan Ctrl+Enter → pesan terkirim
- [x] 5.2 Implementasi Escape untuk close draft. Verifikasi: tekan Escape → draft tertutup
- [x] 5.3 Tambahkan tooltip pada input yang menunjukkan shortcut tersedia. Verifikasi: hover tooltip muncul dengan info shortcut

## 6. Notification Badge

- [x] 6.1 Implementasi badge notifikasi hijau sementara saat catatan berhasil disimpan. Verifikasi: badge muncul 3 detik lalu menghilang
- [x] 6.2 Implementasi badge error merah saat operasi gagal. Verifikasi: badge muncul sampai user dismiss

## 7. Integration Testing

- [x] 7.1 Uji end-to-end: login via website → buka ekstensi → otomatis login → kirim pesan → dapat respons → simpan catatan. Verifikasi: semua langkah berhasil tanpa error
- [x] 7.2 Uji fallback: buka ekstensi tanpa session website → form OTP muncul → login manual → fungsi normal. Verifikasi: login manual tetap jalan
- [x] 7.3 Uji keyboard shortcuts dan typing indicator dalam semua skenario. Verifikasi: semua shortcut dan animasi berfungsi
