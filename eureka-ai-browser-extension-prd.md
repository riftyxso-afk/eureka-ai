# PRD: Eureka.AI Browser Extension

**Produk:** Eureka.AI Browser Extension
**Platform:** Chrome / Edge (Manifest V3), ekspansi ke Firefox di fase lanjutan
**Owner:** Radzz (I Wayan Radea)
**Tanggal:** 3 September 2026
**Status:** Draft v1

---

## 1. Latar Belakang

Eureka.AI adalah AI Socratic tutor untuk siswa Indonesia — model belajar yang menuntun siswa berpikir lewat pertanyaan, bukan langsung memberi jawaban. Saat ini pengalaman terbatas di web app (eureka-ai.web.id), yang berarti siswa harus copy-paste soal dari platform lain (Google Classroom, Quipper, Ruangguru, PDF, YouTube) ke web app secara manual.

Ekstensi browser menghilangkan friksi ini: Eureka hadir di mana pun siswa belajar, tanpa pindah tab.

## 2. Masalah yang Diselesaikan

- Siswa belajar tersebar di banyak platform (LMS, video, PDF, artikel) — konteks belajar terfragmentasi
- Copy-paste manual ke web app itu lambat dan mengurangi niat pakai Eureka secara konsisten
- Godaan besar untuk pakai AI "jawaban instan" (ChatGPT, dsb) alih-alih belajar — Eureka perlu hadir di titik keputusan itu juga
- Tidak ada cara mudah mencatat/menyimpan progres belajar lintas sumber

## 3. Target Pengguna

Siswa SMP–SMA dan mahasiswa awal di Indonesia yang mengerjakan tugas/belajar mandiri secara online, sudah familiar dengan Chrome sebagai browser utama.

## 4. Tujuan & Metrik Sukses

| Tujuan | Metrik |
|---|---|
| Tingkatkan retensi harian Eureka.AI | DAU/MAU ratio dari pengguna yang install extension |
| Kurangi friksi mulai sesi belajar | Waktu dari "buka soal" ke "mulai sesi Socratic" |
| Bangun kebiasaan (habit loop) | % pengguna dengan streak ≥3 hari dalam 2 minggu pertama |
| Validasi diferensiasi anti-cheat | % pengguna yang mengaktifkan block/warn mode |

## 5. Lingkup Fitur

### 5.1 MVP (Fase 1 — target rilis awal)

| # | Fitur | Deskripsi | Prioritas |
|---|---|---|---|
| 1 | Highlight-to-Tanya | Select teks di halaman apa pun → klik kanan → "Tanya Eureka" → side panel muncul dengan pertanyaan Socratic | Must have |
| 2 | Side Panel Persistent Chat | Panel chat yang nempel di browser (Chrome Side Panel API), sesi tetap ada saat pindah tab | Must have |
| 3 | Tab-to-Note | Ekstrak judul, URL, konten relevan dari tab aktif → jadi draft catatan | Must have |
| 4 | Smart Summarize | Draft catatan diringkas + disisipi pertanyaan reflektif Socratic, bukan copy mentah | Must have |
| 5 | Sinkron Catatan ke Web App | Catatan otomatis tersimpan ke akun Eureka.AI, muncul di dashboard | Must have |
| 6 | Auto-tagging Domain | Tag otomatis berdasarkan domain/topik halaman (mis. Ruangguru → Matematika) | Should have |
| 7 | Daily Streak Badge | Badge counter di icon toolbar untuk streak harian | Should have |

**Di luar scope MVP:** homework detector otomatis per-platform, OCR screenshot, voice mode, on-device grading, fingerprinting soal lintas user — semua butuh infra tambahan (OCR service, model lokal, DB kemiripan soal) yang belum perlu divalidasi di tahap awal.

### 5.2 Fase 2 (Pasca-validasi MVP)

| # | Fitur | Catatan |
|---|---|---|
| 8 | Homework Detector | Deteksi konteks tugas di Classroom/Quipper/Ruangguru via DOM parsing per-platform |
| 9 | Highlight → Tambah ke Catatan | Shortcut dari flow highlight-to-tanya langsung ke catatan, tanpa alur terpisah |
| 10 | Quick Capture / Review Later | Simpan soal sulit ke antrian review, sinkron ke web app |
| 11 | Block/Warn Mode | Notifikasi halus saat user membuka situs "jawaban instan", opsional & bisa dimatikan |
| 12 | Context-aware YouTube | Auto-pause di video pembelajaran, prompt refleksi Socratic |

### 5.3 Fase 3 (Advanced / diferensiasi jangka panjang)

| # | Fitur | Catatan |
|---|---|---|
| 13 | Local Context Stitching | Auto-extract soal dari DOM tanpa copy-paste, per platform |
| 14 | Multi-tab Reasoning Trace | Gabungkan konteks dari beberapa tab jadi satu sesi belajar koheren |
| 15 | Confusion Detection | Deteksi pola scroll-back/dwell time, proaktif menawarkan bantuan |
| 16 | Screenshot-to-Question (OCR) | OCR soal dari gambar/PDF ke flow Socratic |
| 17 | Real-time Voice Socratic Mode | Dialog lisan streaming STT + LLM, gaya viva |
| 18 | On-device Draft Grading | Model kecil lokal (WebGPU/WASM) untuk quick-check sebelum fallback ke backend |
| 19 | Cross-platform Question Fingerprinting | Hash & cek kemiripan soal lintas pengguna (anonim) |

## 6. Alur Pengguna Utama (MVP)

**Alur A — Highlight-to-Tanya:**
1. Siswa membaca artikel/soal di tab mana pun
2. Select teks → klik kanan → "Tanya Eureka"
3. Side panel terbuka, Eureka mengajukan pertanyaan pemandu (bukan jawaban)
4. Siswa menjawab, dialog Socratic berlanjut hingga paham

**Alur B — Tab-to-Note:**
1. Siswa klik icon extension di toolbar saat berada di tab tertentu
2. Extension ekstrak konten halaman, tampilkan draft catatan (ringkasan + pertanyaan reflektif)
3. Siswa edit/konfirmasi → simpan
4. Catatan tersinkron otomatis ke dashboard eureka-ai.web.id, dengan tag domain/topik

## 7. Kebutuhan Teknis (Ringkas)

- **Manifest V3**, permission: `activeTab`, `contextMenus`, `sidePanel`, `storage`, `scripting`
- **Auth**: sinkron sesi dengan akun eureka-ai.web.id (OAuth/token via web app, disimpan di `chrome.storage.local`)
- **Content script**: ekstraksi teks halaman (readability-style parsing) untuk fitur Tab-to-Note
- **Background service worker**: kelola context menu, komunikasi ke Eureka API
- **API**: reuse endpoint chat & notes dari backend Eureka.AI yang sudah ada; tambah endpoint khusus notes-from-extension jika perlu payload berbeda (URL, domain, snippet)

## 8. Risiko & Pertimbangan

- **Privasi**: ekstraksi konten halaman harus dibatasi ke tab aktif atas aksi eksplisit user, bukan tracking pasif (penting untuk Chrome Web Store review & kepercayaan orang tua/sekolah)
- **Performa**: content script tidak boleh memperlambat halaman yang di-load
- **Chrome Web Store review**: fitur "block/warn mode" (Fase 2) perlu wording hati-hati agar tidak dianggap sebagai extension yang memblokir situs kompetitor secara agresif

## 9. Roadmap Timeline (Estimasi)

| Fase | Fitur | Estimasi durasi |
|---|---|---|
| Fase 1 — MVP | Highlight-to-Tanya, Side Panel, Tab-to-Note, Smart Summarize, Sinkron Catatan, Auto-tagging, Streak Badge | 3–4 minggu |
| Fase 2 | Homework Detector, Highlight→Catatan, Quick Capture, Block/Warn Mode, YouTube context | 4–6 minggu setelah validasi MVP |
| Fase 3 | Context Stitching, Multi-tab Trace, Confusion Detection, OCR, Voice Mode, On-device Grading, Fingerprinting | Iteratif, sesuai kebutuhan & traksi |

## 10. Kriteria Rilis MVP (Definition of Done)

- [ ] Highlight-to-Tanya berfungsi di minimal 3 jenis situs (artikel, LMS umum, PDF viewer browser)
- [ ] Side panel tetap terbuka saat pindah tab dalam window yang sama
- [ ] Tab-to-Note berhasil ekstrak & ringkas konten dari halaman teks standar
- [ ] Catatan tersinkron dan muncul di dashboard web app dalam <5 detik
- [ ] Auth extension–web app teruji (login sekali, sesi persisten)
- [ ] Lolos review Chrome Web Store (privacy policy, permission justification)
