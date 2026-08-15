## REMOVED Requirements

### Requirement: Membuat checkout langganan DOKU
**Reason**: Payment gateway diganti dari DOKU ke Pakasir; checkout kini dibuat via hosted payment page Pakasir (`pakasir-payments`).
**Migration**: Endpoint `/api/payments/checkout` tetap, tetapi kini mengembalikan URL `https://app.pakasir.com/pay/{slug}/{amount}?order_id=...&redirect=...` alih-alih memanggil DOKU `checkout/v1/payment`. Harga tier, kode diskon, dan redirect netral `?upgrade=done` tetap.

### Requirement: Menerima HTTP Notification DOKU
**Reason**: Format notifikasi DOKU (HTTP Notification + verifikasi HMAC-SHA256) tidak berlaku; Pakasir mengirim webhook `{amount, order_id, project, status, payment_method, completed_at}` tanpa signature.
**Migration**: Endpoint `/api/payments/webhook` yang sama kini memproses webhook Pakasir (status `completed` → premium 30 hari, pencocokan `order_id` + amount, konfirmasi `transactiondetail`) — lihat `pakasir-payments`.

### Requirement: Mencegah notifikasi palsu dan duplikat
**Reason**: Verifikasi signature HMAC DOKU diganti verifikasi fail-closed Pakasir (project slug + order_id/amount + API `transactiondetail`) karena webhook Pakasir tidak bersignature.
**Migration**: Lihat `pakasir-payments` — idempotensi via `pakasir_notification_events` (unique `order_id`).

### Requirement: Status premium dipersistensikan dan dapat dibaca
**Reason**: Referensi transaksi berubah dari DOKU ke Pakasir.
**Migration**: Kolom `users.doku_invoice_number`/`doku_transaction_id` diganti `pakasir_invoice_number`/`pakasir_transaction_id`; tabel `doku_payment_requests`/`doku_notification_events` diganti `pakasir_*`. Perilaku endpoint status tidak berubah.

### Requirement: Gating fitur premium server-side
**Reason**: Perilaku gating tidak berubah; requirement ini didefinisikan ulang di capability `pakasir-payments`.
**Migration**: Lihat `pakasir-payments` — kuota free tier dan penolakan 402/403 tetap identik.

### Requirement: UI menampilkan status premium dan alur beli
**Reason**: Label dan alur pembayaran berubah dari DOKU ke Pakasir.
**Migration**: Teks "DOKU" di `/pricing`, popup kemerdekaan, dan komentar popup sukses diganti Pakasir; alur redirect netral `?upgrade=done` + polling status tetap.

### Requirement: Penanganan kedaluwarsa premium
**Reason**: Kedaluwarsa tetap murni berbasis `premium_until`; requirement didefinisikan ulang di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments`.

### Requirement: Klaim trial gratis 7 hari (sekali seumur hidup)
**Reason**: Fitur trial dipertahankan; didefinisikan ulang di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments`.

### Requirement: Kode diskon (persen & nominal)
**Reason**: Fitur diskon dipertahankan; didefinisikan ulang di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments` — amount final dikirim ke Pakasir alih-alih DOKU.

### Requirement: Pembatalan langganan
**Reason**: Perilaku pembatalan tidak berubah; didefinisikan ulang di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments`.

### Requirement: Penghapusan seluruh jejak Mayar.id
**Reason**: Jejak Mayar.id sudah dihapus oleh change `replace-mayar-with-doku`; requirement ini tidak relevan lagi dan digantikan requirement "Penghapusan seluruh jejak DOKU" di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments` — jejak DOKU dihapus dengan pola yang sama.

### Requirement: Redirect checkout bersifat netral terhadap hasil pembayaran
**Reason**: Perilaku redirect netral dipertahankan, tetapi kini diterapkan pada URL checkout Pakasir (parameter `redirect`).
**Migration**: Lihat `pakasir-payments` — URL Pakasir memakai `redirect={origin}/dashboard?upgrade=done`.

### Requirement: Verifikasi status premium saat kembali dari pembayaran
**Reason**: Perilaku verifikasi + polling status saat kembali dari halaman pembayaran dipertahankan; didefinisikan ulang di `pakasir-payments`.
**Migration**: Lihat `pakasir-payments` — popup sukses hanya muncul bila server mengonfirmasi premium aktif.
