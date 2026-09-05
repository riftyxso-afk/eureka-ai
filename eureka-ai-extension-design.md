# Design System: Eureka.AI Browser Extension

**Gaya:** Claymorphism — modern, playful, terasa "3D lembut" seperti tanah liat/dempul
**Audiens:** Siswa SMP–SMA & mahasiswa awal Indonesia (Gen Z)
**Konteks pakai:** Side panel sempit (~360–400px) yang muncul di samping browser, dipakai sambil belajar — harus terasa ringan dan tidak mengintimidasi, bukan seperti aplikasi kerja/produktivitas formal

---

## 1. Prinsip Desain

1. **Lembut, bukan datar.** Claymorphism berarti setiap elemen terasa punya volume — seperti dibentuk dari tanah liat, bukan ditempel di kaca. Semua shape punya sudut sangat membulat dan bayangan ganda (inner + outer) yang lembut.
2. **Satu warna aksen yang "hidup".** Eureka adalah tutor yang menuntun lewat pertanyaan — bukan mesin jawaban. Aksen utama harus terasa hangat dan mengundang, bukan korporat.
3. **Ruang terasa "ditiup", bukan padat.** Karena side panel sempit, hindari menjejalkan kartu identik bertumpuk. Beri napas antar elemen; satu fokus per layar (pertanyaan, catatan, atau progres — bukan ketiganya sekaligus).
4. **Motion menjawab aksi, bukan pajangan.** Klik → tombol "menekan ke dalam" seperti clay ditekan jari. Panel terbuka → satu gerakan naik-mekar (bukan fade generik). Tidak ada animasi hover yang jalan sendiri di elemen yang tidak disentuh.
5. **Nada tulisan: teman belajar, bukan aplikasi sekolah.** Bahasa Indonesia santai, kalimat pendek, tanpa jargon "silakan", "mohon", atau nada formal guru.

## 2. Palet Warna

Dasar clay yang hangat, bukan putih/abu generik SaaS — supaya bayangan clay terlihat natural (clay butuh base warm untuk shadow-nya terasa "menyatu", bukan abu-abu dingin default).

| Token | Hex | Peran |
|---|---|---|
| `--clay-base` | `#F1E9E0` | Background utama panel — warm sand, dasar tempat shape "clay" dibentuk |
| `--clay-surface` | `#FBF6F0` | Permukaan kartu/tombol yang timbul (lebih terang dari base) |
| `--clay-shadow-dark` | `#C9BBA8` | Bayangan bawah/kanan pada efek clay (cekung-cembung) |
| `--ink` | `#2E2A24` | Teks utama — coklat tua hangat, bukan hitam pekat |
| `--accent-coral` | `#FF6F59` | Aksen utama: tombol aksi, highlight pertanyaan Socratic, streak badge |
| `--accent-mint` | `#5FC9A8` | Aksen sekunder: status "paham/selesai", tag catatan |
| `--accent-violet` | `#8B7CD9` | Aksen tersier: mode voice/advanced, badge fitur baru |

Catatan: hindari terracotta `#D97757` (dikenali sebagai default AI-generated) — dipakai `#FF6F59` yang lebih jenuh dan lebih muda/energik, cocok untuk audiens remaja.

## 3. Tipografi

- **Display/heading:** *Fredoka* (Google Fonts) — bentuk huruf bulat-lembut yang secara visual "match" dengan bahasa clay, tanpa terasa kekanak-kanakan berlebihan di weight medium/semibold.
- **Body/UI text:** *Plus Jakarta Sans* — sans humanis, sangat legible di ukuran kecil (penting karena side panel sempit), dan punya angka tabular yang rapi untuk streak/skor.
- **Skala tipe** (base 15px karena konteks side panel sempit):
  - Heading panel: 20px / semibold / Fredoka
  - Judul soal/catatan: 16px / medium / Plus Jakarta Sans
  - Body chat: 14px / regular
  - Caption/meta (tag, timestamp): 12px / medium, letter-spacing normal (hindari tracked-out uppercase)

Line length dijaga pendek secara alami karena lebar panel ~360px — tidak perlu constraint tambahan.

## 4. Bahasa Bentuk (Shape Language) — Efek Clay

Resep dasar clay untuk setiap elemen "timbul" (tombol, kartu, bubble chat AI):

```css
.clay-raised {
  background: var(--clay-surface);
  border-radius: 24px;
  box-shadow:
    6px 6px 14px var(--clay-shadow-dark),
    -6px -6px 14px rgba(255, 255, 255, 0.9);
}
```

Untuk elemen "ditekan" (state aktif tombol, input field yang sedang fokus) — kebalikannya, shadow inner:

```css
.clay-pressed {
  background: var(--clay-base);
  border-radius: 24px;
  box-shadow:
    inset 4px 4px 10px var(--clay-shadow-dark),
    inset -4px -4px 10px rgba(255, 255, 255, 0.7);
}
```

Aturan pemakaian:
- **Border-radius besar & konsisten per level hierarki**: kartu utama 24px, tombol 18px, chip/tag 999px (pill). Jangan pakai satu radius untuk semua ukuran elemen (itu tell dari "SaaS-card kit" generik).
- **Maksimal 2 lapis kedalaman** di satu layar: elemen "timbul" di atas base, dan satu elemen "ditekan" untuk fokus (misal input aktif). Jangan tumpuk clay-di-atas-clay lebih dari itu, supaya tidak terasa berat.
- Ikon: gaya *rounded/filled* (bukan garis tipis outline) — konsisten dengan kelembutan clay.

## 5. Layout — Side Panel Utama

```
┌────────────────────────────┐
│  ● Eureka        🔥 5 hari  │  ← header: logo + streak badge (clay-raised, pill)
├────────────────────────────┤
│                             │
│   ╭─────────────────────╮   │
│   │ "Coba jelasin dulu, │   │  ← bubble pertanyaan Socratic
│   │  kenapa langkah ini │   │     (clay-raised, radius besar,
│   │  penting?"          │   │      warna clay-surface + aksen coral tipis di tepi)
│   ╰─────────────────────╯   │
│                             │
│        ╭───────────────╮   │
│        │ jawaban siswa │   │  ← bubble user, rata kanan,
│        ╰───────────────╯   │     clay-pressed (terasa "ditulis ke dalam")
│                             │
├────────────────────────────┤
│  [ 💬 Tanya ]  [ 📝 Catat ] │  ← dua tombol utama clay-raised
└────────────────────────────┘
```

- Alignment: **left-aligned** untuk semua teks (bukan center) — sesuai konteks belajar/baca, center hanya untuk empty state.
- Satu momen highlight per layar: kalau sedang di flow "Tanya", tombol "Catat" jadi versi tenang (outline clay tipis), bukan dua tombol dengan bobot visual sama — biar jelas apa yang lagi difokuskan.

## 6. Komponen Kunci

| Komponen | Spesifikasi |
|---|---|
| **Streak badge** | Pill kecil clay-raised warna base + angka coral bold, ikon api kecil gaya filled-rounded. Muncul di header, tidak berkedip/animasi kecuali nilainya berubah (lalu "pop" sekali) |
| **Tombol primer** | Clay-raised, background aksen coral, teks putih hangat (#FFF8F3), radius 18px. State pressed → clay-pressed dengan warna coral lebih gelap |
| **Bubble Socratic (AI)** | Clay-raised, clay-surface, sedikit border tipis warna coral 10% opacity di salah satu sisi (menunjukkan "ini dari Eureka") |
| **Bubble jawaban (user)** | Clay-pressed, rata kanan, warna clay-base |
| **Tag/kategori catatan** | Pill 999px radius, background mint/violet muda tergantung kategori, teks gelap — bukan uppercase, huruf normal |
| **Input field** | Clay-pressed permanen (terlihat seperti cekungan tempat menulis), placeholder nada santai: "tulis jawabanmu di sini..." |
| **Empty state (belum ada catatan)** | Ilustrasi sederhana bentuk clay blob + teks ajakan aktif: "Belum ada catatan. Highlight teks di halaman mana pun buat mulai." |

## 7. Motion

- **Buka side panel**: satu gerakan slide + scale dari 96% → 100% (200ms, ease-out) — seperti clay yang "mengembang" ke posisi
- **Tombol ditekan**: transisi ke `.clay-pressed` dalam 100ms, kembali ke raised saat dilepas
- **Streak bertambah**: badge melakukan satu "pop" (scale 1 → 1.15 → 1) sekali saat angka berubah, tidak berulang
- **Tidak ada**: hover animation di kartu yang tidak disentuh, fade-in berurutan saat load pertanyaan (semua muncul langsung, karena ini bukan halaman marketing)

## 8. Aksesibilitas & Kualitas Dasar

- Kontras teks `--ink` (#2E2A24) di atas `--clay-base`/`--clay-surface` memenuhi WCAG AA untuk teks body
- Semua tombol punya visible focus ring (outline coral 2px offset 2px) untuk navigasi keyboard — shadow clay saja tidak cukup menandakan fokus
- Hormati `prefers-reduced-motion`: ganti animasi "pop"/"mengembang" jadi transisi opacity sederhana
- Ukuran tap target minimal 40x40px meski panel sempit (audiens sering pakai di laptop dengan trackpad, presisi klik lebih rendah dari desktop mouse)

## 9. Yang Sengaja Dihindari

- Background krem `#F4F1EA` + aksen terracotta `#D97757` (tell umum desain AI-generated)
- Radius seragam di semua ukuran elemen tanpa hierarki
- Label eyebrow huruf kapital semua di atas heading
- Ikon outline tipis (bertentangan dengan bahasa bentuk clay yang lembut/penuh)
- Bayangan abu-abu datar generik (`rgba(0,0,0,.1)`) — semua shadow harus dual-tone (gelap clay + terang) supaya efek 3D-nya sungguhan
