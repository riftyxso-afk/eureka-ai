# Design: model-store-selector

## Context

Selector kecepatan saat ini: popover 3 opsi di `components/asisten/Composer.tsx` (`SPEED_OPTIONS`), state `speedMode` diteruskan `useAssistantChat` → `assistant-stream` → `POST /api/assistant/chat` (divalidasi whitelist `fast|normal|deep` di route.ts:211) → `getProviderChain(speedMode, ...)` di `lib/ai.ts`. Katalog Juan Router (20 model, diverifikasi 2026-09-05) tidak memuat `nemotron-3.5-lightning`, `claude-opus-5`, `qwen3.8-max` — user memutuskan tetap dimasukkan dengan fallback otomatis. Logo brand tersedia baru 4 (OpenAI, Claude, NVIDIA, DeepSeek) di `public/images/ai-models/`, dipakai landing page.

## Goals / Non-Goals

**Goals:**
- Satu sumber kebenaran katalog: daftar tier + metadata model (nama, brand, logo, tier, peringkat pintar 1–5, deskripsi singkat) di `lib/ai.ts`.
- Model Store di composer: tabtier + daftar model berlogo & berperingkat; pilih model spesifik atau lepas.
- `model` opsional di API chat, allowlist server-side, prioritas pertama di rantai.

**Non-Goals:**
- Model spesifik untuk pipeline catatan/kuis/judul (tetap per-tier).
- Persistensi pilihan model lintas sesi/perangkat (state per halaman saja).
- Menambah provider baru atau mengubah aturan Juan/OpenRouter/OpenAgentic.

## Decisions

### D1 — `MODEL_CATALOG` sebagai sumber tunggal di lib/ai.ts
Struktur: `{ id, brand, logo, tier, smartness (1–5), desc }[]`. `SPEED_MODEL_LISTS` diturunkan dari katalog (filter tier) agar UI & rantai tidak bisa berbeda. Peringkat "sedikit pintar → terpintar" = skala 1–5 per model (bukan per tier), diurut ascending di UI.
**Alternatif ditolak:** metadata di komponen UI — server perlu id valid untuk allowlist; duplikasi = bug.

### D2 — Rantai dengan model terpilih: `preferredModel` opsional
`getProviderChain(speedMode, _forChat, reasoning, preferredModel?)`: bila id valid & ada di katalog → entri JuanRouter pertama, lalu tier penuh (minus duplikat). Tanpa mengubah kontrak pemanggil lama (param opsional). `aiChat`/`aiChatStream` menerima `model?: string` di options.
**Alternatif ditolak:** memotong tier jadi hanya 1 model — melanggar spec "jawaban tetap terkirim saat model terpilih gagal".

### D3 — API: field `model` opsional, diabaikan bila asing
`/api/assistant/chat` membaca `raw.model`, cek allowlist katalog; asing → `undefined` (mode tier normal, tanpa error — sesuai spec). Tidak ada perubahan response.

### D4 — Model Store = perluasan popover Composer, bukan halaman baru
Popover kecepatan lama di-upgrade: header 3 mode tier (perilaku lama) + daftar model berlogo di bawahnya (grup per tier, badge peringkat "🧠×N" + deskripsi). Klik model → mode manual (chip nama model di trigger); klik chip/× → lepas. Komponen `ModelStore.tsx` terpisah agar Composer tidak membengkak; state `selectedModel` lokal Composer, diteruskan lewat `ComposerSendInput.model`.
**Alternatif ditolak:** modal fullscreen — interaksi lebih berat untuk keputusan cepat.

### D5 — Logo: SVG brand baru + fallback generik
Tambah `public/images/ai-models/`: `google-color.svg` (Gemini), `zhipu-color.svg` (GLM), `minimax-color.svg`, `tencent-color.svg` (Hunyuan), `xai-color.svg` (Grok), `alibaba-color.svg` (Qwen). Sumber: simple-icons (CC0) — digambar ulang sebagai SVG inline sederhana. Model tanpa logo → ikon tier (Zap/Leaf/Brain) — tidak pernah `<img>` rusak.

## Risks / Trade-offs

- [3 model mati di daftar menambah ~1–2s latensi awal saat terpilih] → diletakkan di akhir tier di katalog (smartness tetap sesuai permintaan user); rantai lanjut otomatis; log `Rute akhir` memperlihatkan model yang benar-benar melayani.
- [Logo brand tidak resmi bisa salah representasi] → pakai mark generik simple-icons, tanpa klaim afiliasi.
- [State pilihan model hilang saat refresh] → diterima (MVP); bisa naik ke localStorage di change berikutnya.
- [Klien extension lama tidak kirim `model`] → field opsional, tidak breaking.

## Migration Plan

Deploy biasa; tanpa perubahan DB. Rollback = revert commit.

## Open Questions

(none)
