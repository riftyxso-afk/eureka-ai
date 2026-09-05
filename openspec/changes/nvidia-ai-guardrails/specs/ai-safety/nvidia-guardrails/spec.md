## Purpose

Integrasi NVIDIA NeMo Guardrails sebagai safety layer multi-layer untuk semua interaksi AI di Eureka.AI, menyediakan content moderation real-time, jailbreak detection, topic control, dan PII detection menggunakan model AI safety terdepan.

## ADDED Requirements

### Requirement: Content moderation dengan model safety NVIDIA
Sistem SHALL menggunakan model safety via NVIDIA NIM (default Nemotron Safety Guard 8B V3 yang terverifikasi live; LlamaGuard-7b dapat dipilih via NIM_MODERATION_MODEL) untuk memoderasi konten input dan output AI. Model mendeteksi 23 kategori keamanan termasuk toxicity, hate speech, harassment, dan violence.

#### Scenario: Input mengandung konten toxic
- **WHEN** user mengirim pesan yang mengandung toxicity atau hate speech
- **THEN** sistem memblokir pesan dan mengembalikan pesan error yang sopan

#### Scenario: Output AI mengandung konten berbahaya
- **WHEN** respons AI mengandung konten yang terdeteksi sebagai unsafe oleh LlamaGuard
- **THEN** sistem memblokir output dan menggantinya dengan pesan penolakan yang sesuai

#### Scenario: Input dan output aman
- **WHEN** tidak ada konten berbahaya yang terdeteksi
- **THEN** sistem memproses request normal tanpa intervensi

### Requirement: Jailbreak detection dengan Nemotron Safety Guard
Sistem SHALL menggunakan Llama 3.1 Nemotron Safety Guard 8B V3 untuk mendeteksi upaya jailbreak dan prompt injection. Model ini mendukung 9 bahasa termasuk Indonesia.

#### Scenario: User mencoba jailbreak
- **WHEN** user mengirim prompt yang mencoba bypass guardrail (mis. "ignore previous instructions")
- **THEN** sistem mendeteksi sebagai jailbreak attempt dan memblokir request

#### Scenario: Prompt injection dari materi
- **WHEN** materi yang di-upload mengandung instruksi tersembunyi yang mencoba mengubah perilaku AI
- **THEN** sistem mendeteksi dan memperlakukan materi sebagai data biasa

### Requirement: Topic control untuk edukasi
Sistem SHALL memastikan percakapan tetap pada topik edukasi. Topic control model akan mendeteksi dan memblokir percakapan yang menyimpang ke topik tidak pantas.

#### Scenario: Percakapan menyimpang dari edukasi
- **WHEN** user mencoba mengalihkan percakapan ke topik non-edukasi (mis. politik, konten dewasa)
- **THEN** sistem mengarahkan kembali ke topik edukasi dengan sopan

#### Scenario: Percakapan tetap relevan
- **WHEN** percakapan tentang materi pelajaran
- **THEN** sistem membiarkan percakapan berlanjut normal

### Requirement: PII detection dan blocking
Sistem SHALL mendeteksi dan memblokir upaya ekstraksi data pribadi dari respons AI.

#### Scenario: User meminta data pribadi
- **WHEN** user bertanya tentang email, nomor telepon, atau data sensitif lain
- **THEN** sistem memblokir respons yang mengandung PII

#### Scenario: AI tidak sengaja menyebutkan PII
- **WHEN** respons AI mengandung data pribadi yang terdeteksi
- **THEN** sistem scrub PII dari output sebelum dikirim ke user

### Requirement: Safety logging untuk audit
Sistem SHALL mencatat semua safety events (blocked attempts, detected threats) untuk keperluan audit dan monitoring.

#### Scenario: Safety event terjadi
- **WHEN** sistem memblokir konten atau mendeteksi threat
- **THEN** event dicatat dengan timestamp, type, severity, dan konteks (tanpa PII user)

#### Scenario: Safety metrics dashboard
- **WHEN** admin mengakses safety dashboard
- **THEN** dashboard menampilkan metrics: total requests, blocked attempts, threat types, dan trends

### Requirement: Fallback ke rules existing
Sistem SHALL tetap mempertahankan guardrail berbasis prompt rules sebagai fallback jika NIM service tidak tersedia.

#### Scenario: NIM service down
- **WHEN** NVIDIA NIM service tidak dapat diakses
- **THEN** sistem menggunakan rules existing dan mencatat incident

#### Scenario: NIM service recovery
- **WHEN** NIM service kembali tersedia
- **THEN** sistem otomatis beralih ke NIM guardrails
