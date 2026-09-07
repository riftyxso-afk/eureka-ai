# Tasks: Eureka Chat Declutter

Semua perubahan bersifat styling/restrukturisasi — token design system existing TIDAK diubah nilainya, tidak ada fitur dihapus.

## 1. Header Chat

- [x] 1.1 Ganti tombol "Bagikan" jadi satu-satunya tombol solid coral di header (`bg-[rgb(var(--accent-coral))] text-white`)
- [x] 1.2 Ubah tombol "Canvas (N)" & "Salin chat" jadi ikon ghost minimal (tanpa pill berwarna; badge count kecil di ikon Canvas bila ada artifact)
- [x] 1.3 Kelompokkan "Salin chat" & "Chat baru (+)" ke menu overflow "⋯" (popover clay pola existing) — tampil sebagai ikon overflow; tombol "+" yang ada saat ini dipindah ke dalamnya
- [x] 1.4 Rapikan indikator iterasi Multi Agent tetap coral tipis (sudah sesuai) & pastikan tidak menambah kepadatan header

## 2. Bubble Chat

- [x] 2.1 Hapus tag "VIA <MODEL>" dari alur default `MessageBubble` — ganti ikon info kecil (Info lucide) dengan `title` tooltip berisi nama model
- [x] 2.2 Pindahkan durasi respons ("AI menjawab dalam X") dari teks permanen ke tooltip yang sama (gabung dengan nama model di title ikon info)
- [x] 2.3 Ubah CopyButton per-pesan menjadi ikon kecil yang muncul on-hover (`opacity-0 group-hover:opacity-100`, tetap tap-able di mobile)
- [x] 2.4 Tambah whitespace: naikkan `gap` antar bubble & kurangi border-ganda pada area meta

## 3. Artifact Canvas

- [x] 3.1 Restrukturisasi header panel: ikon tipe + judul + badge format kecil ("MD"/"TER"/"IMG") di kiri; ikon aksi (copy, close) minimal di kanan — hilangkan label teks "Artifact Canvas" berlebih
- [x] 3.2 Ganti footer "v1 · jejak" → "Tersimpan otomatis · v1" (codename agent hanya di `title` tooltip)
- [x] 3.3 Sitasi sumber dokumen: deteksi baris `*(Sumber: …)*` di konten markdown → render sebagai satu baris teks kecil netral dengan ikon FileText di atas konten (hilangkan dari alur markdown utama bila dideteksi)
- [x] 3.4 Restapi toolbar: Copy/Edit/Simpan sebagai ikon ghost dengan label singkat, bukan dua tombol solid berdampingan
- [x] 3.5 Ringankan tab multi-artifact: chip kecil netral, aktif = latar coral tipis

## 4. Sidebar

- [x] 4.1 Ganti highlight chat aktif dari ungu (`bg-clay-primary/15` + inset `#8B5CF6`) ke coral tipis (`bg-[rgb(var(--accent-coral))]/12` + inset coral)
- [x] 4.2 Turunkan elemen ungu sekunder di sekitar tombol "+ Baru" (avatar bulat & badge) ke warna netral supaya tombol + Baru coral jadi satu-satunya elemen menonjol

## 5. Composer (Input Box)

- [x] 5.1 Ubah selector kecepatan/model ("Kilat") dari solid berwarna jadi ghost outline netral dengan dot status tier kecil
- [x] 5.2 Pastikan tombol kirim coral solid satu-satunya elemen solid di bar input (toggle di menu + tidak berubah karena sudah ikon list)

## 6. Penutup

- [x] 6.1 Audit fitur: jalankan app & pastikan semua aksi lama masih dapat diakses (salin chat/pesan, canvas toggle, bagikan, barunya, rename, delete, selector model)
- [x] 6.2 Cek dark mode: semua perubahan warna memakai `rgb(var(--accent-coral))` yang sudah punya nilai dark di globals.css
- [x] 6.3 Ringkasan file yang diubah di akhir implementasi

## Ringkasan File yang Diubah

| Komponen / File | Perubahan |
|---|---|
| `app/chat/[id]/page.tsx` | Header chat: satu tombol solid primer ("Bagikan"), tombol "Canvas" & "Salin chat" menjadi ikon ghost minimal, toggle canvas interaktif |
| `components/asisten/MessageBubble.tsx` | Sembunyikan tag model & durasi teks permanen, digabung ke tooltip ikon `Info` kecil on-hover; tombol copy muncul on-hover |
| `components/asisten/ArtifactCanvas.tsx` | Header minimalis (ikon tipe + judul + badge format MD/TER/IMG), sitasi sumber menjadi baris teks ringan, footer ramah ("Tersimpan otomatis · v1"), toolbar icon ghost |
| `components/asisten/ChatSidebar.tsx` | Highlight chat aktif beralih ke warna aksen tunggal coral tipis (`--accent-coral`), tombol Baru konsisten solid coral |
| `components/asisten/Composer.tsx` | Selector kecepatan "Kilat" beralih dari solid pill ke ghost outline netral dengan status dot berwarna |
| `lib/mathText.ts` | Auto-wrapper LaTeX cerdas untuk merender rumus mentah tanpa tanda `$` ke KaTeX |
| `lib/assistant/prompt.ts` | Penegasan aturan wajib pembungkusan `<artifact>` untuk catatan & rangkuman rumus |
