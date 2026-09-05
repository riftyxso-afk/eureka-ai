# Proposal: juan-router-provider-split

## Why

Saat ini panggilan AI teks terpecah tidak konsisten: chat lewat Juan Router, tapi pembuatan catatan, kuis, judul, dan seluruh pipeline enrichment masih lewat OpenAgentic (+ OpenRouter) — dan dari hasil live audit, rantai campuran ini saling blokir (provider chain berbeda per jalur, latency note-generation sampai ~5 menit). Pengguna ingin pemisahan provider yang tegas: **Juan Router menangani SEMUA generate AI berbasis teks (termasuk embedding & transkripsi), dan OpenAgentic HANYA dipakai untuk text-to-image**. Ini menyederhanakan rantai fallback, membuat perilaku antar-fitur konsisten, dan memisahkan kuota/biaya gambar dari teks.

## What Changes

- `getProviderChain` (lib/ai.ts): semua panggilan teks (`forChat` maupun non-chat: catatan, kuis, flashcards, judul, prompt ilustrasi, web-search enrichment, stability check) memakai **Juan Router sebagai provider utama** dengan tier model `SPEED_MODEL_LISTS` yang ada.
- **Fallback darurat teks: OpenRouter** — hanya dipakai bila seluruh percobaan Juan gagal (429/503/timeout/model error). OpenAgentic **dihapus dari rantai teks** (termasuk model free-nya); env `AI_FORCE_MODELS` yang memaksa OpenAgentic ikut dinonaktifkan.
- **OpenAgentic hanya untuk text-to-image**: `generateImageViaOpenAgentic` (lib/image-gen.ts) tetap menjadi satu-satunya konsumen `OPENAGENTIC_API_KEY` untuk generate gambar; fallback gambar Cloudflare FLUX tidak berubah.
- Embedding & transkripsi audio (RAG di `lib/rag/embed.ts` & `lib/rag/extract.ts`) berpindah dari OpenAgentic ke Juan Router via `getAiApiConfig()`.
- Gating konfigurasi: bila `JUANROUTER_API_KEY` kosong, fitur AI teks menolak dengan pesan error yang jelas (bukan diam-diam pindah ke OpenAgentic); image-generation tetap berjalan independen asal `OPENAGENTIC_API_KEY` terisi.
- Perilaku pengamatan: log/label provider diperbarui agar mencerminkan rute baru (JuanRouter → OpenRouter darurat untuk teks; OpenAgentic hanya gambar).

## Capabilities

### New Capabilities

- `ai-provider-routing`: Aturan pemilihan provider AI per jenis beban — teks (chat, catatan, kuis, judul, enrichment) via Juan Router dengan fallback OpenRouter darurat, gambar via OpenAgentic dengan fallback Cloudflare, serta embedding/transkripsi via Juan Router.

### Modified Capabilities

<!-- Tidak ada: belum ada spec existing yang mengatur provider AI (checked: notes, web-search, pakasir-payments). -->

## Impact

- **Kode**: `lib/ai.ts` (rantai provider, `getAiApiConfig`, `hasAiKey`, `isOpenAICompatible`, log), `lib/rag/embed.ts`, `lib/rag/extract.ts`; `app/api/assistant/image/route.ts` tidak berubah secara fungsional (OpenAgentic tetap dipakai untuk gambar).
- **Env**: `JUANROUTER_API_KEY` menjadi **wajib** untuk semua fitur AI teks (sebelumnya opsional); `OPENAGENTIC_API_KEY` kini hanya dibutuhkan untuk fitur gambar. `AI_FORCE_MODELS` nonaktif.
- **Risiko**: seluruh fitur teks bergantung pada ketersediaan Juan Router (mitigasi: fallback OpenRouter darurat); perlu verifikasi endpoint `/embeddings` & `/audio/transcriptions` di Juan Router sebelum implementasi.
- **Tidak terdampak**: pembayaran, auth, UI, ekstensi browser, rate limit, premium gating.
