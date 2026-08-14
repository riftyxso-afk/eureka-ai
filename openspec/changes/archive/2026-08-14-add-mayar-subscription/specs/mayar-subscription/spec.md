## Purpose

Menghubungkan Eureka.AI dengan payment gateway Mayar.id sehingga user bisa berlangganan akses Pro (tier Promo Rp 5.000 atau Normal Rp 59.000) melalui checkout Mayar, dengan status premium yang dipersistensikan di database, disinkronkan via webhook, dan ditegakkan server-side pada fitur AI yang dibatasi.

## ADDED Requirements

### Requirement: Membuat checkout langganan Mayar

Sistem SHALL menyediakan endpoint bagi user terautentikasi untuk membuat transaksi langganan ke Mayar dengan amount sesuai tier yang dipilih (promo Rp 5.000 atau normal Rp 59.000), dan mengembalikan URL checkout Mayar untuk di-redirect user.

#### Scenario: User memilih tier normal
- **WHEN** user terautentikasi meminta checkout dengan tier `normal`
- **THEN** sistem memanggil Mayar `payment/create` dengan amount Rp 59.000, description langganan, email user, dan `redirectUrl` aplikasi, lalu mengembalikan link checkout Mayar

#### Scenario: User memilih tier promo
- **WHEN** user terautentikasi meminta checkout dengan tier `promo`
- **THEN** sistem memanggil Mayar `payment/create` dengan amount Rp 5.000 dan mengembalikan link checkout Mayar

#### Scenario: Tier tidak valid
- **WHEN** user meminta checkout dengan tier yang tidak dikenal atau kosong
- **THEN** sistem menolak dengan 400 dan pesan error, tanpa memanggil Mayar

#### Scenario: Mayar menolak pembuatan transaksi
- **WHEN** API Mayar mengembalikan error saat membuat transaksi
- **THEN** sistem mengembalikan error 502 kepada user tanpa membuat status premium

### Requirement: Menerima webhook pembayaran Mayar

Sistem SHALL menyediakan endpoint publik yang menerima callback webhook dari Mayar (JSON, method POST) untuk event `payment.received` serta event membership (`membership.newMemberRegistered`, `membership.memberExpired`, `membership.memberUnsubscribed`, `membership.changeTierMemberRegistered`), dan memprosesnya sesuai jenis event.

#### Scenario: Pembayaran diterima
- **WHEN** Mayar mengirim webhook `payment.received` dengan `customerEmail`, `amount`, dan `merchantId` yang valid
- **THEN** sistem mencocokkan email ke user, menyimpan transaksi, dan mengaktifkan status premium user tersebut

#### Scenario: Member baru terdaftar
- **WHEN** Mayar mengirim webhook `membership.newMemberRegistered`
- **THEN** sistem mengaktifkan status premium untuk user yang cocok dengan data customer pada webhook

#### Scenario: Member berhenti berlangganan
- **WHEN** Mayar mengirim webhook `membership.memberUnsubscribed` atau `membership.memberExpired`
- **THEN** sistem menonaktifkan status premium user yang bersangkutan

#### Scenario: Webhook tanpa email yang cocok
- **WHEN** webhook pembayaran tiba dengan `customerEmail` yang tidak ditemukan di database user
- **THEN** sistem mencatat webhook sebagai gagal dicocokkan dan mengembalikan 200 agar Mayar tidak mengulang, tanpa mengubah status user mana pun

### Requirement: Mencegah webhook palsu

Sistem SHALL memverifikasi bahwa webhook yang masuk benar-benar berasal dari Mayar (via secret/validasi merchantId dan amount konsisten dengan transaksi yang tercatat) sebelum mengubah status premium, dan SHALL mengabaikan event duplikat agar status premium tidak ter-reset berulang.

#### Scenario: Webhook valid
- **WHEN** webhook tiba dengan kredensial/merchantId yang sesuai dengan konfigurasi Mayar aplikasi
- **THEN** sistem memproses event tersebut dan mengubah status premium

#### Scenario: Webhook tidak valid
- **WHEN** webhook tiba dengan merchantId/secret yang tidak cocok
- **THEN** sistem menolak dengan 401 dan tidak mengubah status premium

#### Scenario: Event duplikat
- **WHEN** webhook pembayaran yang sama (transactionId sama) diterima lebih dari sekali
- **THEN** sistem memproses hanya sekali dan mengabaikan duplikat tanpa mengubah status premium lagi

### Requirement: Status premium dipersistensikan dan dapat dibaca

Sistem SHALL menyimpan status premium per user (aktif/tidak, tanggal kedaluwarsa, tier, license code Mayar) di database, dan SHALL menyediakan endpoint bagi user terautentikasi untuk membaca status premium dirinya.

#### Scenario: User premium membaca statusnya
- **WHEN** user terautentikasi meminta status premium
- **THEN** sistem mengembalikan apakah user premium, tier aktif, dan tanggal kedaluwarsa

#### Scenario: User non-premium membaca statusnya
- **WHEN** user terautentikasi tanpa langganan meminta status premium
- **THEN** sistem mengembalikan status non-premium tanpa error

### Requirement: Verifikasi lisensi ke Mayar saat akses

Sistem SHALL memverifikasi lisensi langganan ke API Mayar (`saas/v1/license/verify` dengan license code & product ID) secara berkala atau saat status premium diminta, dan SHALL menonaktifkan premium bila lisensi sudah tidak aktif atau kedaluwarsa.

#### Scenario: Lisensi masih aktif
- **WHEN** sistem memverifikasi license code user dan Mayar mengembalikan `isLicenseActive: true`
- **THEN** sistem mempertahankan status premium user

#### Scenario: Lisensi kedaluwarsa
- **WHEN** sistem memverifikasi license code dan Mayar mengembalikan lisensi tidak aktif/kedaluwarsa
- **THEN** sistem menandai premium user non-aktif

#### Scenario: Tanpa license code tersimpan
- **WHEN** user tidak memiliki license code tersimpan
- **THEN** sistem menganggap user non-premium (kecuali ada status premium dari pembayaran satu kali yang masih berlaku)

### Requirement: Gating fitur premium server-side

Sistem SHALL menegakkan batas penggunaan pada fitur AI berbiaya tinggi untuk user non-premium, dan SHALL memberikan akses tanpa batas (atau batas lebih tinggi) untuk user premium, dengan keputusan diambil server-side (bukan client-side).

#### Scenario: Free user melebihi kuota chat asisten harian
- **WHEN** user non-premium mengirim pesan ke `/api/assistant/chat` melebihi kuota hariannya
- **THEN** sistem menolak dengan 402/403 dan pesan yang menjelaskan cara upgrade, tanpa memanggil AI

#### Scenario: Free user memakai web search
- **WHEN** user non-premium mengirim chat dengan `webSearch: true`
- **THEN** sistem menolak atau mengabaikan web search dan memberi tahu user bahwa web search hanya untuk premium

#### Scenario: Free user melebihi kuota generate catatan bulanan
- **WHEN** user non-premium meminta generate catatan AI melebihi kuota bulanannya
- **THEN** sistem menolak dengan 402/403 tanpa menjalankan job generate

#### Scenario: Free user meminta gambar AI
- **WHEN** user non-premium memanggil `/api/assistant/image`
- **THEN** sistem menolak dengan 402/403 dan pesan upgrade

#### Scenario: Premium user tidak dibatasi
- **WHEN** user premium mengakses fitur AI yang di-gate
- **THEN** sistem mengizinkan tanpa penolakan kuota

### Requirement: UI menampilkan status premium dan alur beli

Antarmuka SHALL menampilkan status premium user yang sebenarnya (dari server, bukan localStorage), menampilkan badge Pro untuk user premium, dan tombol beli/upgrade yang mengarah ke alur checkout Mayar; untuk user yang sudah premium, halaman pricing menampilkan status aktif sebagai pengganti tombol beli.

#### Scenario: User premium melihat sidebar
- **WHEN** user premium membuka aplikasi
- **THEN** sidebar menampilkan indikator/badge bahwa user berstatus Pro

#### Scenario: User memilih tier di halaman pricing
- **WHEN** user non-premium memilih salah satu tier (promo/normal) di `/pricing` atau popup kemerdekaan
- **THEN** sistem membuat checkout Mayar dan mengarahkan user ke link pembayaran Mayar

#### Scenario: User premium membuka halaman pricing
- **WHEN** user premium membuka `/pricing`
- **THEN** halaman menampilkan status langganan aktif (tier & tanggal kedaluwarsa) alih-alih tombol beli baru

### Requirement: Penanganan kedaluwarsa premium

Sistem SHALL menonaktifkan status premium secara otomatis ketika masa berlaku berakhir (berdasarkan `premium_until` atau event `membership.memberExpired`), dan pengecekan kuota/akses SHALL menggunakan status premium terkini.

#### Scenario: Masa berlaku habis
- **WHEN** `premium_until` user sudah lewat dan tidak ada perpanjangan
- **THEN** sistem memperlakukan user sebagai non-premium pada pengecekan akses berikutnya

### Requirement: Klaim trial gratis 7 hari (sekali seumur hidup)

Sistem SHALL menyediakan endpoint bagi user terautentikasi untuk mengklaim trial gratis premium selama 7 hari, maksimal SEKALI seumur hidup per user, tanpa pembayaran.

#### Scenario: User baru mengklaim trial
- **WHEN** user yang belum pernah klaim trial meminta klaim trial
- **THEN** sistem mengaktifkan premium (tier `trial`) selama 7 hari dan mencatat `trial_claimed_at`

#### Scenario: User sudah pernah klaim trial
- **WHEN** user yang `trial_claimed_at`-nya sudah terisi meminta klaim trial lagi
- **THEN** sistem menolak dengan 409 dan pesan bahwa trial sudah pernah dipakai

#### Scenario: User sedang premium aktif meminta trial
- **WHEN** user dengan langganan aktif meminta klaim trial
- **THEN** sistem menolak dengan 409 karena sudah berlangganan

### Requirement: Kode diskon (persen & nominal)

Sistem SHALL menerima kode diskon opsional saat checkout, memvalidasinya terhadap tabel `discount_codes` (aktif, belum kedaluwarsa, kuota belum habis), menghitung harga final (potongan persen ATAU nominal, minimal Rp 1.000), dan mengirim amount final ke Mayar. Pemakaian kode dicatat secara atomik setelah checkout berhasil dibuat.

#### Scenario: Kode persen valid
- **WHEN** user checkout dengan kode persen yang valid (mis. 15%)
- **THEN** harga final = harga tier − 15%, dikirim ke Mayar, dan `used_count` kode bertambah 1

#### Scenario: Kode nominal valid
- **WHEN** user checkout dengan kode nominal yang valid (mis. Rp 10.000)
- **THEN** harga final = harga tier − Rp 10.000 (minimal Rp 1.000), dikirim ke Mayar, dan `used_count` bertambah

#### Scenario: Kode tidak ditemukan / tidak aktif / kedaluwarsa / habis kuota
- **WHEN** user checkout dengan kode yang tidak ditemukan, tidak aktif, kedaluwarsa, atau kuotanya habis
- **THEN** sistem menolak dengan 400 dan pesan yang jelas, tanpa membuat checkout

#### Scenario: Tanpa kode diskon
- **WHEN** user checkout tanpa kode diskon
- **THEN** harga final = harga tier normal tanpa potongan
