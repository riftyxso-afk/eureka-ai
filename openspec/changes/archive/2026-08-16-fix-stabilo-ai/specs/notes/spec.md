## ADDED Requirements

### Requirement: Stabilo AI menandai poin penting tanpa kacau

Sistem SHALL menghasilkan stabilo otomatis (userId "ai") yang hanya menandai poin-poin penting dari isi bab catatan, dengan pencocokan teks yang ketat ke konten asli, panjang segmen yang wajar, tanpa tumpang tindih antar-highlight, dan kepadatan yang dijaga agar tidak seluruh teks tersorot.

#### Scenario: Teks hasil AI cocok persis dengan konten bab

- **WHEN** AI mengembalikan kandidat stabilo yang teksnya cocok persis (dengan perbedaan spasi/gaya saja) dengan isi bab
- **THEN** stabilo disimpan dengan teks persis dari konten bab dan tampil tersorot pada posisi yang benar

#### Scenario: Teks hasil AI tidak cocok dengan konten bab

- **WHEN** kandidat stabilo dari AI tidak ditemukan di isi bab (termasuk setelah normalisasi spasi)
- **THEN** kandidat tersebut diabaikan dan TIDAK menghasilkan stabilo di kalimat lain yang mirip, sehingga tidak ada sorotan di tempat yang tidak dimaksud

#### Scenario: Kandidat terlalu pendek atau terlalu panjang

- **WHEN** kandidat stabilo lebih pendek dari batas minimum atau lebih panjang dari batas maksimum panjang segmen
- **THEN** kandidat diabaikan, sehingga stabilo tetap berupa frasa/kalimat singkat dan bukan paragraf utuh

#### Scenario: Dua kandidat saling tumpang tindih pada bab yang sama

- **WHEN** dua kandidat stabilo pada bab yang sama saling beririsan atau satu menjadi bagian dari yang lain
- **THEN** hanya satu yang disimpan (yang lebih panjang/prioritas), sehingga sorotan tidak bertumpuk dan tampilan tetap rapi

#### Scenario: Kepadatan stabilo dibatasi

- **WHEN** jumlah stabilo pada satu bab atau satu catatan melebihi batas kepadatan
- **THEN** kelebihan kandidat diabaikan sehingga hanya sebagian kecil teks yang tersorot, tidak hampir seluruh isi catatan

#### Scenario: Regenerasi stabilo tidak menggandakan

- **WHEN** pengguna menjalankan stabilo AI lagi pada catatan yang sudah memiliki stabilo AI
- **THEN** stabilo AI lama dihapus lalu yang baru disimpan tanpa duplikat, dan jumlah total stabilo tetap dalam batas
