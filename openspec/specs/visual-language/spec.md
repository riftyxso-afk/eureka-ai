# visual-language Specification

## Purpose

Standar bahasa visual lintas aplikasi: skala radius yang konsisten, sistem warna ceria untuk pelajar, status aktif navigasi yang benar, dan prinsip anti-slop — sehingga tampilan terasa dirancang satu tangan, bukan hasil tempelan.

## Requirements

### Requirement: Skala radius konsisten di seluruh komponen

Aplikasi SHALL menggunakan satu skala radius yang terdokumentasi (mis. kartu besar, kartu kecil, input, pill) dan seluruh komponen — termasuk komponen pihak ketiga yang distyle ulang — SHALL mengikuti skala tersebut tanpa campuran radius acak.

#### Scenario: Audit radius lintas halaman

- **WHEN** halaman area login utama (dashboard, catatan, jadwal, profil, ujian) diperiksa
- **THEN** setiap sudut elemen sesuai salah satu nilai pada skala radius resmi, tidak ada nilai liar di luar skala

### Requirement: Sistem warna ceria per mata pelajaran dan konteks

Sistem warna aplikasi SHALL diperluas dari aksen tunggal menjadi palet ceria multi-aksen yang dipakai secara bermakna — misalnya warna khas per mata pelajaran pada sampul catatan, kegiatan jadwal, dan badge — dengan aturan kontras yang tetap terjaga; aplikasi TIDAK SHALL lagi tampil monoton satu warna.

#### Scenario: Mata pelajaran berbeda berbeda warna

- **WHEN** pengguna membuka dashboard dengan catatan dari beberapa mata pelajaran berbeda
- **THEN** kartu catatan memperlihatkan variasi warna yang konsisten per mata pelajaran, bukan semua serupa

#### Scenario: Warna ceria tetap kontras

- **WHEN** palet warna ceria diterapkan pada teks, tombol, atau badge di mode terang maupun gelap
- **THEN** rasio kontras latar-teks tetap memenuhi WCAG AA

### Requirement: Status aktif sidebar mencakup sub-halaman

Navigasi samping SHALL menandai item menu sebagai aktif bukan hanya pada path persis, tetapi juga pada seluruh sub-halaman di bawahnya (mis. membuka detail catatan menyorot menu induknya), tepat satu item aktif dalam satu waktu.

#### Scenario: Membuka detail catatan menyorot menu Dashboard

- **WHEN** pengguna membuka `/dashboard/note/<id>` atau sub-halamannya
- **THEN** item "Dashboard" pada sidebar tampil sebagai aktif

#### Scenario: Hanya satu item aktif

- **WHEN** pengguna berpindah-pindah halaman area login
- **THEN** maksimal satu item menu sidebar bertanda aktif pada setiap saat

### Requirement: Prinsip anti-slop pada komponen UI

Komponen UI baru maupun yang disentuh perombakan ini SHALL menghindari pola generik khas AI (gradien ungu default, glow neon, shadow blur acak, copywriting kosong), dan SHALL tetap setia pada bahasa desain claymorphism aplikasi — bayangan solid tanpa blur, permukaan lembut, tipografi Nunito.

#### Scenario: Komponen baru mengikuti bahasa claymorphism

- **WHEN** komponen baru (pop-up, badge, kartu, tombol) ditambahkan ke area login
- **THEN** komponen memakai token desain aplikasi (bayangan solid clay, radius skala, palet resmi) tanpa gaya asing seperti glassmorphism atau gradien neon
