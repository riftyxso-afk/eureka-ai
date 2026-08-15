## ADDED Requirements

### Requirement: Redirect checkout bersifat netral terhadap hasil pembayaran

Sistem SHALL menggunakan URL callback kembali dari halaman pembayaran DOKU yang netral (tidak menyatakan hasil pembayaran, mis. `?upgrade=done`), karena DOKU mengarahkan customer kembali ke `callback_url` apa pun hasil transaksinya (sukses, dibatalkan, gagal, kedaluwarsa). URL callback SHALL tidak menyiratkan keberhasilan.

#### Scenario: Pembayaran selesai
- **WHEN** customer menyelesaikan pembayaran di halaman DOKU
- **THEN** sistem mengarahkan customer kembali ke callback_url netral (`?upgrade=done`), bukan URL yang mengklaim sukses

#### Scenario: Pembayaran dibatalkan atau gagal
- **WHEN** customer membatalkan atau gagal membayar di halaman DOKU
- **THEN** sistem tetap mengarahkan customer kembali ke callback_url netral yang sama (`?upgrade=done`) dan UI tidak menampilkan klaim sukses

### Requirement: Verifikasi status premium saat kembali dari pembayaran

Sistem SHALL menentukan penampilan popup sukses berdasarkan status premium aktual dari server (endpoint status premium), bukan dari query string. Saat user kembali dari halaman pembayaran DOKU, sistem SHALL memverifikasi status premium dan melakukan polling singkat (hingga ±15 detik) untuk memberi waktu webhook DOKU memproses pembayaran; popup sukses SHALL hanya muncul bila server mengonfirmasi premium aktif.

#### Scenario: Pembayaran sukses dan premium aktif
- **WHEN** user kembali ke aplikasi dari DOKU dan server mengonfirmasi premium aktif (termasuk setelah polling)
- **THEN** sistem menampilkan popup sukses berlangganan dan membersihkan query dari URL

#### Scenario: Pembayaran belum selesai (batal/gagal/timeout)
- **WHEN** user kembali dari DOKU tetapi server tidak mengonfirmasi premium aktif dalam batas waktu polling
- **THEN** sistem menampilkan notifikasi netral bahwa pembayaran belum selesai dan user tetap di paket Free, tanpa popup sukses, lalu membersihkan query dari URL

#### Scenario: Aktivasi tertunda karena webhook
- **WHEN** webhook DOKU tiba beberapa detik setelah user kembali ke aplikasi
- **THEN** polling status premium mendeteksi aktivasi dan sistem menampilkan popup sukses
