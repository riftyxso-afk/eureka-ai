## Why

Jawaban AI Eureka saat ini streaming kata-per-kata tanpa konteks sumber inline; pengguna tidak melihat dari mana kalimat berasal dan tidak mendapat follow-up yang relevan. Komponen `StreamingText` yang diberikan memecahkan dengan kata yang blur-resolve, chip sumber inline, daftar sumber yang expandable, dan follow-up yang staggered — meningkatkan kepercayaan dan eksplorasi.

## What Changes

- Tambah komponen `components/streaming/StreamingText.tsx` dari snippet (adaptasi token clay) yang mendukung `StreamingToken` (`text` + `cite`) dan `StreamingSource` (name/domain/href/image) dengan `WORD_MS=55` dan `HOLD_MS=3400`.
- Render teks streaming word-by-word `blur` → `resolve`, sisipkan `SourceChip` inline untuk token `cite`, kursor kedip, dan `loop`/`fill` props untuk demo vs thread real.
- Tampilkan bar aksi (copy/retry/up/down) dan toggle `10 sources` (avatar stack + expanded list) serta `Follow-ups` (2 prompt) dengan animasi `fade-up` stagger.
- Integrasi ke `MessageBubble`/`app/chat/[id]/page.tsx`: saat `isStreaming`, ganti `MarkdownView` dengan `StreamingText` yang diisi `content` dari `streaming.content` yang di-split per kata, plus `sources` dari `streaming.sources`/`webResults`.

## Capabilities

### New Capabilities
- `streaming-text`: Teks jawaban yang streaming kata-per-kata dengan inline citation chip, daftar sumber expandable, bar aksi, dan follow-up prompts — semua teranimasi dan loop-aware.

### Modified Capabilities
- (none) — reuse `MessageBubble` dan `assistant-stream` yang sudah ada; tidak ubah requirement spec lain.

## Impact

- **Code**: Baru `components/streaming/StreamingText.tsx`, modifikasi ringan `MessageBubble.tsx` (ganti streaming branch), `app/chat/[id]/page.tsx` (pass `sources`/`followUps`), `app/globals.css` (keyframes `pop-in`, `fade-up` jika belum ada).
- **Dependencies**: `framer-motion` sudah ada; tidak tambah deps baru.
- **System**: Tidak ada perubahan API/DB; SSR-safe (hanya `useEffect`/`useState` untuk word timer).
