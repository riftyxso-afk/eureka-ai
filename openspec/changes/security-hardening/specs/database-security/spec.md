## Purpose

Menjamin policy RLS (Row Level Security) di Supabase tidak mengekspos data pengguna lain atau kredensial akses ke publik, dengan akses minimal yang berbasis kepemilikan.

## ADDED Requirements

### Requirement: Tidak ada policy terbuka pada tabel data pengguna

Semua tabel yang memuat data pengguna (users, documents, notes, progress, quiz_rooms, quiz_room_participants, dan lainnya) WAJIB memiliki RLS aktif dan TIDAK boleh memiliki policy `SELECT`/`ALL USING (true)` yang membuat semua authenticated user bisa membaca baris milik siapa pun.

#### Scenario: Tidak ada SELECT publik pada tabel data pengguna
- **WHEN** admin mengaudit policy tabel data pengguna
- **THEN** tidak ditemukan policy dengan ekspresi `USING (true)` pada tabel users, documents, quiz_rooms, atau quiz_room_participants

#### Scenario: Pengguna hanya membaca baris miliknya
- **WHEN** user terautentikasi melakukan query langsung (mis. via Supabase client) ke tabel users atau documents
- **THEN** hanya baris milik user tersebut yang dapat dibaca

### Requirement: Kolom sensitif tidak terbaca lintas pengguna

Kolom sensitif — email, `profile_md`, `profile_data`, `host_key`, `participant_key`, dan kredensial lainnya — TIDAK boleh terbaca oleh pengguna lain, termasuk melalui query langsung ke Supabase. Akses ke kolom sensitif hanya melalui function `SECURITY DEFINER` yang membatasi kolom yang dikembalikan dan memvalidasi pemanggil.

#### Scenario: Email pengguna tidak terbaca pengguna lain
- **WHEN** user lain melakukan query langsung ke tabel users
- **THEN** kolom email, user_number, dan data sensitif lain tidak tersedia di hasil

#### Scenario: Kunci host kuis tidak terbaca publik
- **WHEN** siapa pun meng-query tabel quiz_rooms atau quiz_room_participants
- **THEN** nilai `host_key` dan `participant_key` tidak muncul di hasil, kecuali untuk pemilik resource melalui jalur akses yang sah

### Requirement: Visibilitas lintas pengguna hanya lewat function terbatas

Fitur yang sah membutuhkan visibilitas lintas pengguna (leaderboard, pencarian teman, profil publik) WAJIB berjalan lewat function `SECURITY DEFINER` yang hanya mengembalikan kolom publik yang diperlukan (nama tampilan, poin, username) dan TIDAK pernah mengembalikan baris lengkap atau kolom sensitif.

#### Scenario: Leaderboard hanya memuat kolom publik
- **WHEN** leaderboard diambil
- **THEN** hasil hanya memuat kolom publik (nama, poin) dan tidak memuat email, profile_data, atau kolom sensitif lain

#### Scenario: Query langsung tidak bisa menggantikan function
- **WHEN** pengguna mencoba membaca baris pengguna lain lewat query langsung tanpa function
- **THEN** query tersebut tidak mengembalikan data pengguna lain (ditolak RLS)