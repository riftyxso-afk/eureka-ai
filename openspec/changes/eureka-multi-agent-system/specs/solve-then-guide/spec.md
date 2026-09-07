# Spec Delta: solve-then-guide

## ADDED Requirements

### Requirement: Solve dulu di sandbox sebelum memandu

Untuk soal yang membutuhkan kepastian tinggi (matematika kompleks, sains hitungan panjang, verifikasi numerik), sistem SHALL menyelesaikan soal sepenuhnya di sandbox eksekusi kode terlebih dahulu (dengan verifikasi numerik) SEBELUM satu kata pun ditampilkan ke siswa, kemudian menyusun jalur pertanyaan Socratic mundur (reverse-engineer dari solusi terverifikasi menuju pertanyaan pemandu). Dialog Socratic SHALL memakai solusi terverifikasi itu sebagai ground truth.

#### Scenario: Soal hitungan kompleks

- **WHEN** siswa mengajukan soal matematika multi-langkah melalui alur Solve-then-Guide
- **THEN** solusi diselesaikan dan diverifikasi di sandbox lebih dulu, dan pertanyaan pemandu disusun mundur dari solusi tersebut

#### Scenario: Verifikasi sandbox gagal

- **WHEN** eksekusi sandbox menghasilkan error atau solusi tidak lolos verifikasi
- **THEN** sistem mencoba ulang perbaikan secara terbatas (configurable), dan bila tetap gagal menampilkan pesan jujur bahwa solusi belum terverifikasi — bukan melanjutkan dialog dengan jawaban yang belum pasti

### Requirement: Trigger manual dan otomatis

Solve-then-Guide SHALL dapat dipicu: (a) manual — siswa Pro memilih mode ini secara eksplisit di prompt box; atau (b) otomatis — dari dalam loop Eureka Multi Agent saat Kompas/Socra mendeteksi soal di luar ambang kompleksitas (membutuhkan verifikasi numerik/eksekusi kode), lalu kembali ke loop normal setelah solusi didapat.

#### Scenario: Trigger manual user Pro

- **WHEN** siswa Pro memilih Solve-then-Guide secara eksplit lalu mengirim soal
- **THEN** alur solve-then-guide dijalankan untuk soal tersebut

#### Scenario: Escalate otomatis dari loop

- **WHEN** loop Eureka Multi Agent aktif dan soal terdeteksi membutuhkan verifikasi numerik
- **THEN** loop meng-escalate ke Solve-then-Guide, dan setelah solusi terverifikasi, kembali ke dialog loop normal

#### Scenario: User non-Pro memilih manual

- **WHEN** siswa tanpa entitlemen Pro mencoba memilih Solve-then-Guide secara manual
- **THEN** opsi tidak tersedia atau ditolak dengan arahan ke halaman upgrade

### Requirement: Entitlement Pro

Solve-then-Guide SHALL hanya tersedia untuk user Pro, dicek melalui sistem entitlement premium existing (`lib/premium.ts`) dengan feature entry baru — bukan sistem entitlement baru. Cap biaya harian khusus panggilan model Astra SHALL diterapkan terpisah dari cap biaya loop biasa, dengan fallback pesan ramah berbahasa Indonesia saat cap terlampaui.

#### Scenario: Cap Astra terlampaui

- **WHEN** pemakaian Astra harian seorang user melewati cap yang dikonfigurasi
- **THEN** panggilan Solve-then-Guide berikutnya ditolak dengan pesan ramah, dan cap loop biasa tidak terpengaruh
