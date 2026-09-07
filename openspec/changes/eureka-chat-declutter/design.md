# Design: Eureka Chat Declutter

## Context

Halaman chat (`app/chat/[id]/page.tsx`) menyusun: topbar header (logo, judul, indikator iterasi, tombol Canvas/Salin chat/Bagikan/Baru), `ChatSidebar` (daftar sesi, tombol + Baru), `MessageBubble` (avatar, bubble, meta model, CopyButton, durasi, SourceChips), `ArtifactCanvas` (header panel, tab multi-artifact, konten, toolbar, footer versi·agent), dan `Composer` (textarea, menu +, selector model "Kilat", tombol kirim).

Design system clay berlaku: token `--clay-*` (radius scale `clay/clay-md/clay-sm/clay-full`, solid shadow tanpa blur, palet ungu primary) + `--accent-coral` (dari change eureka-multi-agent-system). Semua token DIPERTAHANKAN; perubahan hanya pada pemakaiannya.

## Goals / Non-Goals

- Goals: satu hierarki aksen (coral = aksi primer), metadata teknis jadi sekunder (hover/tooltip), header ringkas satu primer + overflow, canvas minimal ala Claude, sitasi ringan, whitespace lebih.
- Non-Goals: mengubah nilai token warna/radius/shadow; menghapus fitur; menyentuh API/DB; redesign halaman non-chat.

## Decisions

### D1. Aksen primer tunggal = coral; ungu turun jadi brand saja

- Tombol kirim, toggle Multi Agent aktif, chat terpilih di sidebar, tombol "Bagikan" (primer header), tombol "+ Baru" (primer sidebar) → semua coral.
- `--clay-primary` (ungu) tetap dipakai untuk logo/avatar/ikon dekoratif — bukan untuk tombol aksi yang bersaing coral.
- **Alternatif ditolak**: menjadikan ungu primer — bertabrakan dengan coral yang sudah dipakai toggle Multi Agent & indikator iterasi.

### D2. Metadata teknis → lapisan hover

- Tag "VIA <MODEL>" dihapus dari alur default bubble. Model tetap terlihat via tooltip ikon info kecil (muncul on-hover di area meta).
- Durasi ("AI menjawab dalam X") ikut masuk tooltip yang sama — bukan teks permanen.
- Footer canvas "v1 · jejak" → teks ramah "Tersimpan otomatis · v1" (versi tetap terlihat; nama agent tak lagi). Codename agent tampil hanya di `title`/tooltip.

### D3. Header chat: satu primer + ikon sekunder + overflow

- Tombol solid coral: **Bagikan** (aksi paling jarang merusak & paling bernilai sosial).
- Ikon ghost minimal (outline, tanpa pill berwarna): Canvas (dengan badge count kecil bila >0), Salin chat, Baru (+).
- Bila layar sempit atau aksi >3: Salin chat & Baru masuk menu overflow "⋯" (popover clay yang sudah jadi pola di repo).

### D4. Canvas ala Claude

- Header panel: ikon tipe + judul + badge format kecil ("MD"/"TER"/"IMG") di kiri; ikon aksi (copy, expand/close) di kanan — toolbar bawah untuk markdown edit dipertahankan tapi dirender sebagai ikon ghost.
- Sitasi/sumber dokumen (jika ada di konten artifact): render sebagai satu baris kecil netral (ikon FileText + nama) di atas konten — deteksi dari konten markdown yang memuat baris `*(Sumber: …)*`.
- Tab multi-artifact dipertahankan (fungsional) tapi direstapi lebih ringan (chip kecil netral, aktif = coral tipis).

### D5. Bubble & Sidebar

- CopyButton per-pesan: muncul on-hover bubble (group-hover), posisi meta bar.
- Sidebar: highlight aktif ganti dari `bg-clay-primary/15 + inset ungu` ke `bg-[rgb(var(--accent-coral))]/12 + inset coral tipis`; elemen ungu lain di sekitar tombol + Baru diturunkan jadi netral.

### D6. Komposer

- Selector model/kecepatan ("Kilat") → gaya ghost outline netral (bukan solid berwarna); hanya menampilkan dot warna kecil status tier.
- Tombol kirim tetap solid coral — satu-satunya elemen solid di bar input.

## Risks / Trade-offs

- Hover-only info menambah satu langkah untuk akses detail (di mobile hover tak ada) → ikon info kecil tetap tap-able (tooltip via tap di mobile).
- Menu overflow menyembunyikan aksi → hanya aksi yang benar-benar jarang (Salin chat, Baru di desktop sudah ada di sidebar) yang masuk overflow.
- Konsistensi warna menyentuh beberapa komponen sekaligus → dilakukan per-komponen dalam task terpisah agar mudah direview.

## Migration Plan

Urutan implementasi: globals/aksesoris kecil → bubble → canvas → header → sidebar → composer. Semua di belakang perubahan styling murni; tidak ada flag. Setiap task diakhiri cek visual dev server.

## Open Questions

- (tidak ada yang material — detail tooltip mobile mengikuti pola `title` attr existing yang sudah dipakai repo)
