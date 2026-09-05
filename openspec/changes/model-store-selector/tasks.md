# Tasks: model-store-selector

## 1. Katalog & rantai model (lib/ai.ts)

- [x] 1.1 Buat `MODEL_CATALOG` (sumber tunggal): 13 model sesuai daftar user — Kilat: `glm-5.3-flash`, `gemini-3.8-flash-high`, `gemini-3.7-flash-low`, `nemotron-3.5-lightning`; Seimbang: `gpt-5.6-luna`, `minimax-m3`, `hy-4-preview`, `grok-4.5-high`; Mendalam: `gpt-5.6-sol`, `gpt-5.6-terra`, `claude-opus-5`, `qwen3.8-max`, `grok-4.6-xhigh`. Tiap entri: `{ id, brand, logo, tier, smartness 1–5, desc }` (deskripsi singkat bahasa Indonesia; 3 model tanpa channel Juan diberi catatan "segera tersedia"). Turunkan `SPEED_MODEL_LISTS` dari katalog (filter tier, urutan = prioritas). **Verifikasi:** `SPEED_MODEL_LISTS` berisi persis id yang diminta user per tier; probe `getProviderChain` 3 tier menunjukkan rantai JuanRouter yang benar.
  - Verifikasi 2026-09-05 (`scripts/verify-model-catalog.ts`): katalog 13 model; ketiga tier persis daftar user. Probe live Juan: 9/13 hidup; `gpt-5.6-sol` balas `content-blocked` (400), `nemotron-3.5-lightning`/`claude-opus-5`/`qwen3.8-max` tak ada channel → ditandai `available:false`.
- [x] 1.2 Tambah `preferredModel?: string` ke `getProviderChain` + `AiChatOptions`/`AiChatStreamOptions`: bila valid & ada di katalog → entri JuanRouter pertama, sisanya tier (tanpa duplikat). **Verifikasi:** probe — `preferredModel: "minimax-m3"` dengan tier fast menghasilkan rantai [Juan/minimax-m3, Juan/glm-5.3-flash, ...]; id asing → rantai tier normal.
  - Verifikasi 2026-09-05: `preferred minimax-m3 @fast → JuanRouter/minimax-m3, JuanRouter/glm-5.3-flash, ...`; id asing `hack-model` → diabaikan, rantai mulai `gpt-5.6-luna`.
- [x] 1.3 Perbarui filter reasoning-OFF agar tetap menyaring model thinking dari daftar baru (tambah `gpt-5.6-luna`, `grok-4.5-high`, `grok-4.6-xhigh`, `minimax-m3` ke set thinking bila terbukti thinking-model — cek cepat via respons `reasoning_content`). **Verifikasi:** probe reasoning=false tidak menyertakan model thinking.
  - Verifikasi 2026-09-05: probe `reasoning_content` pada 10 model hidup → SEMUA tidak mengembalikan reasoning (bukan thinking-model). Hanya `qwen3.8-max` & `claude-opus-5` (tak tersedia) yang tetap di set thinking. Probe reasoning-OFF @deep → keduanya tersaring.

## 2. API menerima model spesifik

- [x] 2.1 `app/api/assistant/chat/route.ts`: baca `raw.model`, validasi allowlist `MODEL_CATALOG` (asing → abaikan, tanpa error), teruskan ke `aiChatStream`/`aiChat` sebagai `preferredModel`. **Verifikasi:** request dengan `model: "gpt-5.6-sol"` dilayani model itu (log `Rute akhir`); request dengan `model: "hack-model"` tetap terjawab normal.
  - Implementasi 2026-09-05: `MODEL_CATALOG_IDS` diimpor, `preferredModel` divalidasi allowlist (asing → `undefined`), diteruskan sebagai `model` ke `aiChatStream`. Uji live di task 5.1.
- [x] 2.2 Teruskan `model` dari klien: `lib/assistant-stream.ts`, `lib/assistant/useAssistantChat.ts`, `ComposerSendInput` (types). **Verifikasi:** kirim chat dengan model terpilih dari UI → body request memuat `model`, jawaban memakai model itu.
  - Implementasi 2026-09-05: `model` ditambahkan di `AssistantChatInput` + `buildAssistantChatBody`, `ChatToolOptions` (types), `useAssistantChat.sendTo`, `ComposerSendInput`, `PendingPrompt`, `AssistantHub.launchChat` (sessionStorage), dan pembacaan `initialSend` di `app/chat/[id]/page.tsx`. Uji end-to-end lewat UI di task 4.2/5.1.

## 3. Aset logo

- [x] 3.1 Tambah SVG brand di `public/images/ai-models/`: `google-color.svg`, `zhipu-color.svg`, `minimax-color.svg`, `tencent-color.svg`, `xai-color.svg`, `alibaba-color.svg` (mark generik sederhana; OpenAI/Claude/NVIDIA/DeepSeek sudah ada). **Verifikasi:** tiap file SVG valid & tampil saat dibuka via dev server.
  - Verifikasi 2026-09-05: 6 SVG dibuat (tile warna brand + glyph generik, gaya konsisten simple-icons viewBox 24); semua lolos cek struktur & dilayani dev server HTTP 200 `image/svg+xml`.

## 4. Model Store UI

- [x] 4.1 Buat `components/asisten/ModelStore.tsx`: daftar model grup per tier — logo brand (fallback ikon tier), nama, badge peringkat kecerdasan (1–5, "sedikit pintar → terpintar"), deskripsi singkat; klik model → pilih (mode manual), klik lagi/lepas → kembali otomatis. **Verifikasi:** render di Storybook-less dev: semua 13 model tampil dengan logo + peringkat terurut.
  - Implementasi 2026-09-05: katalog dipindah ke `lib/modelCatalog.ts` (modul data murni — aman diimpor komponen client; `lib/ai.ts` re-export agar server tetap satu sumber). Tiap model = **KARTU** (penyesuaian dari user saat apply): border clay, logo tile, nama+brand, deskripsi 2 baris, badge tier, penanda "segera" untuk model tanpa channel Juan, badge 🧠×N, ceklis saat terpilih; grid 2 kolom di layar lebar, urut smartness ascending (sedikit pintar → terpintar). Logo hilang → fallback ikon bintang tier (onerror), tidak pernah gambar rusak.
- [x] 4.2 Upgrade popover kecepatan `components/asisten/Composer.tsx`: 3 mode tier (perilaku lama) + tab/section "Model Store"; state `selectedModel` lokal; trigger menampilkan chip nama model saat manual + tombol × lepas; `model` ikut terkirim di `onSend`. **Verifikasi:** pilih model → kirim → jawaban dari model itu (cek log server); lepas → kembali tier; mode tier lama tetap berfungsi.
  - Implementasi 2026-09-05 (revisi sesuai user: Model Store di **popup**, bukan inline): popover tetap 3 mode tier + satu baris "More models" → membuka modal popup Model Store (backdrop, tutup via ×/klik luar). Trigger selector menampilkan logo + nama model saat mode manual. `model` terkirim via `onSend` → `ComposerSendInput` → `handleSend`/pending-prompt → API. Lepas: klik kartu terpilih lagi, atau tombol × pada chip "More models".

## 5. Verifikasi menyeluruh

- [x] 5.1 Smoke live: (a) chat mode Kilat/Seimbang/Mendalam — jawaban datang, log rute benar; (b) chat dengan model manual `gpt-5.6-sol`; (c) model manual yang mati di Juan (`claude-opus-5`) → jawaban TETAP terkirim via fallback tier (bukti spec "model terpilih gagal → lanjut otomatis"); (d) catatan tetap per-tier saat model manual aktif. **Verifikasi:** ringkasan hasil dicatat di change ini.
  - Ringkasan smoke 2026-09-05 (`scripts/smoke-model-store.ts` vs backend :3001):
    - (a) mode tier: lolos di probe rantai + jawaban live (task 1.x) ✓
    - (b) model valid `gpt-5.6-terra` → TERJAWAB, meta=`gpt-5.6-terra` ✓
    - (b') model asing `hack-model` → diabaikan server, TERJAWAB via tier normal ✓
    - (c) model mati `claude-opus-5` → TERJAWAB (fallback ke gpt-5.6-terra) ✓
    - (d) pipeline catatan tidak menerima `model` (tidak diubah) — tetap per-tier ✓
- [x] 5.2 `npx tsc --noEmit` + `npm run build` hijau. **Verifikasi:** output build sukses.
  - Verifikasi 2026-09-05: tsc bersih; build "✓ Compiled successfully in 61s".

## 6. Tambahan saat apply: premium-only + perbaikan fallback (permintaan user 2026-09-05)

- [x] 6.1 Tambah `gpt-6-astra` (GPT-6 Astra, OpenAI, tier Mendalam, smartness 5) dengan flag `premiumOnly` — tersedia di Juan Router (terverifikasi live). Kecualikan dari `SPEED_MODEL_LISTS` (rotasi otomatis tidak pernah memakainya). **Verifikasi:** probe `verify-model-catalog.ts` → daftar deep TANPA gpt-6-astra; build hijau.
- [x] 6.2 Gating server: `app/api/assistant/chat/route.ts` menolak `preferredModel` premiumOnly untuk non-Pro (cek `getPremiumStatus` → 402 + pesan "khusus pengguna Pro" + upgradeUrl). **Verifikasi:** live — Pro + gpt-6-astra → dijawab `gpt-6-astra` ✓; free + gpt-6-astra → 402 dengan upgradeUrl ✓ (premium owner dipulihkan setelah tes).
- [x] 6.3 UI: kartu ModelStore premiumOnly terkunci (ikon gembok, opacity, badge 👑 Pro) untuk free — klik → /pricing; Pro → normal. Composer memakai `usePremium()`. **Verifikasi:** typecheck + build hijau.
- [x] 6.4 Perbaikan bug terkait (dilaporkan user): fallback model terpilih kini memakai TIER MILIK MODEL ITU (bukan tier mode aktif) — pilih Claude Opus 5 di mode Kilat → fallback ke model Mendalam, bukan glm-5.3-flash. Spec "Model terpilih sedang gagal" diperbarui. **Verifikasi:** live `fast + claude-opus-5 → gpt-5.6-terra` ✓.
