## Purpose

Menggantikan seluruh integrasi payment gateway DOKU dengan Pakasir (app.pakasir.com): membuat checkout langganan via hosted payment page Pakasir, menerima & memverifikasi webhook Pakasir secara fail-closed (tanpa signature — verifikasi via pencocokan order & API transactiondetail), mengaktifkan premium 30 hari per pembayaran sukses, dan menghapus semua jejak DOKU dari kode, env, database, dan UI.

## ADDED Requirements

### Requirement: Membuat checkout langganan Pakasir

Sistem SHALL menyediakan endpoint bagi user terautentikasi untuk membuat transaksi langganan dan SHALL mengembalikan URL hosted payment page Pakasir (`https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}&redirect={redirectUrl}`) untuk di-redirect user. `order_id` (nomor invoice) SHALL unik per transaksi; URL redirect SHALL netral (tidak mengklaim hasil pembayaran, mis. `?upgrade=done`).

#### Scenario: User memilih tier normal
- **WHEN** user terautentikasi meminta checkout dengan tier `normal`
- **THEN** sistem membuat URL pembayaran Pakasir dengan amount Rp 59.000 dan `order_id` unik, lalu mengembalikan link untuk di-redirect

#### Scenario: User memilih tier promo
- **WHEN** user terautentikasi meminta checkout dengan tier `promo`
- **THEN** sistem membuat URL pembayaran Pakasir dengan amount Rp 5.000 dan mengembalikan link

#### Scenario: Tier tidak valid
- **WHEN** user meminta checkout dengan tier yang tidak dikenal atau kosong
- **THEN** sistem menolak dengan 400 dan pesan error, tanpa membuat transaksi

#### Scenario: Redirect tidak mengklaim hasil
- **WHEN** sistem membangun URL checkout Pakasir
- **THEN** parameter redirect memakai URL netral (`?upgrade=done`) yang tidak menyiratkan sukses

### Requirement: Menerima webhook Pakasir

Sistem SHALL menyediakan endpoint publik yang menerima webhook Pakasir (JSON, method POST) dengan payload `{ amount, order_id, project, status, payment_method, completed_at }`, dan SHALL mengaktifkan premium user selama 30 hari ketika status `completed`. Pencocokan user didasarkan pada `order_id` yang dicatat saat checkout di `pakasir_payment_requests` (membawa tier & amount final termasuk diskon), dengan verifikasi amount konsisten.

#### Scenario: Pembayaran sukses
- **WHEN** Pakasir mengirim webhook dengan status `completed` dan `order_id` yang tercatat dengan amount konsisten
- **THEN** sistem mengaktifkan premium user pemilik order tersebut hingga now + 30 hari dengan tier yang tercatat, menyimpan notifikasi, dan menandai payment request lunas

#### Scenario: Status selain completed
- **WHEN** Pakasir mengirim webhook dengan status selain `completed` (pending/gagal/batal)
- **THEN** sistem tidak mengubah status premium dan membalas 200 tanpa aktivasi

#### Scenario: Webhook tidak bisa dicocokkan
- **WHEN** webhook tiba dengan `order_id` tidak tercatat atau amount tidak konsisten atau `project` tidak cocok
- **THEN** sistem menolak/mengabaikan tanpa mengubah status user mana pun

### Requirement: Mencegah webhook palsu dan duplikat

Karena webhook Pakasir tidak membawa signature HMAC, sistem SHALL memverifikasi keaslian secara fail-closed: mencocokkan `project` dengan slug proyek, `order_id` & `amount` dengan transaksi tercatat, dan SHALL mengonfirmasi status via API `transactiondetail` Pakasir (authoritative) sebelum mengubah status premium. Sistem SHALL mengabaikan webhook duplikat (unique `order_id` di `pakasir_notification_events`) agar premium tidak ter-reset berulang.

#### Scenario: Verifikasi authoritative sukses
- **WHEN** webhook cocok dengan transaksi tercatat dan API `transactiondetail` mengonfirmasi status `completed`
- **THEN** sistem memproses aktivasi premium

#### Scenario: transactiondetail tidak terjangkau / error
- **WHEN** API `transactiondetail` tidak dapat dipanggil atau mengembalikan error
- **THEN** sistem TIDAK mengaktifkan premium dan membalas error (5xx) agar Pakasir mengulang webhook

#### Scenario: transactiondetail status belum completed
- **WHEN** API `transactiondetail` mengembalikan status selain `completed`
- **THEN** sistem tidak mengubah status premium dan membalas 200

#### Scenario: Webhook duplikat
- **WHEN** webhook untuk `order_id` yang sama diterima lebih dari sekali
- **THEN** sistem memproses hanya sekali dan mengabaikan duplikat (200) tanpa mengubah status premium lagi

### Requirement: Status premium dipersistensikan dan dapat dibaca

Sistem SHALL menyimpan status premium per user (aktif/tidak, tanggal kedaluwarsa, tier, referensi transaksi Pakasir) di database, dan SHALL menyediakan endpoint bagi user terautentikasi untuk membaca status premium dirinya. Status premium tidak bergantung pada lisensi eksternal.

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

Antarmuka SHALL menampilkan status premium user yang sebenarnya (dari server), menampilkan badge Pro untuk user premium, dan tombol beli/upgrade yang mengarah ke alur checkout Pakasir; untuk user yang sudah premium, halaman pricing menampilkan status aktif sebagai pengganti tombol beli. Seluruh label pembayaran SHALL menyebut Pakasir (bukan DOKU).

#### Scenario: User premium melihat sidebar
- **WHEN** user premium membuka aplikasi
- **THEN** sidebar menampilkan indikator/badge bahwa user berstatus Pro

#### Scenario: User memilih tier di halaman pricing
- **WHEN** user non-premium memilih salah satu tier (promo/normal) di `/pricing` atau popup kemerdekaan
- **THEN** sistem membuat checkout Pakasir dan mengarahkan user ke halaman pembayaran Pakasir

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

Sistem SHALL menerima kode diskon opsional saat checkout, memvalidasinya terhadap tabel `discount_codes` (aktif, belum kedaluwarsa, kuota belum habis), menghitung harga final (potongan persen ATAU nominal, minimal Rp 1.000), dan mengirim amount final ke Pakasir. Pemakaian kode dicatat secara atomik setelah checkout berhasil dibuat.

#### Scenario: Kode persen valid
- **WHEN** user checkout dengan kode persen yang valid (mis. 15%)
- **THEN** harga final = harga tier − 15%, dipakai sebagai amount di URL Pakasir, dan `used_count` kode bertambah 1

#### Scenario: Kode nominal valid
- **WHEN** user checkout dengan kode nominal yang valid (mis. Rp 10.000)
- **THEN** harga final = harga tier − Rp 10.000 (minimal Rp 1.000) dan `used_count` bertambah

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

### Requirement: Penghapusan seluruh jejak DOKU

Sistem SHALL menghapus semua kode, konfigurasi env, kolom/tabel database, dan referensi UI yang berkaitan dengan DOKU — tidak ada lagi panggilan ke API DOKU, verifikasi signature DOKU, env `DOKU_*`, kolom/tabel `doku_*`, atau label "DOKU" di antarmuka.

#### Scenario: Tidak ada referensi DOKU tersisa
- **WHEN** dilakukan pencarian kata "doku" (case-insensitive) di seluruh kode, env, dokumentasi setup, dan UI
- **THEN** tidak ditemukan referensi DOKU (kecuali catatan migrasi/arsip openspec yang disengaja)
