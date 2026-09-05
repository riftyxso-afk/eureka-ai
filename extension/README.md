# Panduan Pemasangan & Penggunaan Eureka.AI Browser Extension

Ekstensi Chrome/Edge yang menambahkan **tutor Socratic AI** langsung di browser.
Highlight teks untuk bertanya, atau simpan tab jadi catatan — tanpa pindah halaman.

> **Syarat**: Chrome / Edge **versi 116 atau lebih baru**.

---

## 1. Download

1. Buka **https://eureka-ai.web.id/extension**
2. Klik tombol **Download Ekstensi (.zip)**
3. File `eureka-extension.zip` akan terunduh

---

## 2. Ekstrak

1. Buka folder **Downloads**
2. Klik kanan pada `eureka-extension.zip` → **Extract All...**
3. Pilih folder tujuan (misalnya `Desktop\Eureka Extension`)
4. Pastikan hasilnya seperti ini:

```
Eureka Extension/
  manifest.json
  background.js
  content.js
  config.js          ← sudah terisi otomatis
  sidepanel.html
  sidepanel.css
  sidepanel.js
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
```

---

## 3. Pasang di Chrome

1. Buka address bar, ketik:
   ```
   chrome://extensions
   ```
2. Aktifkan **Developer mode** (sudut kanan atas)
3. Klik **Load unpacked**
4. Pilih folder hasil ekstrak (folder yang berisi `manifest.json`)
5. Ekstensi Eureka akan muncul di daftar — icon **E ungu** akan tampil di toolbar

> **Tips**: Klik ikon puzzle 🧩 di toolbar → sematkan (pin) Eureka agar selalu terlihat.

---

## 4. Login (pertama kali)

1. Klik icon **E** ungu di toolbar → side panel terbuka di sisi kanan browser
2. Masukkan **email** kamu → klik **Kirim Kode**
3. Cek inbox email → masukkan **kode 6 digit** → klik **Masuk**
4. Login berhasil! Kamu akan melihat header **🔥 0 hari** dan chat kosong

> Sesi login **persisten** — kamu tidak perlu login ulang sampai token kedaluwarsa (beberapa hari).

---

## 5. Cara Menggunakan

### 5a. Highlight-to-Tanya (Tanya dari teks)

Fitur utama: pilih teks di halaman mana pun, lalu minta Eureka menjelaskan dengan metode Socratic.

1. Buka halaman web mana pun (artikel, Wikipedia, LMS, PDF, dsb.)
2. **Seleksi teks** yang ingin kamu tanyakan (blok teks dengan mouse)
3. **Klik kanan** → pilih **Tanya Eureka**
4. Side panel terbuka dengan teks terpilih sebagai konteks
5. Eureka akan **menjawab dengan pertanyaan pemandu**, bukan jawaban langsung
6. Jawab pertanyaannya → Eureka melanjutkan ke pertanyaan berikutnya

**Contoh penggunaan:**
- Di Wikipedia: seleksi paragraf tentang fotosintesis → Tanya Eureka
- Di Google Docs: seleksi rumus kimia → Tanya Eureka
- Di PDF viewer: seleksi definisi hukum → Tanya Eureka

### 5b. Tab-to-Note (Simpan tab sebagai catatan)

Fitur untuk mengubah halaman web menjadi catatan terstruktur.

1. Buka artikel atau halaman yang ingin dicatat
2. Klik icon **E** di toolbar → buka side panel
3. Klik tombol **Catat** (di bagian atas panel)
4. Draft catatan akan muncul otomatis:
   - **Judul** halaman
   - **Tag** (domain situs)
   - **Ringkasan** (dihasilkan AI)
   - **Pertanyaan reflektif** (2-3 pertanyaan untuk mendalami)
5. **Edit** draft jika perlu (judul, tag, atau isi)
6. Klik **Simpan**
7. Catatan akan muncul di dashboard **dalam hitungan detik**

**Contoh:** Buka artikel BBC tentang climate change → Catat → Edit judul → Simpan → Langsung muncul di dashboard.

### 5c. Chat Biasa (Tanpa konteks halaman)

Kamu juga bisa langsung bertanya tanpa memilih teks:

1. Klik icon **E** di toolbar
2. Ketik pertanyaan di kolom chat
3. Kirim → Eureka akan menjawab dengan metode Socratic

### 5d. Streak (Lacak Kebiasaan Belajar)

- Header panel menampilkan **🔥 N hari** = jumlah hari berturut-turut kamu belajar
- Badge angka juga muncul di icon toolbar
- Streak bertambah otomatis saat kamu berinteraksi dengan Eureka

---

## 6. Fitur Lain

| Fitur | Keterangan |
|-------|-----------|
| **Session persisten** | Chat tetap ada walau kamu pindah tab atau buka tab baru |
| **Multi-tab** | Buka Eureka di tab mana pun, percakapan tetap sama |
| **Ringan** | Tidak ada tracking pasif, hanya aktif saat kamu klik |

---

## 7. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Icon tidak muncul | Pastikan Developer mode aktif di `chrome://extensions` |
| Login gagal | Pastikan email dan kode OTP benar. Cek folder spam |
| "Tanya Eureka" tidak muncul di menu kanan | Pastikan kamu menyeleksi **teks** dulu, lalu klik kanan |
| Catatan tidak muncul di dashboard | Tunggu beberapa detik. Jika masih tidak ada, cek koneksi backend |
| Panel kosong setelah login | Reload panel (klik icon E lagi) atau restart browser |
| Error merah di `chrome://extensions` | Reload extension: klik ikon refresh 🔄 |

---

## 8. Uninstall (Hapus)

1. Buka `chrome://extensions`
2. Cari **Eureka.AI**
3. Klik **Remove**

---

## 9. Untuk Pengembang

### Regenerasi ZIP (setelah edit kode)

```bash
# Dari root repo eureka-ai
npm run build:extension
```

Script akan membuat ulang `public/eureka-extension.zip` dengan config produksi.

### Struktur file

| File | Peran |
|------|-------|
| `manifest.json` | Manifest V3, permissions minimal |
| `config.js` | API_BASE + Supabase anon key (generated dari env) |
| `background.js` | Context menu, buka panel, ekstrak tab, badge streak |
| `content.js` | Ekstraksi readability, hanya saat disuntik eksplisit |
| `sidepanel.html/.css/.js` | UI chat + login + draft (tema clay) |
| `icons/` | Icon toolbar coral "E" |
| `PRIVACY.md` | Kebijakan privasi untuk Chrome Web Store review |
