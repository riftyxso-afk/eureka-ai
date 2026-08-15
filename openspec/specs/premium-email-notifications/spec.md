## Purpose

Mengirim email otomatis kepada pengguna saat premium mereka diaktifkan (melalui pembayaran Pakasir atau jalur aktivasi lain), tanpa menghalangi proses aktivasi bila pengiriman email gagal.

## Requirements

### Requirement: Email konfirmasi saat premium aktif
Saat sistem mengaktifkan premium untuk seorang pengguna (webhook pembayaran sukses atau jalur aktivasi lain), sistem HARUS mengirim email konfirmasi ke alamat email pengguna yang memuat informasi tier (promo/normal) dan durasi (30 hari) serta CTA masuk ke aplikasi.

#### Scenario: Webhook sukses mengirim email
- WHEN webhook pembayaran berhasil mengaktifkan premium untuk pengguna
- THEN sistem mengirim email konfirmasi premium ke email pengguna berisi tier dan durasi

#### Scenario: Email berisi detail yang benar
- WHEN pengguna menerima email konfirmasi premium
- THEN email memuat tier yang dibeli, durasi aktif, dan tombol masuk ke aplikasi

### Requirement: Kegagalan email tidak memblokir aktivasi
Kegagalan mengirim email (kredensial email belum dikonfigurasi, layanan email error) TIDAK BOLEH menggagalkan aktivasi premium. Aktivasi premium tetap berhasil; kegagalan hanya dicatat (log) dan tidak memengaruhi respons ke webhook.

#### Scenario: Email gagal, premium tetap aktif
- WHEN pengiriman email premium gagal tetapi pembayaran sukses
- THEN premium tetap aktif 30 hari dan kegagalan hanya dicatat di log

#### Scenario: Aktivasi tidak bergantung pada email
- WHEN layanan email belum dikonfigurasi di produksi
- THEN proses aktivasi premium tetap berjalan normal tanpa email

### Requirement: Template konsisten dengan email yang ada
Email premium HARUS memakai kerangka/template yang sama dengan email lain (welcome & login) — identitas visual Eureka.AI, dark-mode support, dan gaya penulisan yang konsisten.

#### Scenario: Email premium bergaya sama
- WHEN pengguna menerima email premium
- THEN tampilan dan strukturnya konsisten dengan email welcome/login Eureka.AI
