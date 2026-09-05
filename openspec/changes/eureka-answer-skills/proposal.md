## Why

Jawaban Eureka kadang kurang konsisten, tidak tervalidasi silang dengan sumber catatan/web, dan gaya Socratic belum terstruktur sebagai *skills* yang bisa dipilih; perlu sistem skills yang membuat jawaban lebih akurat, valid, dan sesuai konteks belajar.

## What Changes

- Tambah registry `eureka-skills` (skill = prompt+tool+validation terpakai ulang) dengan 4 skill inti: `socratic-explain`, `fact-check`, `source-cite`, `stepwise-solve`; tiap skill punya `when/then` dan `validator`.
- Integrasi skill ke pipeline `aiChat`/`aiChatStream`: selector otomatis pilih skill berdasar intent (jelaskan/cek fakta/hitung) + opsi manual `skill:` di composer; fallback ke `default` bila tidak cocok.
- Lapisan validasi: cek kutipan sumber (RAG/web) harus ada untuk klaim faktual, cek LaTeX/math render, cek konsistensi bahasa, dan tolak jawaban tanpa sumber dengan ajakan buat catatan; log `skill_used` untuk observability.
- UI kecil di composer & bubble: badge skill yang dipakai + tombol ganti skill; tidak mengubah API chat yang ada.

## Capabilities

### New Capabilities
- `eureka-skills`: Registry & eksekusi skills Eureka (definisi skill, selector, validator, logging).
- `answer-validation`: Validasi jawaban faktual (kutipan sumber wajib, cek LaTeX, cek bahasa) sebelum streaming selesai.

### Modified Capabilities
- `ai-safety`: Tambah REQUIREMENT validasi kutipan sumber wajib untuk jawaban faktual (sebelumnya hanya guardrail umum).

## Impact

- **Code**: `lib/eureka-skills/*` (baru), `lib/ai.ts` (selector), `lib/assistant/prompt.ts` (inject skill), `lib/assistant/answerValidation.ts` (baru), `components/asisten/Composer.tsx` & `MessageBubble.tsx` (badge skill), `lib/assistant-stream.ts` (log skill).
- **APIs**: `POST /api/assistant/chat` tambah field opsional `skill`; tidak breaking (default selector).
- **Dependencies**: Tidak ada deps baru; reuse `zod` untuk validasi skill schema jika ada.
- **System**: Tidak ada DB baru; `skill_used` log di existing telemetry; fallback ke skill `default` bila selector gagal.
