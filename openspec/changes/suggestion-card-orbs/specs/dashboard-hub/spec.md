## ADDED Requirements

### Requirement: Kartu saran menampilkan feedback skill terintegrasi

Dashboard SHALL memperluas perilaku dua kartu saran di AssistantHub dari sekadar mengisi composer menjadi menampilkan indikator skill/loading terintegrasi di dalam kartu itu sendiri, sesuai pemetaan skill masing-masing kartu.

#### Scenario: Kartu saran menunjukkan skill sebelum mengirim
- **WHEN** pengguna mengklik salah satu kartu saran ("Tanya Apa Sasa" atau "Kerjakan Tugas")
- **THEN** kartu tersebut menampilkan orb dan label skill yang sesuai di dalam batas kartu sebelum navigasi atau pengiriman terjadi
