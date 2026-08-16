## Purpose

Memungkinkan pengguna menyematkan (pin) catatan agar tampil paling atas di dashboard, dengan status pin yang tersimpan di database dan konsisten lintas perangkat.

## ADDED Requirements

### Requirement: Pin dan unpin catatan dari dashboard

Sistem SHALL memungkinkan pengguna menyematkan dan melepas sematan catatan dari kartu catatan di dashboard, dan SHALL menyimpan status pin per catatan per pengguna di database.

#### Scenario: Menyematkan catatan

- **WHEN** pengguna menekan kontrol pin pada kartu catatan
- **THEN** status catatan berubah menjadi tersemat, tersimpan di database, dan indikator pin pada kartu berubah

#### Scenario: Melepas sematan catatan

- **WHEN** pengguna menekan kontrol pin pada catatan yang sudah tersemat
- **THEN** status catatan menjadi tidak tersemat dan tersimpan di database

### Requirement: Catatan tersemat tampil paling atas

Sistem SHALL menampilkan catatan tersemat di bagian atas daftar catatan dashboard, sebelum catatan yang tidak tersemat, pada semua mode penyortiran yang tersedia.

#### Scenario: Daftar catatan dengan campuran pin dan non-pin

- **WHEN** pengguna membuka dashboard dengan beberapa catatan tersemat dan beberapa tidak
- **THEN** semua catatan tersemat tampil paling atas (urutan antar-catatan tersemat mengikuti urutan normal), disusul catatan tidak tersemat

#### Scenario: Filter pencarian tidak menghilangkan urutan pin

- **WHEN** pengguna mencari catatan dengan kata kunci tertentu
- **THEN** hasil yang cocok tetap menampilkan catatan tersemat di atas catatan tidak tersemat

### Requirement: Pin persisten lintas perangkat

Status pin catatan SHALL tersimpan di database sehingga tetap berlaku ketika pengguna membuka dashboard dari perangkat atau sesi lain dengan akun yang sama.

#### Scenario: Pin terlihat di perangkat lain

- **WHEN** pengguna menyematkan catatan lalu membuka dashboard dari perangkat lain dengan akun yang sama
- **THEN** catatan tersebut tetap tampil tersemat dan berada di atas daftar
