## Context

- **Embed catatan**: `app/dashboard/note/[id]/page.tsx:886` menggerbangi player dengan `isBeta && data.subject === "YouTube"`; `lib/notesProcessor.ts:287` menyimpan `sourceUrl: first?.sourceUrl` — hanya sumber PERTAMA. Spec `youtube-video-chat` sudah mewajibkan embed tanpa beta, jadi ini penyelarasan kode-ke-spec + perbaikan kasus multi-sumber.
- **Image chat**: `app/api/assistant/image/route.ts` memakai `generateAiIllustration()` (Cloudflare FLUX, `lib/cloudflareImages.ts`) → data URL. Terverifikasi live: OpenAgentic `POST /images/generations {model:"ali-qwen-image-2.0-pro", prompt, size, n}` → `{data:[{url}]}` dengan URL OSS yang kedaluwarsa ±7 hari.

## Goals / Non-Goals

**Goals:**
- Player YouTube tampil di catatan untuk semua user; sumber YouTube di posisi berapa pun terdeteksi.
- Generate gambar chat memakai `ali-qwen-image-2.0-pro` sebagai utama; hasil awet (data URL); Cloudflare fallback.

**Non-Goals:**
- Ubah gating premium gambar / rate limit (tetap).
- Simpan gambar ke storage permanen (Cloudflare Images) — di luar cakupan; data URL cukup utk alur overlay saat ini.
- Ubah alur video chat (`/chat`) — hanya halaman CATATAN.

## Decisions

### 1. Sumber YouTube: `sourceUrl` diprioritaskan ke URL YouTube
**Decision**: Di `notesProcessor`, URL sumber YouTube pertama (posisi berapa pun) diprioritaskan menjadi `sourceUrl` catatan (`youtubeSourceUrl ?? first?.sourceUrl`); `pdfImages` melewati scrape Firecrawl bila `sourceUrl` adalah link YouTube (bukan halaman artikel — toh tak ada gambar, dan jalurnya fallback ke pencarian). Halaman catatan cukup cek `findYoutubeLink(sourceUrl)` (sudah ada) TANPA syarat `subject === "YouTube"`.
**Why**: spesifikasi mensyaratkan player tampil utk catatan multi-sumber yang memuat YouTube "di posisi berapa pun" — prioritas-first (versi awal design) gagal di kasus web+YouTube. pdfImages tetap utuh utk catatan web murni; catatan web+YouTube kehilangan satu scrape YouTube yang memang tak berguna.
**Alternatives**: simpan first-source — ditolak (melanggar skenario spec).

**KOREKSI saat implementasi (ditemukan via verifikasi live DB)**: asumsi awal "tidak perlu skema baru" SALAH — kolom `source_url` tidak pernah ada di tabel `notes`, `saveNoteWithChunks` tidak menyimpannya, dan `setNote` halaman catatan tidak mengisinya → embed adalah dead code sejak awal. Keputusan final: **patch SQL `supabase_patch_019_note_source_url.sql`** (ALTER TABLE notes ADD COLUMN source_url TEXT) + wiring penuh: simpan saat insert, kembalikan di GET `/api/notes/[id]`, isi `setNote.sourceUrl` di halaman. Pola patch mengikuti `supabase_patch_*.sql` yang ada (dijalankan manual di Supabase SQL Editor).

### 2. Provider gambar: modul baru `lib/image-gen.ts`, API route tidak berubah bentuk
**Decision**: Fungsi `generateImageViaOpenAgentic(prompt): Promise<string|null>` (data URL) — panggil `/images/generations`, lalu `fetch(url)` unduh → base64 data URL. Route `/api/assistant/image` memanggil ini DULU, fallback `generateAiIllustration()` (Cloudflare). Model dari env `OPENAGENTIC_IMAGE_MODEL` (default `ali-qwen-image-2.0-pro`).
**Why**: memisahkan tanggung jawab (cloudflareImages.ts tetap khusus Cloudflare); respons route tetap `dataUrl` sehingga `ImageGenerationOverlay` klien tidak perlu berubah.
**Alternatives**: ganti total Cloudflare — ditolak, spec meminta fallback; simpan URL OSS — ditolak, URL mati (spec: wajib materialisasi server).

### 3. Batas ukuran unduhan gambar
**Decision**: unduh hasil model dibatasi ±10 MB & timeout 30 dtk; di luar itu dianggap gagal → fallback.
**Why**: mencegah memori membengkak dari respons pihak ketiga.

## Risks / Trade-offs

- **[Data URL besar di memori respons]** → gambar 1024px ±1-2 MB base64; sesuai pola Cloudflare yang ada sekarang (sudah data URL) — tidak regresi.
- **[Model image berganti id/tarif]** → override env `OPENAGENTIC_IMAGE_MODEL` tanpa deploy kode.
- **[Melonggarkan gerbang beta]** → player YouTube jadi terlihat semua user — memang permintaan; fitur tanya-AI tentang video tetap seperti adanya.

## Open Questions

- (tidak ada — bentuk API sudah diverifikasi live saat riset)
