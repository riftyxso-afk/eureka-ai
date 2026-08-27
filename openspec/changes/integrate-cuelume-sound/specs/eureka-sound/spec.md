## Purpose

Menyediakan sistem suara terpusat Eureka yang memainkan feedback audio (completion, celebration, level-up) secara konsisten di seluruh aplikasi via adapter cuelume dengan unlock yang ramah iOS.

## ADDED Requirements

### Requirement: Inisialisasi dan unlock audio via cuelume

Sistem SHALL menginisialisasi engine cuelume sekali saat aplikasi dimuat, SHALL membuka kunci AudioContext pada gestur pengguna pertama (`pointerdown`, `keydown`, `touchend`) agar iOS/Android mengizinkan pemutaran, dan SHALL gagal secara silent tanpa error jika `AudioContext` tidak tersedia.

#### Scenario: Unlock pada gestur pertama
- **WHEN** pengguna melakukan tap atau tekan tombol pertama di aplikasi
- **THEN** sistem membuka kunci audio dan menandai `unlocked=true` sehingga pemutaran berikutnya tidak butuh gestur

#### Scenario: AudioContext tidak tersedia
- **WHEN** browser tidak mendukung `AudioContext`/`webkitAudioContext`
- **THEN** panggilan sound apapun tidak melempar error dan tidak memutar suara

### Requirement: Memutar suara completion ding-dong

Sistem SHALL menyediakan `playCompletionSound()` yang memainkan cue "ding-dong" E5 (659.25Hz, 0.4s) → A5 (880Hz, 0.6s) via cuelume, dengan volume 0.3, dan SHALL dipanggil otomatis saat catatan selesai di-background (`CreateNoteModal` + `JobWatcher`).

#### Scenario: Catatan selesai
- **WHEN** job `processNoteForBackground` selesai dan `note` berstatus `done`
- **THEN** sistem memanggil `playCompletionSound()` dan pengguna mendengar ding-dong, tanpa memblokir UI

#### Scenario: Dipanggil tanpa unlock
- **WHEN** `playCompletionSound()` dipanggil sebelum gestur pertama
- **THEN** sistem mencoba `resume()` AudioContext dan tetap gagal silent jika masih suspended

### Requirement: Memutar suara celebration fanfare

Sistem SHALL menyediakan `playCelebrationSound()` yang memainkan fanfare C5→E5→G5→C6 (523/659/783/1046Hz) via cuelume dengan durasi 0.22s+0.22s+0.22s+0.55s.

#### Scenario: Onboarding selesai
- **WHEN** pengguna menyelesaikan onboarding
- **THEN** sistem memanggil `playCelebrationSound()` dan fanfare terdengar

### Requirement: Memutar suara level-up

Sistem SHALL menyediakan `playLevelUpSound()` yang memainkan arpeggio naik 392→523→659→783→1046→1318Hz via cuelume dengan pola energik.

#### Scenario: Level naik
- **WHEN** sistem mendeteksi `recordActivity` mencapai threshold level baru
- **THEN** sistem memanggil `playLevelUpSound()` sekali

### Requirement: Hormati preferensi dan gagal silent

Sistem SHALL menghormati `soundEnabled=false` (jika ada preferensi user) dengan tidak memutar suara apapun, SHALL menghormati `prefers-reduced-motion` sebagai sinyal untuk mengurangi volume/durasi, dan SHALL tidak pernah menampilkan error UI jika pemutaran gagal.

#### Scenario: Sound dimatikan user
- **WHEN** preferensi `soundEnabled` adalah `false`
- **THEN** panggilan `play*Sound()` tidak memutar apapun dan tidak error

#### Scenario: Pemutaran gagal karena browser block
- **WHEN** `playTone` melempar exception
- **THEN** sistem menangkap dan mengabaikan tanpa toast atau console error yang mengganggu
