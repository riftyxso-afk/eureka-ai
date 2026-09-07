# Spec Delta: multi-agent-loop

## ADDED Requirements

### Requirement: Toggle Eureka Multi Agent di prompt box

Prompt box SHALL menyediakan pill toggle "Eureka Multi Agent" di sebelah tombol kirim dengan dua visual state: OFF = clay-surface netral dengan ikon spark outline; ON = solid `--accent-coral` dengan ikon spark filled dan label tetap terlihat. Scope aktivasi SHALL per-topik/sesi (tetap ON sampai goal tercapai, max iterasi, atau dimatikan manual); state toggle terakhir DIPERTAHANKAN saat ganti topik.

#### Scenario: Menyalakan toggle

- **WHEN** user menyalakan pill Eureka Multi Agent di prompt box
- **THEN** pill berubah solid `--accent-coral` dengan ikon spark filled, dan state itu berlaku untuk topik/sesi berjalan

#### Scenario: Ganti topik

- **WHEN** user pindah ke topik lain dalam sesi yang sama
- **THEN** state toggle terakhir dipertahankan

### Requirement: Loop state machine persisten

Loop multi-agent SHALL mengikuti siklus: gather_context (Kompas baca topik, mastery, riwayat jawaban) → act (Socra ajukan pertanyaan/langkah) → observe (tangkap jawaban siswa) → reflect (Lensa nilai jawaban, update mastery) → decide (Kompas: `continue_loop | goal_reached | max_iterations | user_stopped | manual_exit`). State loop SHALL disimpan persisten (tahan refresh/reconnect), bukan hanya di memory server.

#### Scenario: Loop berjalan lintas refresh

- **WHEN** user me-refresh halaman di tengah loop aktif
- **THEN** state loop (fase, iterasi ke-n, topik) dimuat ulang dari store persisten dan loop berlanjut dari posisi terakhir

#### Scenario: Satu siklus penuh

- **WHEN** siswa menjawab pertanyaan Socra saat loop ON
- **THEN** Lensa menilai jawaban dan meng-update mastery, lalu Kompas memutuskan langkah berikutnya berdasarkan skor dan config

### Requirement: Berhenti instan saat toggle dimatikan

Saat toggle dimatikan di tengah loop, loop SHALL berhenti instan pada respons berikutnya — iterasi yang sedang berjalan SHALL NOT dilanjutkan setelah stop.

#### Scenario: User mematikan toggle di tengah iterasi

- **WHEN** user mematikan toggle Eureka Multi Agent saat iterasi sedang berjalan
- **THEN** respons berikutnya tidak melanjutkan iterasi, dan indikator loop hilang

### Requirement: Indikator iterasi di chat

UI chat SHALL menampilkan indikator iterasi (mis. "Iterasi 2/8") selama loop aktif, dan indikator SHALL hilang otomatis saat loop selesai.

#### Scenario: Loop selesai

- **WHEN** Kompas memutuskan `goal_reached`, `max_iterations`, `user_stopped`, atau `manual_exit`
- **THEN** indikator iterasi hilang dari chat dan keputusan tercatat di log

### Requirement: Guardrail loop

Loop SHALL memiliki: max iterasi default 6–8 per topik yang configurable; exit signal manual (mis. "udah paham" / "skip") yang menghentikan loop kapan saja; cap token/biaya harian per user dengan fallback pesan ramah berbahasa Indonesia saat kuota habis; logging tiap iterasi (goal, pertanyaan, jawaban, skor, keputusan); dan feature flag per user yang TIDAK default ON.

#### Scenario: Max iterasi tercapai

- **WHEN** iterasi aktif mencapai batas max yang dikonfigurasi
- **THEN** Kompas menutup loop dengan keputusan `max_iterations` dan pesan penutup yang wajar

#### Scenario: Kuota harian habis

- **WHEN** cap token/biaya harian user terlampaui saat loop berjalan
- **THEN** loop berhenti dengan pesan ramah yang menjelaskan kuota habis, bukan error mentah

#### Scenario: Fitur belum diaktifkan untuk user

- **WHEN** user tanpa feature flag multi-agent membuka prompt box
- **THEN** toggle Eureka Multi Agent tidak ditampilkan
