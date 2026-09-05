## Purpose

Meningkatkan pengalaman visual dan interaktivitas ekstensi Eureka.AI melalui loading states, transisi animasi, typing indicator, keyboard shortcuts, dan notifikasi yang lebih baik.

## ADDED Requirements

### Requirement: Loading skeleton
Ekstensi SHALL menampilkan skeleton placeholder saat memuat konten (chat history, draft catatan).

#### Scenario: Memuat chat history
- **WHEN** ekstensi membuka view chat dan memuat pesan sebelumnya
- **THEN** skeleton placeholder ditampilkan sebelum konten muncul

#### Scenario: Memuat draft catatan
- **WHEN** user menekan tombol "Catat" dan draft sedang dimuat
- **THEN** skeleton placeholder ditampilkan di area draft

### Requirement: View transition animations
Ekstensi SHALL menampilkan transisi halus saat berpindah antar view (login → chat → draft).

#### Scenario: Transisi login ke chat
- **WHEN** login berhasil dan berpindah ke view chat
- **THEN** animasi fade-in ditampilkan selama 200ms

#### Scenario: Transisi chat ke draft
- **WHEN** user menekan tombol "Catat" dan draft muncul
- **THEN** animasi slide-up ditampilkan selama 250ms

### Requirement: Typing indicator
Ekstensi SHALL menampilkan indikator "Eureka sedang mengetik..." saat AI sedang memproses respons.

#### Scenario: AI merespons
- **WHEN** ekstensi mengirim pesan ke backend dan menunggu respons
- **THEN** typing indicator (tiga titik bergerak) ditampilkan di bawah pesan terakhir

#### Scenario: AI selesai merespons
- **WHEN** respons AI lengkap diterima
- **THEN** typing indicator menghilang dan pesan muncul dengan animasi fade-in

### Requirement: Keyboard shortcuts
Ekstensi SHALL mendukung shortcut keyboard untuk operasi umum.

#### Scenario: Kirim pesan dengan Ctrl+Enter
- **WHEN** user menekan Ctrl+Enter di chat input
- **THEN** pesan terkirim

#### Scenario: Close draft dengan Escape
- **WHEN** user menekan Escape saat draft terbuka
- **THEN** draft tertutup dan kembali ke view chat

### Requirement: Notification badge
Ekstensi SHALL menampilkan badge notifikasi di icon toolbar saat ada info penting.

#### Scenario: Catatan berhasil disimpan
- **WHEN** catatan berhasil disimpan ke dashboard
- **THEN** badge notifikasi muncul di icon toolbar selama 3 detik

#### Scenario: Error terjadi
- **WHEN** operasi gagal (login, simpan catatan, kirim pesan)
- **THEN** badge error merah muncul di icon toolbar

### Requirement: Empty state yang informatif
Ekstensi SHALL menampilkan pesan yang membantu saat tidak ada konten.

#### Scenario: Chat kosong
- **WHEN** user membuka ekstensi untuk pertama kali atau sesi baru
- **THEN** empty state menampilkan saran pertanyaan dan cara penggunaan

#### Scenario: Tidak ada hasil pencarian
- **WHEN** user mencari sesuatu dan tidak ada hasil
- **THEN** empty state menampilkan pesan "Tidak ditemukan" dengan saran alternatif
