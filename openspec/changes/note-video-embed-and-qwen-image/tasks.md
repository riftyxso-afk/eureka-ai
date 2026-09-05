## 1. Embed video di halaman catatan (semua user + multi-sumber)

- [x] 1.1 Di `lib/notesProcessor.ts`, pilih URL YouTube dari SEMUA sumber (yang pertama ditemukan) dan jadikan `sourceUrl` catatan — KOREKSI desain saat implementasi: kolom `source_url` ternyata tidak pernah ada (embed dead code) → tambah `supabase_patch_019_note_source_url.sql` (dijalankan user) + wiring simpan/ambil di `lib/rag/store.ts`; verifikasi E2E live: catatan dokumen+YouTube → `source_url` = link YouTube ✓
- [x] 1.2 Di `app/dashboard/note/[id]/page.tsx`, longgarkan syarat render player: hapus gerbang `isBeta` + syarat `subject === "YouTube"` — cukup `findYoutubeLink(sourceUrl)` valid; `setNote` kini mengisi `sourceUrl`; verifikasi tsc 0 + E2E (subject "Dokumen" + sourceUrl YouTube tetap lolos syarat)
- [x] 1.3 Tombol "View" (overlay expand) kini untuk semua user — `isBeta` di halaman dihapus (tak dipakai lagi); overlay `viewVideo` tanpa gerbang; verifikasi tsc 0

## 2. Generate gambar chat via OpenAgentic

- [x] 2.1 `lib/image-gen.ts`: `generateImageViaOpenAgentic(prompt)` → `POST /images/generations` (model env `OPENAGENTIC_IMAGE_MODEL`, default `ali-qwen-image-2.0-pro`) + UNDUH URL sementara → data URL (maks 10 MB, timeout); verifikasi live: `data:image/...` ±1.2 MB ✓; model salah → null tanpa throw ✓
- [x] 2.2 `app/api/assistant/image/route.ts`: OpenAgentic utama → fallback `generateAiIllustration()` (Cloudflare); gate hanya bila KEDUA provider tak tersedia; premium & rate limit tak berubah; verifikasi tsc 0 + kontrak null→fallback
- [x] 2.3 Env `OPENAGENTIC_IMAGE_MODEL` ditambahkan di `.env.local`; override terverifikasi live (probe model kedua memakai nilai env)

## 3. Verifikasi akhir

- [x] 3.1 E2E live: catatan multi-sumber (dokumen+YouTube) → job `completed` + `source_url` = link YouTube (test note dibersihkan); gambar chat → data URL awet; jalur gagal → null → fallback Cloudflare; `npx tsc --noEmit` 0 error. Catatan: 429 saat test = perilaku benar (user punya generate aktif — dibatalkan manual)
