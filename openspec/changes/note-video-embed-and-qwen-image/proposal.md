## Why

Dua kemampuan yang diminta user belum tuntas: (1) catatan yang dibuat dari link YouTube seharusnya menampilkan player video agar bisa belajar sambil menonton — spec `youtube-video-chat` SUDAH mewajibkan ini untuk semua pengguna, tapi kode menggerbanginya dengan `isBeta` dan hanya membaca `sourceUrl` sumber pertama (catatan multi-sumber yang memuat YouTube tidak dapat embed); (2) generate gambar di halaman chat saat ini memakai Cloudflare FLUX — user meminta model OpenAgentic `ali-qwen-image-2.0-pro` (endpoint `/images/generations` sudah diverifikasi hidup, mengembalikan URL sementara).

## What Changes

- **Embed video catatan untuk semua user**: hapus gerbang `isBeta` pada player video di `/dashboard/note/[id]` (menyelaraskan kode dengan spec yang ada); `sourceUrl` YouTube dipilih dari SUMBER MANAPUN yang YouTube (bukan hanya sumber pertama) saat pipeline catatan menyimpan materi.
- **Generate gambar chat via OpenAgentic**: `/api/assistant/image` memakai `ali-qwen-image-2.0-pro` (via `OPENAGENTIC_API_KEY`) sebagai provider utama; server MEN-DOWNLOAD URL sementara OSS menjadi data URL sebelum dikirim ke klien; Cloudflare FLUX tetap fallback bila OpenAgentic gagal. Gerbang premium & rate limit tidak berubah.

## Capabilities

### New Capabilities
- `chat-image-generation`: generate gambar AI di halaman chat memakai model image OpenAgentic (URL sementara wajib di-materialisasi server-side), fallback Cloudflare, tetap premium-gated.

### Modified Capabilities
- `youtube-video-chat`: requirement "Embed video di halaman catatan" — player tampil untuk SEMUA pengguna (tanpa gerbang beta) dan selama catatan memuat sumber YouTube (di posisi sumber berapa pun).

## Impact

- Kode: `app/dashboard/note/[id]/page.tsx` (hapus gerbang beta), `lib/notesProcessor.ts` (pilih sourceUrl YouTube dari semua sumber), `app/api/assistant/image/route.ts` + `lib/cloudflareImages.ts`/modul image baru (provider OpenAgentic + unduh-ke-dataURL).
- Env: tidak ada yang baru (OPENAGENTIC_API_KEY sudah ada); opsional `IMAGE_MODEL` utk override model.
- Tidak ada perubahan skema DB; tidak ada dependensi baru (pakai `fetch` + `openai` yang ada).
