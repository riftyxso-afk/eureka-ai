# assistant-session-title Specification

## Purpose

Setiap sesi chat di `/chat` otomatis mendapat judul ringkas dari pesan pertama (di-generate AI, fallback potongan prompt) sehingga daftar riwayat chat mudah dipindai tanpa judul default yang seragam.

## Requirements

### Requirement: Judul sesi ter-generate otomatis dari pesan pertama

Sistem SHALL mengisi judul sesi chat yang masih default ("Percakapan baru") dari pesan user pertama: generate AI (3-6 kata, bahasa Indonesia) dengan fallback potongan prompt bila AI gagal. Generate berjalan fire-and-forget tanpa menunda jawaban chat, dan kegagalan WAJIB tercatat di log server (tidak gagal diam-diam).

#### Scenario: Pesan pertama memicu judul AI

- **WHEN** pesan user pertama tersimpan di sesi berjudul default
- **THEN** judul sesi terisi ringkasan AI dari pesan tersebut (atau potongan prompt bila AI gagal)

#### Scenario: Judul kustom tidak ditimpa

- **WHEN** sesi sudah memiliki judul bukan default (buatan user atau rename)
- **THEN** sistem TIDAK mengubah judul tersebut saat ada pesan baru

#### Scenario: Judul baru langsung terlihat di sidebar

- **WHEN** judul sesi berhasil diperbarui di database
- **THEN** daftar sesi di sidebar menampilkan judul baru tanpa perlu reload halaman

#### Scenario: Kegagalan generate tercatat

- **WHEN** generate AI maupun fallback gagal (mis. DB error)
- **THEN** error tercatat di log server dan sesi tetap berfungsi dengan judul lama
