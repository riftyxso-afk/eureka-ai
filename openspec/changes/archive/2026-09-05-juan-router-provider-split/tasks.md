# Tasks: juan-router-provider-split

## 1. Verifikasi kemampuan Juan Router

- [x] 1.1 Uji endpoint Juan Router dengan key dari `.env.local`: `GET /models`, `POST /chat/completions` (satu model per tier fast/normal/deep), `POST /embeddings`, `POST /audio/transcriptions` (bila ada). Catat hasilnya (model embedding yang didukung, format respons, limit). **Verifikasi:** ringkasan hasil tercatat di file change atau komentar task ini sebelum lanjut ke kelompok 2.
  - Hasil live 2026-09-04 (`scripts/probe-juan-endpoints.mjs`, `probe-juan-models.mjs`, `probe-juan-tier-models.mjs`):
  - `/models`: 22 model, semua `supported_endpoint_types: [openai]` (chat saja). **Tidak ada endpoint embedding maupun audio/transkripsi.**
  - Chat per tier `SPEED_MODEL_LISTS` — HIDUP: `gemini-3.7-flash-low` (fast, 3,7s), `gemini-3.7-flash-high` (normal, 5,2s), `minimax-m3` (normal, 24s), `gpt-5.6-terra` (deep, 26s), `grok-4.6` (deep, 20s). MATI: `deepseek-v4-flash-vision-exp` (insufficient balance), `deepseek-v4-pro`, `deepseek-v4-pro-0813`, `claude-opus-5`, `muse-spark-1.2` (no channel), `qwen3.8-max` (403 upstream, 12s), `gpt-5.6-luna` (timeout >45s).
  - Model terdaftar lain yang hidup (kandidat): `gemini-3.5-flash-lite`, `gemini-3.8-flash-low`, `gpt-5.6-sol` (cepat), `glm-5.3-flash`, `hy-4-preview`, `qwen3.8-27b` (keduanya kadang konten kosong), `MiniMax-M2.7`.
- [x] 1.2 Putuskan rute embedding/transkripsi berdasarkan hasil 1.1: bila Juan mendukung `/embeddings` & transkripsi → lanjut sesuai design; bila tidak → tahan migrasi RAG, terapkan hanya rantai teks, dan catat pengecualian di hasil change. **Verifikasi:** keputusan tertulis ada sebelum kelompok 4 dimulai.
  - **Keputusan (2026-09-04):** Juan Router TIDAK mendukung `/embeddings` & `/audio/transcriptions` → **migrasi RAG DITAHAN**: `lib/rag/*` tetap di jalur lama; task kelompok 4 direvisi menjadi "tanpa perubahan" + catatan pengecualian. Embedding/transkripsi tetap lewat provider existing, dan OpenAgentic TETAP tidak boleh jadi fallback teks.

## 2. Rantai provider teks di lib/ai.ts

- [x] 2.1 Ubah `getProviderChain`: semua jalur teks (parameter `forChat` tidak lagi membedakan provider) memakai Juan Router dengan tier `SPEED_MODEL_LISTS[speedMode]` + filter reasoning-OFF yang sudah ada, diikuti OpenRouter (`OPENROUTER_FREE_MODELS`) sebagai fallback darurat. **Verifikasi:** unit-check manual/probe menunjukkan chain = [Juan×N, OpenRouter×M] untuk semua nilai forChat.
  - Verifikasi 2026-09-04 (`scripts/verify-split-chain.ts chain`): 6 kombinasi tier×forChat semuanya `[JuanRouter,OpenRouter]`; `SPEED_MODEL_LISTS` diperbarui ke model yang hidup di Juan.
- [x] 2.2 Nonaktifkan blok `AI_FORCE_MODELS` untuk teks (kode & variabel dibiarkan, beri komentar alasan) dan tambahkan log peringatan sekali saat env terisi. **Verifikasi:** dengan `AI_FORCE_MODELS` diisi, chain tetap Juan→OpenRouter dan peringatan muncul di log.
  - Verifikasi 2026-09-04: dengan `AI_FORCE_MODELS=contoh-model-forced` peringatan `[AI] AI_FORCE_MODELS diisi tapi DINONAKTIFKAN...` muncul; chain tetap Juan→OpenRouter tanpa OpenAgentic.
- [x] 2.3 Hapus fallback OpenAgentic di rantai teks (termasuk cabang "kunci Juan kosong → OpenAgentic free"); saat `JUANROUTER_API_KEY` kosong rantai tetap berisi OpenRouter saja dan log menyebut kunci Juan tidak ada. **Verifikasi:** probe dengan kunci Juan dikosongkan tidak pernah memanggil openagentic.id untuk teks (cek log).
  - Verifikasi 2026-09-04 (`scripts/verify-split-chain.ts no-juan`): chain hanya `[OpenRouter]`, peringatan kunci Juan muncul, OpenAgentic tidak ada di semua kombinasi.
- [x] 2.4 Perbarui `hasAiKey()` agar true bila rantai teks baru tidak kosong (kunci Juan ATAU OpenRouter ada). **Verifikasi:** `hasAiKey()` konsisten dengan isi rantai pada kedua kondisi kunci.
  - Verifikasi 2026-09-04: `hasAiKey()=true` dengan kunci lengkap; dengan Juan dikosongkan tetap true karena OpenRouter ada (chain tidak kosong).
- [x] 2.5 Perbarui label/log provider agar rute akhir tiap panggilan tercatat (provider+model), termasuk penanda fallback darurat. **Verifikasi:** satu panggilan chat + satu panggilan non-chat memperlihatkan baris log "JuanRouter"/"OpenRouter" yang benar.
  - Verifikasi 2026-09-04: log `[AI] Rute akhir: JuanRouter/gemini-3.7-flash-low` (chat) dan `JuanRouter/gemini-3.7-flash-high` (non-chat JSON); stream mendapat penanda `FALLBACK DARURAT` di `[aiChatStream] selesai:`.

## 3. Rute gambar tetap OpenAgentic

- [x] 3.1 Pastikan `app/api/assistant/image/route.ts` & `lib/image-gen.ts` tidak terdampak (OpenAgentic utama → Cloudflare fallback) dan tidak mengimpor apa pun yang diubah di 2.x secara merusak; perbaiki hanya bila perlu. **Verifikasi:** e2e `scripts/image-route-e2e.ts` tetap lolos (HTTP 200, dataUrl valid).
  - Verifikasi parsial 2026-09-04: `lib/image-gen.ts` hanya mengimpor `OPENAGENTIC_API_KEY`/`OPENAGENTIC_BASE_URL` (masih diekspor); tidak ada pemakai eksternal `OPENAGENTIC_FREE_MODELS`/`OPENAGENTIC_MODEL`. E2E penuh dijalankan di task 6.1.

## 4. Embedding & transkripsi (DITAHAN per keputusan 1.2)

- [x] 4.1 Tanpa perubahan: Juan Router tidak menyediakan `/embeddings` — `getAiApiConfig()` tetap seperti semula; embedding/transkripsi memakai jalur yang sudah ada. Pengecualian tercatat di 1.2. **Verifikasi:** tidak ada diff di `lib/ai.ts::getAiApiConfig` terkait task ini.
- [x] 4.2 Tanpa perubahan: `lib/rag/embed.ts` & `lib/rag/extract.ts` tidak diubah (RAG tetap jalur lama). **Verifikasi:** `git diff` tidak menyentuh file RAG.

## 5. Konfigurasi & dokumentasi

- [x] 5.1 Perbarui `.env.example`: `JUANROUTER_API_KEY` diberi keterangan WAJIB untuk fitur teks; `OPENAGENTIC_API_KEY` diberi keterangan hanya untuk gambar; dokumentasikan `AI_FORCE_MODELS` nonaktif dan `JUANROUTER_EMBED_MODEL`. **Verifikasi:** diff `.env.example` merefleksikan aturan baru.
  - Catatan: `JUANROUTER_EMBED_MODEL` tidak jadi didokumentasikan karena migrasi embedding ditahan (keputusan 1.2) — Juan tidak punya endpoint embeddings.
- [x] 5.2 Perbarui bagian env di `DEPLOYMENT.md` sesuai aturan provider baru. **Verifikasi:** tabel env di DEPLOYMENT.md konsisten dengan `.env.example`.
  - Verifikasi 2026-09-04: tabel frontend & backend sama — JUANROUTER_API_KEY wajib untuk teks, OPENAGENTIC hanya gambar, OPENROUTER fallback darurat.

## 6. Verifikasi menyeluruh

- [x] 6.1 Jalankan smoke: chat (`forChat`), generate catatan (non-chat), dan generate gambar — cek log menunjukkan rute JuanRouter (teks) dan OpenAgentic (gambar); fallback OpenRouter hanya muncul saat Juan sengaja diganggu/disimulasikan gagal. **Verifikasi:** ringkasan smoke dicatat di change ini.
  - Ringkasan smoke 2026-09-04:
    - Chat (forChat=true, fast): `Rute akhir: JuanRouter/gemini-3.7-flash-low` ✓ (scripts/verify-split-chain.ts)
    - Non-chat JSON (forChat=false, normal): `Rute akhir: JuanRouter/gemini-3.7-flash-high` ✓
    - Simulasi Juan kosong (scripts/fallback-smoke.ts): `Rute akhir: OpenRouter/nvidia/nemotron-3.5-lightning:free` ✓ — fallback darurat hanya saat Juan disimulasikan gagal.
    - Gambar (scripts/image-route-e2e.ts vs dev server): HTTP 200, dataUrl valid via OpenAgentic ✓; waktu total turun dari ~4m54s menjadi ~29s karena langkah penyusunan prompt kini dilayani Juan Router (fast) alih-alih jalur OpenAgentic lama yang lambat.
- [x] 6.2 `npm run build` sukses tanpa error TypeScript baru. **Verifikasi:** output build hijau.
  - Verifikasi 2026-09-04: `npm run build` hijau sampai daftar route lengkap (tanpa error TS).
