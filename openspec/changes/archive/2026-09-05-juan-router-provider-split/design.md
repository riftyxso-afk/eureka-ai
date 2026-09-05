# Design: juan-router-provider-split

## Context

Arsitektur provider saat ini (lihat proposal.md — Why untuk motivasi): `getProviderChain(speedMode, forChat, reasoning)` di `lib/ai.ts` membangun rantai provider yang BERBEDA per jalur:

- `forChat: true` → Juan Router only (tier `SPEED_MODEL_LISTS`), fallback ke OpenAgentic free models hanya bila kunci Juan kosong.
- `forChat: false` (catatan/kuis/judul/enrichment) → OpenAgentic free models + OpenRouter free models; Juan hanya kalau keduanya kosong.
- Blok `AI_FORCE_MODELS` → memaksa model lewat OpenAgentic paling awal.
- Mode `AI_PROVIDER=9router` memotong semua logika di atas (short-circuit) — tidak diubah oleh change ini.
- Embedding/transkripsi memakai `getAiApiConfig()` yang memilih provider via env `AI_PROVIDER` (default `openagentic`).
- Gambar: `lib/image-gen.ts` memakai OpenAgentic langsung, fallback Cloudflare di `lib/cloudflareImages.ts`.

Constraint: perubahan harus terpusat di `lib/ai.ts` + dua file RAG; tanpa mengubah kontrak response API atau UI; tanpa menghapus kode provider lama (pola repo: dinonaktifkan, bukan dihapus — lihat komentar existing).

## Goals / Non-Goals

**Goals:**
- Satu rute teks tunggal: Juan Router (semua tier & semua jenis teks) → fallback darurat OpenRouter.
- OpenAgentic keluar dari semua jalur teks (termasuk `AI_FORCE_MODELS` dan fallback kunci-kosong).
- Embedding & transkripsi ikut ke Juan Router via `getAiApiConfig()`.
- Pesan error jelas saat `JUANROUTER_API_KEY` kosong; gambar tetap independen.

**Non-Goals:**
- Mengubah jalur gambar (OpenAgentic→Cloudflare tetap).
- Mengubah mode `AI_PROVIDER=9router` / AIMurah / OpenAI resmi.
- Mengubah tier model (`SPEED_MODEL_LISTS`), rate limit, premium gating, UI.
- Menghapus kode/variabel provider lama.

## Decisions

### 1. Satu cabang rantai untuk semua teks — hapus dikotomi forChat
`getProviderChain` diperlakukan seragam: selama `juanKey` ada → push Juan Router dengan tier `SPEED_MODEL_LISTS[speedMode]` (logika filter reasoning-OFF yang sudah ada di cabang chat dipertahankan dan dipakai untuk semua jalur), lalu push OpenRouter sebagai fallback darurat. Parameter `forChat` tetap ada di signature (kompatibilitas pemanggil) tapi tidak lagi membedakan provider.
**Alternatif ditolak:** mempertahankan dua cabang dan sekadar menukar provider di tiap cabang — mempertahankan kompleksitas yang justru jadi sumber bug rantai-campuran.

### 2. OpenRouter darurat memakai daftar free-model yang sudah ada
Fallback memakai `OPENROUTER_FREE_MODELS` (konsisten pola existing: catatan gratis tidak boleh menyedot biaya). Konsekuensi diterima: fallback kurang andal daripada model berbayar.
**Alternatif ditolak:** model berbayar OpenRouter — mengubah profil biaya tanpa keputusan eksplisit pengguna.

### 3. OpenAgentic dihapus dari rantai teks, kode tidak dihapus
Blok push OpenAgentic di rantai teks dinonaktifkan (komentar menjelaskan alasan + tanggal change ini). `AI_FORCE_MODELS` diabaikan untuk teks dengan log peringatan sekali (variabel & kodenya dibiarkan). Kunci OpenAgentic tetap diekspor untuk `lib/image-gen.ts`.

### 4. `getAiApiConfig()` memilih Juan Router untuk embedding/transkripsi
Urutan baru: bila `JUANROUTER_API_KEY` terisi → kembalikan konfigurasi Juan Router; selainnya urutan lama dipertahankan. Karena pemakai (`lib/rag/embed.ts`, `lib/rag/extract.ts`) hanya memakai `baseURL`+`apiKey` dan menentukan model sendiri, model embedding/transkripsi dikonfigurasi via env baru (`JUANROUTER_EMBED_MODEL`, default ditentukan saat verifikasi endpoint — lihat Open Questions).

### 5. Semantik `hasAiKey()` mengikuti rute teks baru
`hasAiKey()` mengembalikan true bila rantai teks baru tidak kosong (kunci Juan atau OpenRouter ada). Ini membuat gating `hasAiKey()` di pipeline catatan/prompt-ilustrasi ikut benar tanpa perubahan pemanggil.

## Risks / Trade-offs

- [Juan Router down = semua fitur teks down kecuali OpenRouter] → Fallback darurat OpenRouter otomatis; log provider memudahkan diagnosis; rollback via revert commit.
- [Juan tidak mendukung `/embeddings` atau `/audio/transcriptions`] → Verifikasi endpoint HARUS selesai di task 1 sebelum migrasi RAG; bila tidak didukung, transkripsi/embedding mempertahankan jalur lama dan dicatat sebagai pengecualian di hasil change (keputusan ini mengubah detail task, bukan spec — spec mensyaratkan "tanpa fallback diam-diam ke OpenAgentic", error jelas tetap terpenuhi).
- [Pemakai `AI_FORCE_MODELS` (ops/debug) kaget] → Log peringatan sekali saat env terisi; dokumentasikan di `.env.example`.
- [Free-model OpenRouter lambat/sibuk saat darurat] → Diterima; tetap lebih baik daripada gagal total.

## Migration Plan

1. Verifikasi endpoint Juan (task 1) → 2. Ubah `lib/ai.ts` + file RAG → 3. Uji lokal (chat, catatan, gambar, smoke e2e) → 4. Perbarui `.env.example` & `DEPLOYMENT.md` (`JUANROUTER_API_KEY` wajib untuk teks) → 5. Deploy.
**Rollback:** revert commit; tidak ada perubahan data/skema.

## Open Questions

- Model id embedding apa yang didukung Juan Router (perlu dicek `/models` mereka saat verifikasi)? Menentukan default `JUANROUTER_EMBED_MODEL`.
- Apakah OpenRouter fallback perlu untuk embedding juga, atau error jelas saja (fallback embedding tidak ada saat ini) — diputuskan saat verifikasi task 1.
