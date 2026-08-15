## REMOVED Requirements

### Requirement: Membuat checkout langganan Mayar
**Reason**: Payment gateway diganti dari Mayar.id ke DOKU Checkout; checkout kini dibuat melalui `doku-payments`.
**Migration**: Gunakan endpoint `/api/payments/checkout` yang sama, tetapi backend kini memanggil DOKU `checkout/v1/payment` dan mengembalikan `response.payment.url`. Harga tier, kode diskon, dan redirect tetap sama.

### Requirement: Menerima webhook pembayaran Mayar
**Reason**: Format webhook Mayar (`payment.received`, `membership.*`) tidak lagi berlaku; DOKU mengirim HTTP Notification dengan struktur dan verifikasi signature yang berbeda.
**Migration**: Endpoint `/api/payments/webhook` yang sama kini memproses HTTP Notification DOKU (status `SUCCESS`, verifikasi HMAC-SHA256, idempotensi via `invoice_number`) — lihat `doku-payments`.

### Requirement: Mencegah webhook palsu
**Reason**: Verifikasi Mayar (merchantId + webhook token) diganti verifikasi signature HMAC-SHA256 DOKU dengan Secret Key.
**Migration**: Notifikasi DOKU diverifikasi lewat header `Client-Id`/`Request-Id`/`Request-Timestamp`/`Signature` dan digest body; lihat `doku-payments`.

### Requirement: Status premium dipersistensikan dan dapat dibaca
**Reason**: Model lisensi Mayar (license code) dihapus; status premium kini murni dari database berdasarkan pembayaran one-time.
**Migration**: Kolom `mayar_license_code`/`mayar_product_id`/`mayar_customer_id` dihapus dan diganti referensi transaksi DOKU (`doku_invoice_number`/`doku_transaction_id`). Field `licenseCode` tidak lagi ada di respons status.

### Requirement: Verifikasi lisensi ke Mayar saat akses
**Reason**: Tidak ada lagi lisensi SaaS; DOKU adalah payment gateway one-time (1x bayar = 30 hari premium), jadi tidak ada verifikasi lisensi eksternal.
**Migration**: Hapus panggilan `saas/v1/license/verify` dan `saas/v1/license/deactivate`; kedaluwarsa premium ditentukan hanya oleh `premium_until`.

### Requirement: Gating fitur premium server-side
**Reason**: Perilaku gating tidak berubah secara fungsional, tetapi requirement ini kini didefinisikan ulang di capability `doku-payments`.
**Migration**: Lihat `doku-payments` — kuota free tier dan penolakan 402/403 tetap berlaku identik.

### Requirement: UI menampilkan status premium dan alur beli
**Reason**: Label dan alur pembayaran berubah dari Mayar.id ke DOKU.
**Migration**: Teks "Mayar.id"/"Ke Mayar…" di `/pricing`, popup kemerdekaan, dan popup sukses diganti DOKU; popup sukses (`?upgrade=success`) tetap berfungsi.

### Requirement: Penanganan kedaluwarsa premium
**Reason**: Kedaluwarsa kini murni berbasis `premium_until` (tanpa event `membership.memberExpired` dari Mayar).
**Migration**: Lihat `doku-payments` — kedaluwarsa dideteksi saat pengecekan status/akses.

### Requirement: Klaim trial gratis 7 hari (sekali seumur hidup)
**Reason**: Fitur trial dipertahankan apa adanya, hanya didefinisikan ulang di capability `doku-payments`.
**Migration**: Lihat `doku-payments` — perilaku trial tidak berubah.

### Requirement: Kode diskon (persen & nominal)
**Reason**: Fitur diskon dipertahankan apa adanya, hanya didefinisikan ulang di capability `doku-payments`.
**Migration**: Lihat `doku-payments` — validasi & konsumsi kode tidak berubah; amount final dikirim ke DOKU alih-alih Mayar.
