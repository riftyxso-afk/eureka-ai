## Purpose

Menggantikan seluruh integrasi payment gateway Mayar.id dengan DOKU Checkout: membuat checkout pembayaran, menerima & memverifikasi HTTP Notification DOKU, mengaktifkan premium 30 hari per pembayaran sukses (one-time, tanpa lisensi), dan menghapus semua jejak Mayar dari kode, env, database, dan UI.

## ADDED Requirements

### Requirement: Membuat checkout langganan DOKU

Sistem SHALL menyediakan endpoint bagi user terautentikasi untuk membuat transaksi pembayaran ke DOKU Checkout API (`POST /checkout/v1/payment`) dengan amount sesuai tier (promo Rp 5.000 atau normal Rp 59.000) dan `invoice_number` unik per transaksi, lalu SHALL mengembalikan URL halaman checkout DOKU (`response.payment.url`) untuk di-redirect user.

#### Scenario: User memilih tier normal
- **WHEN** user terautentikasi meminta checkout dengan tier `normal`
- **THEN** sistem memanggil DOKU Checkout dengan amount Rp 59.000, `invoice_number` unik, data customer (nama, email), `callback_url` aplikasi, lalu mengembalikan link checkout DOKU

#### Scenario: User memilih tier promo
- **WHEN** user terautentikasi meminta checkout dengan tier `promo`
- **THEN** sistem memanggil DOKU Checkout dengan amount Rp 5.000 dan mengembalikan link checkout DOKU

#### Scenario: Tier tidak valid
- **WHEN** user meminta checkout dengan tier yang tidak dikenal atau kosong
- **THEN** sistem menolak dengan 400 dan pesan error, tanpa memanggil DOKU

#### Scenario: DOKU menolak pembuatan transaksi
- **WHEN** API DOKU mengembalikan error saat membuat transaksi (signature salah, amount invalid, dsb.)
- **THEN** sistem mengembalikan error 502 kepada user tanpa mengubah status premium

### Requirement: Menerima HTTP Notification DOKU

Sistem SHALL menyediakan endpoint publik yang menerima HTTP Notification dari DOKU (JSON, method POST) yang dikirim setelah customer menyelesaikan pembayaran, dan SHALL mengaktifkan premium user selama 30 hari ketika notifikasi menyatakan transaksi `SUCCESS`. Pencocokan user didasarkan pada `invoice_number` (dicatat saat checkout di `doku_payment_requests`, yang juga membawa tier & amount final termasuk harga diskon), dengan fallback pencocokan email case-insensitive.

#### Scenario: Pembayaran sukses
- **WHEN** DOKU mengirim notifikasi dengan status transaksi sukses dan `invoice_number` yang tercatat di `doku_payment_requests` dengan amount konsisten
- **THEN** sistem mengaktifkan premium user pemilik invoice tersebut hingga now + 30 hari dengan tier yang tercatat, menyimpan notifikasi, dan menandai payment request lunas

#### Scenario: Transaksi gagal atau pending
- **WHEN** DOKU mengirim notifikasi dengan status selain sukses (pending/gagal/refund/batal)
- **THEN** sistem tidak mengubah status premium dan membalas 200 tanpa aktivasi

#### Scenario: Notifikasi tanpa invoice yang cocok (fallback email)
- **WHEN** notifikasi sukses tiba dengan `invoice_number` yang tidak tercatat, tetapi email customer cocok dengan user dan amount sesuai tier (Rp 5.000 / Rp 59.000)
- **THEN** sistem mengaktifkan premium user tersebut dengan tier dari amount

#### Scenario: Notifikasi tidak bisa dicocokkan sama sekali
- **WHEN** notifikasi sukses tiba dengan `invoice_number` tidak tercatat dan email customer tidak ditemukan di database user
- **THEN** sistem mencatat notifikasi sebagai gagal dicocokkan dan membalas 200 agar DOKU tidak mengulang, tanpa mengubah status user mana pun

### Requirement: Mencegah notifikasi palsu dan duplikat

Sistem SHALL memverifikasi keaslian HTTP Notification DOKU via signature HMAC-SHA256 (dibangun dari header `Client-Id`, `Request-Id`, `Request-Timestamp`, path endpoint, dan digest body dengan Secret Key DOKU) sebelum mengubah status premium (fail-closed), dan SHALL mengabaikan notifikasi duplikat agar premium tidak ter-reset berulang.

#### Scenario: Notifikasi valid
- **WHEN** notifikasi tiba dengan signature yang cocok dengan perhitungan server menggunakan Secret Key DOKU
- **THEN** sistem memproses notifikasi tersebut

#### Scenario: Signature tidak valid
- **WHEN** notifikasi tiba dengan signature yang tidak cocok atau header tidak lengkap
- **THEN** sistem menolak dengan 401 dan tidak mengubah status premium

#### Scenario: Notifikasi duplikat
- **WHEN** notifikasi untuk `invoice_number` yang sama diterima lebih dari sekali
- **THEN** sistem memproses hanya sekali dan mengabaikan duplikat (200) tanpa mengubah status premium lagi

### Requirement: Status premium dipersistensikan dan dapat dibaca

Sistem SHALL menyimpan status premium per user (aktif/tidak, tanggal kedaluwarsa, tier, referensi transaksi DOKU) di database, dan SHALL menyediakan endpoint bagi user terautentikasi untuk membaca status premium dirinya. Status premium tidak lagi bergantung pada lisensi eksternal.

#### Scenario: User premium membaca statusnya
- **WHEN** user terautentikasi meminta status premium
- **THEN** sistem mengembalikan apakah user premium, tier aktif, dan tanggal kedaluwarsa

#### Scenario: User non-premium membaca statusnya
- **WHEN** user terautentikasi tanpa langganan meminta status premium
- **THEN** sistem mengembalikan status non-premium tanpa error dan tanpa field license code

### Requirement: Gating fitur premium server-side

Sistem SHALL menegakkan batas penggunaan pada fitur AI berbiaya tinggi untuk user non-premium, dan SHALL memberikan akses tanpa batas (atau batas lebih tinggi) untuk user premium, dengan keputusan diambil server-side (bukan client-side).

#### Scenario: Free user melebihi kuota chat asisten harian
- **WHEN** user non-premium mengirim pesan ke `/api/assistant/chat` melebihi kuota hariannya
- **THEN** sistem menolak dengan 402/403 dan pesan yang menjelaskan cara upgrade, tanpa memanggil AI

#### Scenario: Free user meminta gambar AI
- **WHEN** user non-premium memanggil `/api/assistant/image`
- **THEN** sistem menolak dengan 402/403 dan pesan upgrade

#### Scenario: Premium user tidak dibatasi
- **WHEN** user premium mengakses fitur AI yang di-gate
- **THEN** sistem mengizinkan tanpa penolakan kuota

### Requirement: UI menampilkan status premium dan alur beli

Antarmuka SHALL menampilkan status premium user yang sebenarnya (dari server), menampilkan badge Pro untuk user premium, dan tombol beli/upgrade yang mengarah ke alur checkout DOKU; untuk user yang sudah premium, halaman pricing menampilkan status aktif sebagai pengganti tombol beli. Seluruh label pembayaran SHALL menyebut DOKU (bukan Mayar).

#### Scenario: User premium melihat sidebar
- **WHEN** user premium membuka aplikasi
- **THEN** sidebar menampilkan indikator/badge bahwa user berstatus Pro

#### Scenario: User memilih tier di halaman pricing
- **WHEN** user non-premium memilih salah satu tier (promo/normal) di `/pricing` atau popup kemerdekaan
- **THEN** sistem membuat checkout DOKU dan mengarahkan user ke halaman pembayaran DOKU

#### Scenario: User premium membuka halaman pricing
- **WHEN** user premium membuka `/pricing`
- **THEN** halaman menampilkan status langganan aktif (tier & tanggal kedaluwarsa) alih-alih tombol beli baru

### Requirement: Penanganan kedaluwarsa premium

Sistem SHALL menonaktifkan status premium secara otomatis ketika masa berlaku berakhir (berdasarkan `premium_until`), dan pengecekan kuota/akses SHALL menggunakan status premium terkini.

#### Scenario: Masa berlaku habis
- **WHEN** `premium_until` user sudah lewat dan tidak ada pembayaran perpanjangan baru
- **THEN** sistem memperlakukan user sebagai non-premium pada pengecekan akses berikutnya

### Requirement: Klaim trial gratis 7 hari (sekali seumur hidup)

Sistem SHALL menyediakan endpoint bagi user terautentikasi untuk mengklaim trial gratis premium selama 7 hari, maksimal SEKALI seumur hidup per user, tanpa pembayaran.

#### Scenario: User baru mengklaim trial
- **WHEN** user yang belum pernah klaim trial meminta klaim trial
- **THEN** sistem mengaktifkan premium (tier `trial`) selama 7 hari dan mencatat `trial_claimed_at`

#### Scenario: User sudah pernah klaim trial
- **WHEN** user yang `trial_claimed_at`-nya sudah terisi meminta klaim trial lagi
- **THEN** sistem menolak dengan 409 dan pesan bahwa trial sudah pernah dipakai

### Requirement: Kode diskon (persen & nominal)

Sistem SHALL menerima kode diskon opsional saat checkout, memvalidasinya terhadap tabel `discount_codes` (aktif, belum kedaluwarsa, kuota belum habis), menghitung harga final (potongan persen ATAU nominal, minimal Rp 1.000), dan mengirim amount final ke DOKU. Pemakaian kode dicatat secara atomik setelah checkout berhasil dibuat.

#### Scenario: Kode persen valid
- **WHEN** user checkout dengan kode persen yang valid (mis. 15%)
- **THEN** harga final = harga tier − 15%, dikirim ke DOKU, dan `used_count` kode bertambah 1

#### Scenario: Kode nominal valid
- **WHEN** user checkout dengan kode nominal yang valid (mis. Rp 10.000)
- **THEN** harga final = harga tier − Rp 10.000 (minimal Rp 1.000), dikirim ke DOKU, dan `used_count` bertambah

#### Scenario: Kode tidak ditemukan / tidak aktif / kedaluwarsa / habis kuota
- **WHEN** user checkout dengan kode yang tidak ditemukan, tidak aktif, kedaluwarsa, atau kuotanya habis
- **THEN** sistem menolak dengan 400 dan pesan yang jelas, tanpa membuat checkout

### Requirement: Pembatalan langganan

Sistem SHALL menyediakan endpoint bagi user premium terautentikasi untuk membatalkan langganan — menonaktifkan premium segera di database tanpa refund, tanpa panggilan API ke provider pembayaran.

#### Scenario: User premium membatalkan langganan
- **WHEN** user premium meminta pembatalan langganan
- **THEN** sistem menonaktifkan premium di database dan mengembalikan sukses

#### Scenario: User non-premium meminta pembatalan
- **WHEN** user tanpa langganan aktif meminta pembatalan
- **THEN** sistem menolak dengan 409 dan pesan bahwa user tidak punya langganan aktif

### Requirement: Penghapusan seluruh jejak Mayar.id

Sistem SHALL menghapus semua kode, konfigurasi env, kolom/tabel database, dan referensi UI yang berkaitan dengan Mayar.id — tidak ada lagi panggilan ke API Mayar, verifikasi lisensi Mayar, env `MAYAR_*`, kolom `mayar_*`, atau label "Mayar" di antarmuka.

#### Scenario: Tidak ada referensi Mayar tersisa
- **WHEN** dilakukan pencarian kata "mayar" (case-insensitive) di seluruh kode, env, dokumentasi setup, dan UI
- **THEN** tidak ditemukan referensi Mayar (kecuali catatan migrasi/arsip openspec yang disengaja)
