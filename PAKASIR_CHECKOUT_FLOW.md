# Eureka.AI — Checkout Flow (untuk Verifikasi Proyek Pakasir)

Dokumen ini menjelaskan alur pembayaran (checkout flow) aplikasi **Eureka.AI**
sebagai bahan verifikasi/KYC proyek merchant di Pakasir (app.pakasir.com).
Seluruh alur di bawah sudah diimplementasikan dan diuji terhadap **sandbox
Pakasir** (proyek `relay`).

---

## 1. Informasi Merchant & Bisnis

| Item | Detail |
|---|---|
| Nama aplikasi / produk | **Eureka.AI** — AI Tutor Socratic untuk pelajar Indonesia |
| Kategori produk | Jasa digital (langganan fitur AI premium) |
| Model penjualan | **Bayar sekali = premium aktif 30 hari** (bukan langganan otomatis) |
| Harga jual | **Promo Kemerdekaan: Rp 5.000** / **Normal: Rp 59.000** (sekali bayar) |
| Metode pembayaran | QRIS (termasuk e-wallet: GoPay, OVO, ShopeePay, DANA) & Virtual Account |
| Redirect setelah bayar | Kembali ke aplikasi → `/dashboard?upgrade=done` |
| Webhook URL | `https://<domain-aplikasi>/api/payments/webhook` |

> Isi bagian yang kosong (nama merchant resmi, email kontak, domain) sesuai
> data yang didaftarkan di akun Pakasir.

---

## 2. Ringkasan Alur Checkout (User Journey)

```
┌─────────────┐   1. Pilih tier     ┌──────────────────┐
│  /pricing   │ ──────────────────► │  POST /api/payments/checkout
│  atau popup │                     │  { userId, tier, discountCode? }
│  promo      │                     └────────┬─────────┘
└─────────────┘                              │ 2. Server:
                                             │    • validasi tier & kode diskon
                                             │    • catat transaksi (order_id → user)
                                             │    • bangun URL bayar Pakasir
                                             ▼
                             ┌──────────────────────────────┐
                             │  Redirect ke halaman bayar    │
                             │  app.pakasir.com/pay/{slug}/  │
                             │  {amount}?order_id=...        │
                             └──────────────┬───────────────┘
                                            │ 3. Customer membayar (QRIS/VA)
                                            ▼
                  ┌───────────────────────────────────────────┐
                  │ 4a. BAYAR SUKSES                           │
                  │     • Pakasir redirect balik ke aplikasi   │
                  │       (/dashboard?upgrade=done)            │
                  │     • Pakasir kirim webhook "completed"    │
                  │     • Server verifikasi → premium aktif    │
                  │       30 hari → popup sukses               │
                  ├───────────────────────────────────────────┤
                  │ 4b. BATAL / TIDAK BAYAR                    │
                  │     • Tidak ada redirect balik (customer   │
                  │       tetap di halaman Pakasir)            │
                  │     • Status premium TIDAK berubah (free)  │
                  └───────────────────────────────────────────┘
```

**Alur detail untuk reviewer:**

1. User (terautentikasi) memilih tier di `/pricing` (Normal Rp 59.000) atau
   popup Promo Kemerdekaan (Promo Rp 5.000). Opsional memasukkan kode diskon.
2. Frontend memanggil `POST /api/payments/checkout`:
   - Server memvalidasi tier & kode diskon (bila ada), menghitung harga final.
   - Server **mencatat transaksi** ke tabel `pakasir_payment_requests`
     (`order_id` unik → user + tier + harga final). Ini penting agar webhook
     nanti bisa mencocokkan dan menentukan tier (termasuk harga diskon).
   - Server membangun URL hosted payment page Pakasir dan mengembalikannya
     sebagai `{ link }`.
3. Browser diarahkan ke halaman bayar Pakasir
   (`app.pakasir.com/pay/{slug}/{amount}?order_id=...&redirect=...`).
   Customer memilih metode (QRIS / VA) dan menyelesaikan pembayaran.
4. **Setelah pembayaran:**
   - **Sukses:** Pakasir mengarahkan customer kembali ke aplikasi
     (`/dashboard?upgrade=done` — URL netral, tidak mengklaim hasil di URL)
     dan mengirim **webhook** `completed` ke Webhook URL proyek.
   - Server webhook memverifikasi (lihat bagian 4) → mengaktifkan premium
     **30 hari** → frontend memunculkan popup sukses (dikonfirmasi via polling
     status premium).
   - **Batal / tidak selesai:** customer tidak diarahkan kembali; status
     premium tidak berubah (tetap Free). Tidak ada klaim "sukses" yang salah.

---

## 3. Detail Teknis Integrasi

### 3.1 Checkout (hosted payment page)

- Server membangun URL: `https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}&redirect={redirect_url}`
- `order_id`: nomor invoice aplikasi, format `EKA{YYYYMMDDHHmmss}{6-hex}`
  (alfanumerik, ≤ 30 karakter, unik per transaksi).
- `redirect`: `https://<domain-aplikasi>/dashboard?upgrade=done` (netral).
- Tidak ada panggilan API `transactioncreate` di sisi server — transaksi
  dicatat secara internal; halaman bayar ditangani sepenuhnya oleh Pakasir.

### 3.2 Webhook (server-to-server)

- Pakasir mengirim `POST` JSON ke Webhook URL proyek:
  ```json
  {
    "amount": 59000,
    "order_id": "EKA2026081510301248X9F3A",
    "project": "relay",
    "status": "completed",
    "payment_method": "qris",
    "completed_at": "2026-08-15T08:07:02.819+07:00"
  }
  ```
- Endpoint aplikasi: `POST /api/payments/webhook`.

### 3.3 Verifikasi webhook (fail-closed, tanpa signature)

Webhook Pakasir tidak bersignature, jadi aplikasi memverifikasi berlapis
sebelum mengubah status premium:

1. `project` webhook harus sama dengan slug proyek (`PAKASIR_PROJECT`).
2. `order_id` harus tercatat di `pakasir_payment_requests` dan `amount`
   webhook harus sama dengan amount yang dicatat saat checkout.
3. **Konfirmasi authoritative** via API Pakasir:
   `GET /api/transactiondetail?project=&amount=&order_id=&api_key=`
   → status harus `completed`. Bila API tidak terjangkau → pembayaran TIDAK
   diaktifkan dan server membalas error agar Pakasir mengulang.
4. **Idempotensi:** `order_id` unik di tabel `pakasir_notification_events` —
   webhook duplikat diabaikan (premium tidak ter-reset).

### 3.4 Aktivasi premium

- Status `completed` + verifikasi lolos → `is_premium = true`,
  `premium_tier = promo|normal`, `premium_until = now + 30 hari`,
  referensi `pakasir_invoice_number` di tabel `users`.
- Status selain `completed` (pending/gagal/batal) → tanpa aktivasi.

---

## 4. Keamanan & Ketahanan

- **Fail-closed:** tanpa `PAKASIR_PROJECT`/`PAKASIR_API_KEY`, semua webhook
  ditolak (503). Webhook dengan `project` salah ditolak (401).
- **Verifikasi authoritative:** aktivasi premium hanya setelah API
  `transactiondetail` Pakasir mengonfirmasi `completed` — tidak pernah
  mengandalkan webhook mentah.
- **Idempotensi & anti-reset:** kunci unik `order_id` mencegah aktivasi ganda
  dan reset `premium_until`.
- **Redirect netral:** URL kembali tidak menyatakan hasil; klaim "sukses"
  hanya muncul setelah server mengonfirmasi premium aktif.

---

## 5. Uji yang Sudah Dilakukan (Sandbox `relay`)

- `transactioncreate` (qris) → 200 + payment number ✅
- `paymentsimulation` → webhook `completed` → verifikasi `transactiondetail`
  → **premium aktif 30 hari** ✅
- Webhook `pending` / order tak dikenal / amount beda / project beda /
  duplikat → **tanpa aktivasi / ditolak** ✅
- Alur cancel → premium nonaktif ✅
- Alur trial & kode diskon tetap berfungsi (tidak berubah oleh integrasi) ✅

---

*Dokumen ini sesuai implementasi terkini. Untuk go-live: isi env
`PAKASIR_PROJECT`/`PAKASIR_API_KEY` di hosting (Vercel/Render) dan pastikan
Webhook URL proyek mengarah ke `https://<domain>/api/payments/webhook`.*
