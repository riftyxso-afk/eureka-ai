## Purpose

Membuat sidebar desktop dapat di-collapse menjadi mode ikon-saja dan di-expand kembali, dengan preferensi pengguna yang tersimpan, sehingga layar kecil (mis. laptop) punya lebih banyak ruang konten.

## ADDED Requirements

### Requirement: Sidebar desktop dapat di-collapse dan di-expand

Sistem SHALL menyediakan kontrol untuk mengganti sidebar desktop antara mode terbuka (label + ikon) dan mode tertutup (ikon saja). Kontrol SHALL terlihat dan mudah dijangkau di dalam sidebar, dan navigasi tetap berfungsi penuh di kedua mode.

#### Scenario: Collapse sidebar di desktop

- **WHEN** pengguna menekan kontrol collapse pada sidebar desktop
- **THEN** sidebar menyempit menjadi hanya ikon dan konten utama mendapat ruang lebih lebar

#### Scenario: Expand kembali

- **WHEN** pengguna menekan kontrol expand pada sidebar yang tertutup
- **THEN** sidebar kembali menampilkan label menu di samping ikon

#### Scenario: Navigasi tetap berfungsi saat tertutup

- **WHEN** sidebar dalam mode ikon-saja
- **THEN** setiap ikon menu tetap dapat diklik dan menampilkan label (mis. tooltip) saat diarahkan kursor

### Requirement: Preferensi collapse tersimpan

Sistem SHALL menyimpan preferensi mode sidebar per pengguna sehingga mode yang dipilih tetap berlaku saat pindah halaman dan setelah refresh.

#### Scenario: Refresh mempertahankan mode

- **WHEN** pengguna menutup sidebar lalu me-refresh halaman
- **THEN** sidebar tetap dalam mode tertutup

#### Scenario: Mode konsisten antar halaman

- **WHEN** pengguna berpindah antar halaman dashboard
- **THEN** mode sidebar (terbuka/tertutup) tidak berubah

#### Scenario: Perangkat mobile tidak terpengaruh

- **WHEN** pengguna membuka aplikasi di perangkat mobile
- **THEN** perilaku drawer mobile tetap seperti sebelumnya, tidak dipengaruhi preferensi collapse desktop
