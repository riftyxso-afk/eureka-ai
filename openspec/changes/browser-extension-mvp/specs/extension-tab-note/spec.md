## Purpose

Mengubah konten tab aktif menjadi draft catatan yang diringkas dengan pertanyaan reflektif Socratic, lalu menyimpannya ke akun Eureka.AI agar muncul di dashboard web app.

## ADDED Requirements

### Requirement: Ekstrak konten tab menjadi draft catatan

Sistem SHALL mengekstrak judul, URL, dan konten relevan dari tab aktif atas aksi eksplisit pengguna, dan SHALL menampilkannya sebagai draft catatan yang dapat diedit sebelum disimpan.

#### Scenario: Draft dari artikel

- **WHEN** pengguna menekan tombol ekstensi saat berada di sebuah artikel
- **THEN** draft catatan muncul berisi judul, URL sumber, dan konten relevan halaman yang dapat diedit pengguna

#### Scenario: Halaman tanpa konten terbaca

- **WHEN** tab aktif tidak memiliki konten teks yang dapat diekstrak
- **THEN** ekstensi menampilkan pesan jelas bahwa halaman tersebut tidak dapat dijadikan catatan, bukan draft kosong

### Requirement: Ringkasan cerdas dengan refleksi Socratic

Draft catatan SHALL berisi ringkasan konten (bukan copy mentah) yang disisipi pertanyaan reflektif Socratic.

#### Scenario: Ringkasan bukan salinan

- **WHEN** draft catatan dibuat dari sebuah artikel panjang
- **THEN** isi draft berupa ringkasan poin-poin penting ditambah minimal satu pertanyaan reflektif, bukan salinan seluruh teks halaman

### Requirement: Sinkron ke dashboard dalam waktu singkat

Catatan yang dikonfirmasi pengguna SHALL tersimpan ke akun Eureka.AI dan muncul di dashboard web app dalam waktu kurang dari 5 detik pada koneksi normal.

#### Scenario: Simpan dan muncul di dashboard

- **WHEN** pengguna menekan simpan pada draft catatan
- **THEN** catatan tersebut muncul di dashboard eureka-ai.web.id dalam waktu kurang dari 5 detik

### Requirement: Tag domain otomatis

Setiap catatan dari ekstensi SHALL diberi tag otomatis berdasarkan domain atau topik halaman (misalnya Ruangguru → Matematika), yang dapat diubah pengguna sebelum menyimpan.

#### Scenario: Tag terisi otomatis

- **WHEN** draft catatan dibuat dari halaman Ruangguru bermuatan matematika
- **THEN** kolom tag sudah terisi "Matematika" dan pengguna dapat mengubahnya sebelum menyimpan
