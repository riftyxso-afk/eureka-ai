# Proposal: model-store-selector

## Why

Pemilihan model AI saat ini tersembunyi di balik 3 mode kecepatan (Kilat/Seimbang/Mendalam) — user tidak tahu model apa yang menjawab dan tidak bisa memilih model tertentu. Daftar tier juga perlu disegarkan ke katalog Juan Router terkini. User meminta: (1) daftar model baru per tier sesuai pilihan mereka, dan (2) "Model Store" di selector — katalog semua model dengan logo, peringkat dari sedikit pintar sampai terpintar, dan kemampuan memilih model spesifik.

## What Changes

- **Daftar tier `SPEED_MODEL_LISTS` diperbarui** ke katalog yang diminta user (diverifikasi live vs Juan Router 2026-09-05):
  - Kilat: `glm-5.3-flash`, `gemini-3.8-flash-high`, `gemini-3.7-flash-low`, `nemotron-3.5-lightning`
  - Seimbang: `gpt-5.6-luna`, `minimax-m3`, `hy-4-preview`, `grok-4.5-high`
  - Mendalam: `gpt-5.6-sol`, `gpt-5.6-terra`, `claude-opus-5`, `qwen3.8-max`, `grok-4.6-xhigh`
  - ⚠️ 3 model TIDAK ada di Juan Router (`nemotron-3.5-lightning`, `claude-opus-5`, `qwen3.8-max`) — tetap dimasukkan sesuai keputusan user; saat Juan menolak (503), rantai otomatis lanjut ke model berikutnya di tier.
- **Model Store di selector composer**: popover kecepatan lama diperluas jadi katalog model — tiap model menampilkan logo brand, nama, tier, dan peringkat kecerdasan (skala "sedikit pintar → terpintar"). User bisa: (a) memilih mode otomatis per tier seperti sekarang, atau (b) memilih SATU model spesifik (terkunci, ada tombol lepas kembali ke otomatis).
- **API menerima `model` eksplisit**: klien mengirim `speedMode` + `model?`; server memvalidasi terhadap katalog (allowlist) lalu memakainya sebagai entri rantai pertama, fallback ke tier normal bila model gagal.
- **Aset logo**: tambah SVG brand yang belum ada (Google/Gemini, Zhipu/GLM, MiniMax, Tencent/Hunyuan, xAI/Grok, Alibaba/Qwen) di `public/images/ai-models/`; yang sudah ada (OpenAI, Claude, NVIDIA, DeepSeek) dipakai ulang.
- Pilihan model spesifik berlaku untuk **chat asisten** (composer /home & /chat); pipeline catatan/kuis tetap per-tier (tidak menerima model spesifik) — asumsi dicatat di design.

## Capabilities

### New Capabilities

- `model-store`: katalog model AI yang bisa dijelajahi user — logo, peringkat kecerdasan, tier, dan pemilihan model spesifik vs mode otomatis per tier.

### Modified Capabilities

- `ai-provider-routing`: requirement "Semua generate teks memakai Juan Router" dimodifikasi — daftar tier diperbarui, dan model spesifik pilihan user mendapat prioritas di atas tier sebelum fallback.

## Impact

- **Kode**: `lib/ai.ts` (`SPEED_MODEL_LISTS` + katalog metadata + rantai dengan model terpilih), `app/api/assistant/chat/route.ts` (terima `model`), `lib/assistant-stream.ts` & `lib/assistant/useAssistantChat.ts` (teruskan `model`), `components/asisten/Composer.tsx` (Model Store UI), komponen baru `ModelStore.tsx`, `public/images/ai-models/*.svg`.
- **Perilaku**: mode otomatis lama tetap berfungsi identik (hanya isi tier berubah); `model` adalah field opsional — klien lama tidak rusak.
- **Risiko**: 3 model mati di Juan menambah latensi awal (percobaan gagal dulu) — dimitigasi dengan urutan daftar (model hidup di depan) dan fallback cepat.
- **Tidak terdampak**: gambar (OpenAgentic), embedding, premium gating, job queue.
