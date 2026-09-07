# Proposal: Eureka Chat Declutter

## Why

Halaman chat Eureka.AI saat ini memuat terlalu banyak elemen visual yang saling bersaing: warna aksen beragam (ungu, coral, gold, putih) tanpa hierarki, metadata teknis internal (tag model "VIA GLM 5.3 FLASH", codename agent "jejak") tampil permanen ke siswa, header chat dipenuhi tombol sejajar dengan bobot visual yang sama, sitasi sumber dokumen jadi banner berborder tebal, dan durasi respons menempel di tiap bubble. Hasilnya antarmuka terasa ramai dan siswa sulit tahu mana aksi utama.

Target: terasa bersih dan rapi seperti Claude.ai — **tanpa mengganti palet** — dengan memakai bahasa desain clay yang sudah ada (token warna/radius/shadow tetap). Ini murni restrukturisasi hierarki, konsistensi warna aksen, dan pengurangan elemen permanen yang jarang dibutuhkan.

## What Changes

- **Hierarki aksen tunggal**: `--accent-coral` jadi satu-satunya warna aksi primer (kirim, toggle aktif, highlight chat terpilih di sidebar); ungu (`--clay-primary`) tetap brand tapi tidak lagi jadi warna aksi yang bersaing; mint/violet hanya untuk badge status sekunder.
- **Header chat disederhanakan**: satu tombol solid ("Bagikan") sebagai aksi primer; "Canvas" & "Salin chat" jadi ikon minimal; aksi jarang pakai masuk menu overflow "⋯".
- **Metadata teknis disembunyikan by default**: tag model per-pesan dan codename agent di footer canvas dipindah ke tooltip/hover; durasi respons ("AI menjawab dalam…") jadi info on-hover.
- **Artifact Canvas dirapikan**: header minimal (ikon tipe + judul + badge format), sitasi sumber jadi satu baris teks halus netral (bukan banner berborder), footer ramah siswa ("Tersimpan otomatis"), toolbar jadi ikon minimal.
- **Bubble chat**: tombol Salin per-pesan muncul on-hover.
- **Whitespace**: kurangi divider/border yang tidak perlu, spacing yang memberi napas.

## Capabilities

### New capabilities

- `chat-visual-hierarchy`: aturan hierarki visual halaman chat — aksen primer tunggal, metadata teknis sekunder, header satu aksi primer + overflow, canvas minimal, sitasi ringan.

### Modified capabilities

- (tidak ada — tidak mengubah perilaku fungsional fitur existing; semua aksi tetap dapat diakses)

## Impact

- **File yang disentuh**: `app/chat/[id]/page.tsx` (header), `components/asisten/MessageBubble.tsx`, `components/asisten/ArtifactCanvas.tsx`, `components/asisten/ChatSidebar.tsx`, `components/asisten/Composer.tsx`, `app/globals.css` (hanya menambah `--accent-coral` konsistensi bila belum ada — token existing tidak diubah nilainya).
- **Fungsionalitas**: tidak ada yang dihapus — semua aksi (copy, canvas toggle, bagikan, salin chat) tetap bisa diakses; yang berubah adalah *kapan* dan *bagaimana* elemen terlihat.
- **Risiko rendah**: refactor styling & restrukturisasi markup; tidak menyentuh logika API/DB.
- **Non-goals**: ganti palet warna design system, ubah radius/shadow token, hapus fitur, redesign halaman lain (dashboard/notes) di luar halaman chat.
