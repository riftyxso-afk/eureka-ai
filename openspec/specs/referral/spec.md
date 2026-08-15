## Purpose

Program referral Eureka.AI: setiap pengguna dapat membagikan link referral unik; setelah 5 orang mendaftar lewat link tersebut, pengundang mendapatkan premium 30 hari (sekali pakai).

## Requirements

### Requirement: Kode referral unik per pengguna
Setiap pengguna HARUS memiliki kode referral unik (dibuat saat akun dibuat atau saat pertama kali dibutuhkan). Kode bersifat case-insensitive saat dicocokkan dan tidak mengandung karakter ambigu.

#### Scenario: Dua pengguna punya kode berbeda
- WHEN dua pengguna membuat akun
- THEN masing-masing memiliki kode referral yang berbeda satu sama lain

#### Scenario: Pencocokan kode tidak sensitif huruf
- WHEN seseorang mengunjungi link dengan kode dalam huruf besar/kecil yang berbeda
- THEN kode tetap dikenali sebagai pengundang yang sama

### Requirement: Atribusi pendaftaran lewat link referral
Link referral berisi kode pengundang. Saat pengguna baru mendaftar melalui link tersebut (kode terbawa dari klik link hingga proses registrasi selesai), akunnya TERCATAT sebagai rujukan dari kode itu. Pendaftaran yang tidak melalui link (mis. langsung buka situs) TIDAK terhitung sebagai rujukan siapa pun.

#### Scenario: Registrasi lewat link tercatat
- WHEN pengguna baru mendaftar dengan membuka link referral pengundang A
- THEN akun baru tercatat sebagai rujukan A

#### Scenario: Registrasi langsung tidak teratribusi
- WHEN pengguna baru mendaftar langsung tanpa membuka link referral
- THEN tidak ada atribusi rujukan ke siapa pun

### Requirement: Penghitungan rujukan valid & reward 30 hari sekali pakai
Rujukan dihitung hanya untuk pendaftaran yang VALID: email unik (belum pernah terdaftar), bukan akun milik pengundang sendiri, dan pengundang bukan akun yang sama. Setelah mencapai 5 rujukan valid, pengundang HARUS menerima premium 30 hari. Reward hanya diberikan SEKALI — rujukan setelahnya tidak memberi reward tambahan.

#### Scenario: Mencapai 5 rujukan valid
- WHEN pengundang A memiliki 5 pendaftaran valid yang tercatat lewat linknya
- THEN A menerima premium 30 hari

#### Scenario: Reward tidak berulang
- WHEN pengundang A yang sudah menerima reward mendapat rujukan ke-6 dan seterusnya
- THEN A tidak menerima reward premium tambahan

#### Scenario: Pendaftaran tidak valid tidak dihitung
- WHEN pendaftaran memakai email yang sudah terdaftar atau akun milik pengundang sendiri
- THEN pendaftaran tersebut tidak dihitung sebagai rujukan valid

### Requirement: Anti penyalahgunaan
Sistem HARUS mencegah pengundang mereferensikan dirinya sendiri (akun kedua dengan email berbeda milik orang yang sama tidak dapat dideteksi, tetapi akun dengan email yang sama atau akun yang sama TIDAK boleh dihitung). Satu alamat email hanya boleh dihitung sebagai rujukan satu kali.

#### Scenario: Self-referral ditolak
- WHEN pengguna A mencoba mendaftarkan akun kedua dengan email yang sama lewat link sendiri
- THEN pendaftaran tidak dihitung sebagai rujukan A

#### Scenario: Email duplikat tidak dihitung dua kali
- WHEN satu email mendaftar lewat link A lebih dari satu kali
- THEN email tersebut hanya dihitung sebagai satu rujukan

### Requirement: UI status referral
Pengguna HARUS dapat melihat link referral miliknya, jumlah pendaftaran valid yang sudah tercapai (x/5), dan status reward (belum/sudah diterima) di dalam aplikasi (halaman profil/dashboard). Informasi ini hanya untuk pengguna yang bersangkutan.

#### Scenario: Pengguna melihat progres referral
- WHEN pengguna membuka halaman status referral
- THEN ia melihat link referralnya, jumlah rujukan valid (x/5), dan status reward

#### Scenario: Reward tercermin di status premium
- WHEN pengundang menerima reward referral
- THEN status premium pengundang aktif 30 hari dan tampil seperti premium dari jalur lain
