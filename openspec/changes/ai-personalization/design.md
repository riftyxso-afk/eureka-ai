## Context

Saat ini Eureka.AI menggunakan system prompt statis untuk semua user tanpa mempertimbangkan preferensi individu. User tidak bisa menyesuaikan gaya jawaban AI (tingkat kesulitan, panjang, kecepatan, Socratic level, dll). Lihat `proposal.md - Why` untuk motivasi lengkap.

## Goals / Non-Goals

**Goals:**
- CRUD preferensi AI per user via REST API
- Inject preferensi ke system prompt dinamis di `buildSystemPrompt`
- Validasi response AI sesuai preferensi sebelum ditampilkan
- UI `/dashboard/pengaturan/ai` untuk manage preferensi
- Migration otomatis default preferences untuk user existing

**Non-Goals:**
- Tidak membuat model LLM baru atau fine-tuning
- Tidak menyimpan history preferensi (hanya current state)
- Tidak mengubah pipeline RAG/note generation core (hanya inject preferensi)
- Tidak real-time sync preferensi ke session chat yang sudah buka (perlu refresh)

## Decisions

### 1. Schema preferensi & DB

**Keputusan**: Tabel `user_ai_preferences` (FK ke `users.id`, JSONB `preferences`, timestamps). Default preferences di application layer.

**Alternatif**: Kolom terpisah per field — ditolak, JSONB lebih fleksibel untuk evolutif schema.

**Rationale**: Fleksibel untuk tambah field baru tanpa migration, query mudah dengan JSONB operators.

### 2. Default preferences & validation

**Keputusan**: Default preferences di `lib/userPreferences.ts` sebagai single source of truth. Validasi via Zod schema di `lib/userPreferences.ts` + `app/api/user/ai-preferences/route.ts`.

**Alternatif**: DB-level CHECK constraint — ditolak, sulit maintain & test.

**Rationale**: Single source of truth di TypeScript, type-safe, testable unit.

```typescript
// lib/userPreferences.ts
export const DEFAULT_AI_PREFERENCES = {
  difficulty: "medium" as const,
  responseLength: "medium" as const,
  speed: "normal" as const,
  socraticLevel: 3,
  focusMode: false,
  language: "id" as const,
} as const;

export const AI_PREFERENCES_SCHEMA = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  responseLength: z.enum(["short", "medium", "long"]).default("medium"),
  speed: z.enum(["fast", "normal", "deep"]).default("normal"),
  socraticLevel: z.number().int().min(1).max(5).default(3),
  focusMode: z.boolean().default(false),
  language: z.enum(["id", "en"]).default("id"),
});
```

### 3. Inject preferensi ke system prompt

**Keputusan**: Modifikasi `buildSystemPrompt` di `lib/assistant/prompt.ts` menerima `userPreferences` param dan inject section `=== USER PREFERENCES ===`.

**Alternatif**: Middleware di `aiChat` wrap prompt — ditolak, coupling tinggi.

**Rationale**: `buildSystemPrompt` sudah central place untuk prompt engineering, inject di sini paling clean.

```typescript
// lib/assistant/prompt.ts
export function buildSystemPrompt(input: {
  // ... existing
  userPreferences?: UserAIPreferences;
}): string {
  const lines = [...existingLines];
  if (input.userPreferences) {
    lines.push("", "=== USER PREFERENCES ===", formatPreferences(input.userPreferences));
  }
  return lines.join("\n");
}

function formatPreferences(prefs: UserAIPreferences): string {
  const lines: string[] = [];
  if (prefs.difficulty) lines.push(`- Kesulitan: ${prefs.difficulty} (${DIFFICULTY_INSTRUCTIONS[prefs.difficulty]})`);
  if (prefs.responseLength) lines.push(`- Panjang jawaban: ${prefs.responseLength} (${LENGTH_INSTRUCTIONS[prefs.responseLength]})`);
  // ... dst
  return lines.join("\n");
}
```

### 4. Validasi response AI

**Keputusan**: Post-processing di `app/api/assistant/chat/route.ts` setelah `aiChatStream` selesai, sebelum `emit done`. Panggil `validateAnswer(answer, prefs)`.

**Alternatif**: Validasi di streaming token-by-token — ditolak, terlalu kompleks & latency.

**Rationale**: Post-processing once di akhir streaming cukup, latency minimal.

```typescript
// lib/assistant/answerValidation.ts
export function validateAnswer(
  answer: string,
  prefs: UserAIPreferences,
  ragHits: RagHit[],
  webResults: WebSearchResult[]
): { ok: boolean; fixed?: string } {
  // 1. Length check
  if (prefs.responseLength === "short" && countSentences(answer) > 3) {
    return { ok: false, fixed: truncateToSentences(answer, 3) + "..." };
  }
  // 2. Language check (simple heuristic)
  if (prefs.language === "id" && detectLanguage(answer) === "en") {
    return { ok: false, fixed: await translateToId(answer) };
  }
  // 3. Socratic level check
  if (prefs.socraticLevel >= 4 && !hasQuestion(answer)) {
    return { ok: false, fixed: answer + "\n\nApakah penjelasan ini cukup jelas? Mau saya jelaskan bagian mana lebih detail?" };
  }
  return { ok: true };
}
```

### 5. UI Settings page

**Keputusan**: Halaman `/dashboard/pengaturan/ai` dengan form terstruktur (Select, Slider, Toggle). Simpan via `PATCH /api/user/ai-preferences`. Toast notif sukses/error.

**Rationale**: Konsisten dengan UX settings lain di dashboard.

### 5. Migration strategy

**Keputusan**: Lazy migration — saat `GET /api/user/ai-preferences` tidak ketemu record, auto-create default. Tidak perlu batch migration script.

**Rationale**: Zero-downtime, user baru & lama handled same way.

## Risks / Trade-offs

- **Risk**: Latency tambahan dari validasi post-processing → **Mitigasi**: Async, non-blocking, timeout 2s max
- **Risk**: User set preferensi conflicting (mis. `socraticLevel: 5` + `responseLength: "short"`) → **Mitigasi**: UI warning di settings, server prioritaskan `responseLength` untuk truncate
- **Risk**: Preferensi user corrupt di DB → **Mitigasi**: Try-catch di GET, fallback ke default + log error
- **Trade-off**: Validasi post-processing menambah ~200-500ms latency → Acceptable untuk kualitas jawaban

## Migration Plan

1. Deploy migration DB (`user_ai_preferences` table + index)
2. Deploy `lib/userPreferences.ts` + Zod schema
2. Deploy `app/api/user/ai-preferences/route.ts` (GET/PATCH/DELETE)
3. Deploy `lib/userPreferences.ts` inject ke `buildSystemPrompt`
4. Deploy `lib/assistant/answerValidation.ts` + hook di `app/api/assistant/chat/route.ts`
4. Deploy UI `/dashboard/pengaturan/ai` (settings page)
5. Test end-to-end: set preferensi → chat → verifikasi inject + validasi

## Open Questions

- Apakah perlu `socraticLevel` per-subjek (mis. Matematika level 5, Sejarah level 2)? → V2, global dulu
- Apakah perlu export/import preferensi (portabilitas)? — V2
- Apakah perlu A/B testing default preferences? — V2, collect metrics dulu