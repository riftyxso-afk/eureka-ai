## Context

Saat ini `lib/assistant/prompt.ts` membangun system prompt monolitik tanpa konsep skill; `lib/ai.ts` hanya handle provider; validasi jawaban hanya `throwOnError:false` di KaTeX. Lihat `proposal.md - Why` untuk motivasi skills agar jawaban lebih valid.

## Goals / Non-Goals

**Goals:**
- Registry skills terpusat yang bisa dipilih otomatis/manual dan divalidasi.
- Validasi kutipan sumber wajib + LaTeX + bahasa sebelum streaming selesai, tanpa menambah latensi besar.
- UI badge skill di bubble/composer yang re-use `MessageBubble` dan `Composer`.

**Non-Goals:**
- Tidak membuat LLM baru; reuse `aiChat`/`aiChatStream` yang ada.
- Tidak menyimpan jawaban ke DB baru; hanya log `skill_used`.
- Tidak mengubah API chat breaking; `skill` field opsional.

## Decisions

**1. Registry `lib/eureka-skills/registry.ts` + `types.ts`**
- **Keputusan**: File TS berisi array `skills` dengan `id`, `when` (keywords/regex), `prompt` (tambahan system prompt), `validator` (fungsi). Dipilih karena simple, type-safe, tidak butuh DB.
- **Alternatif**: Simpan di DB/Supabase — ditolak, butuh migrasi & latency.
- **Rationale**: 5 skills statis cukup; edit kode = deploy.

**2. Selector di `lib/ai.ts` / `lib/assistant/prompt.ts`**
- **Keputusan**: Fungsi `selectSkill(question, explicitSkill?)` cek `explicitSkill` dulu, lalu keywords (`jelaskan`→socratic, `hitung`→stepwise, klaim→source-cite). Hasil `skill` di-inject ke `buildSystemPrompt` sebagai `=== SKILL: {id} ===\n{prompt}`.
- **Alternatif**: LLM call untuk klasifikasi intent — ditolak, tambah latency & biaya.
- **Rationale**: Keyword cukup akurat untuk 4 skill; fallback `default`.

**3. Validator `lib/assistant/answerValidation.ts`**
- **Keputusan**: Fungsi `validateAnswer(text, ragHits, webResults, locale)` cek: (a) ada klaim faktual (regex `adalah|terjadi|rumus`) → wajib `*(Sumber:` atau `webResults.length>0`, (b) `normalizeMathDelimiters` + `katex.renderToString` throwOnError, (c) lang detect via simple `isEnglish`. Dijalankan setelah `aiChat` selesai tapi sebelum `emit done`; gagal → tambah `→ skipped: [butuh sumber]` atau minta ulang.
- **Alternatif**: Validasi per token streaming — ditolak, terlalu berat.
- **Rationale**: Validasi akhir cukup, tidak block streaming.

**4. UI badge & composer**
- **Keputusan**: `MessageBubble` tampilkan `badge` dari `streaming.skillUsed` (prop baru), `Composer` tambah `select` kecil `skill:` (default `auto`). Reuse `lib/sound/cuelume` tidak perlu.
- **Rationale**: Minimal UI, tidak ubah layout chat.

## Risks / Trade-offs

- **Selector keyword salah pilih skill** → Mitigasi: user bisa override manual `skill:`; log `skill_used` untuk tuning.
- **Validator terlalu ketat (tolak jawaban benar)** → Mitigasi: hanya untuk klaim faktual dengan RAG kosong; jawaban Socratic/stepwise tanpa klaim lolos.
- **LaTeX check false positive** → Mitigasi: `throwOnError:false` + hanya warn, tidak block jawaban.
- **Latency tambahan validasi** → Mitigasi: validasi sync <5ms, tidak ada LLM call.

## Migration Plan

1. Tambah `lib/eureka-skills/` dan `lib/assistant/answerValidation.ts`, update `lib/assistant/prompt.ts` & `lib/ai.ts`, tambah badge di `MessageBubble`/`Composer`; `npx tsc --noEmit` 0.
2. Deploy, monitor log `skill_used`; fallback ke `default` jika selector error.
3. Rollback: hapus inject skill di `prompt.ts`, validator jadi no-op — API tetap kompatibel.

## Open Questions

- Apakah perlu skill `code` terpisah untuk `CodeBlock`? — Ditunda, `stepwise-solve` cukup untuk hitung.
- Simpan preferensi skill per user di DB atau cukup `localStorage`? — Ditunda, default `auto` dulu.
