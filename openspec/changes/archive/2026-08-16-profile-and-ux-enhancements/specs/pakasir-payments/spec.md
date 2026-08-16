## ADDED Requirements

### Requirement: Riwayat pembelian & status langganan di halaman pricing

Sistem SHALL menyediakan endpoint bagi user terautentikasi yang mengembalikan status premium terkini (aktif/tidak, tier, tanggal kedaluwarsa) beserta riwayat order pembayaran miliknya (dari `pakasir_payment_requests`: order_id, amount, tier, status, tanggal pembayaran), dan halaman `/pricing` SHALL menampilkan keduanya: kartu status langganan dan daftar riwayat pembelian. Endpoint SHALL hanya mengembalikan data user pemanggil.

#### Scenario: User premium membuka halaman pricing

- **WHEN** user premium membuka `/pricing`
- **THEN** halaman menampilkan status langganan aktif (tier & tanggal kedaluwarsa) dan daftar riwayat pembelian yang pernah dilakukan

#### Scenario: User yang pernah membayar tapi premiumnya habis

- **WHEN** user non-premium yang pernah membayar membuka `/pricing`
- **THEN** daftar riwayat pembelian tetap ditampilkan beserta status masing-masing order, sementara area beli/trial tetap tampil seperti biasa

#### Scenario: User tanpa riwayat pembelian

- **WHEN** user yang belum pernah membayar membuka `/pricing`
- **THEN** seksi riwayat menampilkan keadaan kosong ("Belum ada pembelian") tanpa error

#### Scenario: Endpoint hanya mengembalikan data sendiri

- **WHEN** endpoint riwayat dipanggil dengan identitas user tertentu
- **THEN** respons hanya berisi status dan riwayat milik user tersebut, bukan user lain
