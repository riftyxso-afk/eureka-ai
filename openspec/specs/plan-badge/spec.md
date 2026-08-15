# plan-badge Specification

## Purpose

Menampilkan badge status paket langganan (Pro/Trial/Free) kepada user di antarmuka aplikasi agar status premium terlihat jelas di mana pun user berada.

## Requirements

### Requirement: Badge status paket di sidebar

Antarmuka SHALL menampilkan badge status paket user di sidebar (pada chip nama user): badge `Pro` (menonjol, warna emas + ikon mahkota) untuk user premium berbayar, `Trial` untuk user dengan premium trial, dan `Free` (abu-abu) untuk user non-premium. Status SHALL bersumber dari server (`GET /api/payments/status`), bukan localStorage, dan diperbarui saat status berubah.

#### Scenario: User premium
- **WHEN** user premium (tier normal/promo) membuka aplikasi
- **THEN** sidebar menampilkan badge "Pro" di samping nama user

#### Scenario: User dalam masa trial
- **WHEN** user dengan premium tier trial membuka aplikasi
- **THEN** sidebar menampilkan badge "Trial" di samping nama user

#### Scenario: User free
- **WHEN** user tanpa langganan aktif membuka aplikasi
- **THEN** sidebar menampilkan badge "Free" di samping nama user

### Requirement: Badge status paket di halaman Profil

Antarmuka SHALL menampilkan badge status paket di halaman Profil bersama info akun user, dengan label yang konsisten dengan sidebar dan bersumber dari status premium server yang sama.

#### Scenario: Halaman Profil menampilkan status paket
- **WHEN** user membuka halaman Profil
- **THEN** halaman menampilkan badge status paket (Pro/Trial/Free) sesuai status premium aktual dari server
