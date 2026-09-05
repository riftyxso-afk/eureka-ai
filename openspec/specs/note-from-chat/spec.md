# note-from-chat Specification

## Purpose

Lets users create a study note directly from the chat page by asking "buatkan catatan" in the composer, generating the note from the topic being discussed in the ongoing conversation.

## Requirements

### Requirement: Pembuatan catatan dari chat tetap terdeteksi

Sistem SHALL tetap menangkap permintaan "buat catatan" yang diketik pengguna di composer halaman `/chat/[id]` (mis. "buatkan catatan tentang …", "buat catatan dari https://…") dan SHALL mengarahkannya ke alur pembuatan catatan, bukan mengirimnya sebagai pesan chat biasa ke AI.

#### Scenario: Prompt buat catatan memicu alur pembuatan

- **WHEN** pengguna mengetik permintaan buat catatan di composer lalu mengirim
- **THEN** alur pembuatan catatan (wizard/overlay progres) terbuka dan prompt tidak dikirim sebagai pesan chat ke AI

#### Scenario: Permintaan dengan URL sumber tetap berjalan seperti biasa

- **WHEN** pengguna meminta catatan dengan menyertakan link (YouTube/web) di prompt
- **THEN** URL tersebut tetap menjadi sumber utama catatan seperti perilaku sebelumnya

### Requirement: Konteks percakapan menjadi materi sumber catatan

Sistem SHALL menyertakan riwayat percakapan terkini dari sesi chat sebagai konteks materi tambahan saat membuat catatan atas permintaan pengguna di `/chat/[id]`, sehingga catatan digenerate sesuai topik yang sedang dibahas dalam percakapan. Riwayat yang dikirim WAJIB berupa materi valid (tidak null/kosong) — pesan placeholder optimis/streaming yang masih kosong WAJIB disaring sebelum dibangun menjadi file sumber — dan bila tidak ada materi valid sama sekali, sistem WAJIB menolak eksplisit dengan pesan yang jelas alih-alih membuat catatan null/error diam-diam.

#### Scenario: Catatan mengikuti topik diskusi

- **WHEN** pengguna berdiskusi panjang tentang suatu topik di chat lalu meminta "buatkan catatan"
- **THEN** catatan yang dibuat memuat materi sesuai topik diskusi tersebut, dengan riwayat percakapan sebagai salah satu sumber materinya

#### Scenario: Sesi tanpa riwayat yang cukup

- **WHEN** pengguna meminta buat catatan di sesi yang belum memiliki percakapan berarti
- **THEN** sistem tetap membuat catatan dari prompt/topik yang diketik (perilaku lama) tanpa error

#### Scenario: Konteks percakapan dipotong jika terlalu panjang

- **WHEN** riwayat percakapan sangat panjang melebihi batas konteks
- **THEN** sistem memakai bagian riwayat terkini yang terbatas sebagai konteks dan tetap berhasil membuat catatan

#### Scenario: Pesan placeholder kosong disaring dari materi

- **WHEN** riwayat memuat pesan optimis/placeholder streaming yang kontennya masih kosong
- **THEN** pesan-pesan tersebut disaring sehingga tidak menjadi materi sumber null

#### Scenario: Materi kosong ditolak eksplisit

- **WHEN** setelah penyaringan tidak tersisa materi valid sama sekali (transkrip kosong dan topik kosong)
- **THEN** sistem menampilkan pesan kesalahan yang jelas ("tidak ada materi untuk dibuat catatan") dan TIDAK membuat catatan null atau job error diam-diam

### Requirement: Hasil catatan sesuai topik dan dapat diakses

Sistem SHALL menghasilkan catatan utuh (judul, ringkasan, dan bab-bab) yang mencerminkan topik percakapan, dan SHALL membawa pengguna ke halaman catatan yang baru dibuat setelah proses selesai, dengan umpan balik progres yang sama seperti alur pembuatan catatan yang ada.

#### Scenario: Selesai membuat → menuju halaman catatan

- **WHEN** proses pembuatan catatan dari percakapan selesai
- **THEN** pengguna diarahkan ke halaman catatan baru tersebut

#### Scenario: Kegagalan pembuatan ditampilkan

- **WHEN** proses pembuatan catatan dari percakapan gagal
- **THEN** sistem menampilkan pesan kesalahan yang jelas dan pengguna dapat mencoba lagi atau membatalkan, tanpa kehilangan percakapan chat
