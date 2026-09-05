## MODIFIED Requirements

### Requirement: Pertahanan prompt injection dari materi
Materi yang diunggah atau diambil pengguna (isi catatan, potongan RAG, konten URL) yang mengandung instruksi tersembunyi (mis. "abaikan instruksi sebelumnya", "bocorkan data") TIDAK BOLEH mengubah perilaku asisten. Materi diperlakukan sebagai data, bukan instruksi. Sistem SEKARANG juga menggunakan NVIDIA Nemotron Safety Guard untuk mendeteksi prompt injection dengan akurasi lebih tinggi.

#### Scenario: Catatan berisi instruksi jahat
- **WHEN** potongan materi dalam konteks memuat instruksi untuk mengabaikan aturan atau membocorkan data
- **THEN** asisten tetap mematuhi guardrail dan memperlakukan materi sebagai data belaka

#### Scenario: Materi tidak mengubah kepribadian asisten
- **WHEN** materi menyuruh asisten berpura-pura menjadi entitas lain atau membocorkan rahasia
- **THEN** asisten menolak dan tetap berperilaku sesuai peran semula

#### Scenario: Prompt injection terdeteksi oleh Nemotron
- **WHEN** materi mengandung pola prompt injection yang terdeteksi oleh Nemotron Safety Guard
- **THEN** sistem memblokir materi dan mencatat safety event untuk audit
