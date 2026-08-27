## Purpose

Memperkaya dua kartu saran Dashboard ("Tanya Apa Saja" dan "Kerjakan Tugas") dengan feedback loading dan indikasi skill yang langsung terlihat di dalam kartu.

## ADDED Requirements

### Requirement: Tanya Apa Saja menampilkan orb dan skill analogi

Kartu "Tanya Apa Sasa" SHALL menampilkan indikator loading `thinking`/`composing` dan label skill yang menjelaskan mode analogi, langsung di dalam kartu, segera setelah kartu diklik dan sebelum prompt dikirim.

#### Scenario: Klik Tanya Apa Saja
- **WHEN** pengguna mengklik kartu "Tanya Apa Saja"
- **THEN** kartu mengganti ikon statis dengan orb animasi state `composing` (via EurekaOrb `thinking` inline) dan menampilkan teks "Menjelaskan dengan analogi..."

#### Scenario: Reduced motion aktif
- **WHEN** preferensi sistem `prefers-reduced-motion: reduce` aktif dan kartu diklik
- **THEN** kartu menampilkan ikon statis dan teks skill tanpa animasi orb

### Requirement: Kerjakan Tugas menampilkan orb dan skill langkah demi langkah

Kartu "Kerjakan Tugas" SHALL menampilkan indikator loading `working`/`solving` dan label skill langkah-demi-langkah di dalam kartu, segera setelah diklik.

#### Scenario: Klik Kerjakan Tugas
- **WHEN** pengguna mengklik kartu "Kerjakan Tugas"
- **THEN** kartu mengganti ikon statis dengan orb animasi state `working` dan menampilkan teks "Menyusun langkah penyelesaian..."

#### Scenario: State kembali setelah interaksi
- **WHEN** prompt telah diisi ke composer dan kartu tidak lagi dalam keadaan loading
- **THEN** kartu kembali menampilkan ikon dan deskripsi awal dalam waktu ≤500ms

### Requirement: Loading kartu tidak memblokir composer

Aktivasi loading pada kartu SHALL tetap mengisi composer dengan prompt yang sesuai dan tidak boleh mencegah pengguna mengedit atau mengirim prompt tersebut secara manual.

#### Scenario: Edit setelah klik kartu
- **WHEN** kartu diklik dan prompt terisi di composer
- **THEN** pengguna dapat mengubah teks di composer dan mengirimnya secara manual tanpa hambatan

#### Scenario: Klik rapid
- **WHEN** pengguna mengklik kartu yang sama berulang kali dengan cepat
- **THEN** sistem tidak membuat sesi duplikat dan hanya memproses satu pengisian composer terbaru
