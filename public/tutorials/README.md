# Rekaman panduan halaman

Pop-up menampilkan placeholder sampai video halaman ditambahkan.

1. Simpan rekaman MP4/WebM di folder ini, misalnya `editor.mp4`.
2. Di `lib/pageGuides.ts`, tambahkan properti pada panduan yang sesuai:

   ```ts
   "room-notes": {
     // Judul, langkah, dan tombol yang sudah ada tetap digunakan.
     recording: { src: "/tutorials/editor.mp4", poster: "/tutorials/editor.webp" },
   }
   ```

`poster` opsional. URL video HTTPS juga dapat digunakan. Pemutar memiliki kontrol,
tidak autoplay, dan berhenti saat pop-up ditutup. Rekaman lanskap 16:9 disarankan;
video ditampilkan utuh tanpa dipotong. Jangan sertakan data akun atau API key
dalam rekaman.

ID ruang belajar: `room-learn`, `room-notes`, `room-mindmap`, `room-quiz`,
`room-cards`, `room-sources`, `room-ask`, `room-podcast`, `room-scratch`.
Beranda menggunakan `dashboard`, percakapan umum menggunakan `chat`.

Tutorial muncul sekali per fitur per akun pada browser yang sama. Tombol
**Panduan** membuka ulang. Mengganti video tidak menghapus pilihan pengguna.
