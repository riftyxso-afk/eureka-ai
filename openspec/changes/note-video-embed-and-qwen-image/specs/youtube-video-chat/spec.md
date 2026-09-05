## MODIFIED Requirements

### Requirement: Embed video di halaman catatan

Sistem SHALL menampilkan player video YouTube di halaman `/dashboard/note/[id]` untuk SEMUA pengguna (tanpa gerbang beta) ketika catatan tersebut memuat sumber YouTube — URL sumber dipilih dari sumber YouTube MANAPUN dalam daftar sumber catatan (tidak hanya sumber pertama) — sehingga pengguna bisa menonton video sambil membaca catatan dan bertanya kepada AI tentang materinya.

#### Scenario: Catatan bersumber YouTube menampilkan player

- **WHEN** pengguna membuka halaman catatan yang bersumber dari video YouTube
- **THEN** player video tampil di halaman catatan (click-to-play) beserta akses tanya-jawab AI tentang materi catatan tersebut

#### Scenario: Player tampil untuk semua pengguna

- **WHEN** pengguna non-beta membuka catatan bersumber YouTube
- **THEN** player video tetap tampil (fitur tidak lagi dibatasi beta)

#### Scenario: Catatan multi-sumber yang memuat YouTube

- **WHEN** catatan dibuat dari beberapa sumber dan salah satunya (di posisi berapa pun) adalah link YouTube
- **THEN** halaman catatan menampilkan player untuk video tersebut

#### Scenario: Catatan bukan dari YouTube tidak menampilkan player

- **WHEN** pengguna membuka halaman catatan yang sumbernya bukan YouTube
- **THEN** tidak ada player video yang tampil dan tidak ada perubahan pada tata letak halaman
