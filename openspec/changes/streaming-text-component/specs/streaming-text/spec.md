## Purpose

Menampilkan jawaban AI yang streaming kata-per-kata dengan inline citation chip, daftar sumber expandable, bar aksi, dan follow-up prompts agar pengguna melihat sumber dan langkah selanjutnya tanpa menunggu jawaban selesai.

## ADDED Requirements

### Requirement: Streaming kata-per-kata dengan inline citation

Sistem SHALL merender `content` yang di-split per kata dengan interval `WORD_MS=55`, menampilkan `SourceChip` inline untuk token `cite`, dan kursor kedip saat `!done`.

#### Scenario: Streaming words
- **WHEN** `content` berisi 10 kata dan `count=5`
- **THEN** 5 kata pertama tampil, kata ke-6 belum, dan kursor kedip terlihat

#### Scenario: Inline citation chip
- **WHEN** token `cite=true` di posisi ke-5
- **THEN** pada posisi kata ke-5 tampil `SourceChip` untuk `sources[0]` (domain `scoopdata.io`)

### Requirement: Bar aksi dan sources toggle

Sistem SHALL menampilkan bar aksi (copy/retry/up/down) dan tombol `10 sources` dengan avatar stack hanya saat `done=true`; klik toggle membuka daftar sumber expandable dengan `grid-template-rows`.

#### Scenario: Bar aksi hanya saat done
- **WHEN** `done=false` (masih streaming)
- **THEN** bar aksi `opacity:0` dan `pointerEvents:none`

#### Scenario: Toggle sources
- **WHEN** user klik `10 sources` saat `done=true`
- **THEN** daftar 3 sumber (`Scoop Data` etc.) mengembang dengan `grid 1fr` dan `opacity 1`

### Requirement: Daftar sumber expandable

Sistem SHALL merender daftar sumber sebagai link `a` ke `href` dengan `target="_blank"`, menampilkan `image`, `name`, dan `domain` mono, dan `+7 more` tidak ada di snippet tapi di-spec asli.

#### Scenario: Klik source link
- **WHEN** user klik `Joy Cone` row
- **THEN** browser buka `https://joycone.com/fs_products/waffle-cones/` di tab baru

### Requirement: Follow-up prompts

Sistem SHALL menampilkan heading `Follow-ups` dan 2 tombol follow-up (`Which flavors...`, `Compare gelato...`) hanya saat `done=true`, dengan animasi `fade-up` stagger `90ms`.

#### Scenario: Follow-up click
- **WHEN** user klik `Which flavors sell best in winter`
- **THEN** `onFollowUp` dipanggil dengan `(text, 0)` dan bubble baru terkirim

#### Scenario: Loop handling
- **WHEN** `loop=true` dan `done` tercapai setelah `HOLD_MS=3400`
- **THEN** `count` reset ke `0` dan streaming mulai lagi

#### Scenario: Fill mode
- **WHEN** `fill=true`
- **THEN** container pakai `w-full` bukan `max-w-95` dan `min-h` tidak diterapkan
