import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | Eureka.AI",
  description: "Cara Eureka.AI mengelola data akun, aktivitas belajar, dan data dari konektor Google.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <header>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Kebijakan Privasi</h1>
        <p>Kebijakan ini menjelaskan bagaimana pengelola Eureka.AI menangani data saat kamu menggunakan situs, fitur belajar, dan konektor aplikasi.</p>
      </header>

      <section>
        <h2>Data yang kami proses</h2>
        <ul>
          <li>Data akun seperti nama, alamat email, identitas akun, dan profil belajar yang kamu isi.</li>
          <li>Materi yang kamu masukkan seperti percakapan, catatan, lampiran, dan tautan, serta hasil belajar yang tersimpan. Saat memakai fitur suara atau video, media diproses sesuai fitur yang kamu pilih.</li>
          <li>Data transaksi seperti paket, nominal, dan status pembayaran. Pembayaran diproses melalui penyedia pembayaran yang ditampilkan saat checkout.</li>
          <li>Data teknis dan penggunaan seperti informasi perangkat, sesi, dan peristiwa penggunaan fitur. Situs menggunakan cookie atau penyimpanan lokal untuk sesi dan preferensi, serta PostHog untuk mengukur penggunaan.</li>
        </ul>
        <p>Kami menggunakan data tersebut untuk menjalankan akun dan fitur belajar, menjaga keamanan, menangani pembayaran dan dukungan, serta memahami penggunaan layanan.</p>
      </section>

      <section>
        <h2>Data Google yang kami akses dan alasannya</h2>
        <p>Saat kamu masuk dengan Google, Eureka menggunakan identitas akun, alamat email, dan informasi profil dasar yang disediakan untuk membuat atau mengenali akunmu. Jika kamu memilih konektor di Pengaturan, kamu akan melihat permintaan izin tersendiri untuk layanan tersebut. Izin baca atau tulis mengikuti pilihanmu dan persetujuan di Google.</p>
        <ul>
          <li><strong>Google Drive.</strong> Kami membaca nama, ID, jenis, deskripsi, dan tautan file dari hasil pencarian. Jika kamu meminta membaca dokumen Google Docs atau file teks di Drive, kami mengambil teksnya untuk membantu menjawab. Dengan izin tulis, kami bisa menyimpan file baru dari materi yang kamu minta.</li>
          <li><strong>Google Docs.</strong> Kami membaca teks dan struktur dokumen yang kamu minta untuk dibahas. Dengan izin tulis, kami bisa membuat dokumen baru dan mengisinya saat diminta.</li>
          <li><strong>Google Sheets.</strong> Kami membaca nilai sel pada spreadsheet yang kamu tentukan untuk membantu mengolah atau menjelaskan tabel. Dengan izin tulis, kami bisa membuat dan mengisi spreadsheet baru saat diminta.</li>
          <li><strong>Google Slides.</strong> Kami membaca teks dan struktur slide dari presentasi yang kamu tentukan. Dengan izin tulis, kami bisa membuat presentasi baru dan mengisi slide saat diminta.</li>
          <li><strong>Google Calendar.</strong> Kami membaca informasi agenda dari kalender utama, seperti judul, keterangan dan waktu acara, untuk menjawab pertanyaan jadwal. Dengan izin tulis, kami bisa menambahkan acara yang kamu minta.</li>
          <li><strong>Gmail.</strong> Kami mencari pesan sesuai permintaan. Saat kamu meminta membaca pesan, kami mengambil informasi seperti subjek, pengirim, waktu, cuplikan, dan isi teks untuk membantu menjawab. Izin Gmail yang diminta adalah izin baca.</li>
        </ul>
      </section>

      <section>
        <h2>Penyimpanan dan pemrosesan data Google</h2>
        <p>Token akses dan penyegaran konektor disimpan dalam bentuk terenkripsi di penyimpanan server dan terikat pada akun Eureka. Token ini digunakan untuk menghubungi API Google melalui koneksi HTTPS.</p>
        <p>Saat kamu meminta tindakan melalui Chat atau Belajar, informasi dari Google yang digunakan untuk menyusun jawaban dapat dikirim ke penyedia inferensi AI yang menangani permintaan itu. Contohnya, teks email yang kamu minta untuk diringkas menjadi konteks bagi penyedia AI untuk menyusun ringkasan. Token konektor tidak dikirim ke model AI.</p>
        <p>Jawaban, cuplikan, tautan hasil, dan informasi tentang tindakan konektor dapat tersimpan bersama riwayat percakapan. Eureka juga menyimpan hasil aksi tulis untuk mendeteksi pengulangan permintaan dan menghindari pembuatan salinan ganda. File atau acara baru yang diminta disimpan di layanan Google yang kamu pilih.</p>
      </section>

      <section>
        <h2>Pembatasan penggunaan data Google</h2>
        <p>Eureka membatasi penggunaan data dari API Google pada fitur yang kamu gunakan sesuai <a className="underline underline-offset-4" href="https://developers.google.com/terms/api-services-user-data-policy">Kebijakan Data Pengguna Layanan API Google</a> dan ketentuan Limited Use dalam <a className="underline underline-offset-4" href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy">kebijakan pengembang Google Workspace</a>. Data Google Workspace tidak digunakan oleh Eureka untuk menayangkan iklan, dijual, atau digunakan untuk melatih model AI umum. Kendali ini berlaku juga pada hasil yang berasal dari data Google Workspace.</p>
      </section>

      <section>
        <h2>Penyedia layanan dan fitur berbagi</h2>
        <p>Eureka menggunakan penyedia hosting, penyimpanan, autentikasi, analitik, pembayaran, dan AI untuk menjalankan fitur. Konten yang kamu masukkan dapat diproses oleh penyedia yang menangani fitur tersebut. Saat kamu membuat tautan berbagi atau mengundang peserta, akses penerima mengikuti pilihan berbagi yang kamu gunakan.</p>
        <p>Eureka menyediakan pilihan terpisah untuk personalisasi belajar dan kontribusi contoh percakapan. Kontribusi contoh memerlukan persetujuan untuk contoh yang kamu pilih.</p>
      </section>

      <section>
        <h2>Retensi, pencabutan izin, dan penghapusan</h2>
        <p>Data akun dan materi tersimpan untuk menyediakan fitur yang membutuhkannya, termasuk riwayat belajarmu. Riwayat percakapan tetap tersedia sampai kamu menghapusnya. Catatan tertentu, seperti transaksi atau informasi keamanan, dapat disimpan sepanjang dibutuhkan untuk kewajiban hukum, penanganan sengketa, atau keamanan.</p>
        <ul>
          <li>Untuk menghentikan akses Eureka dan menghapus token konektor yang tersimpan, buka <strong>Pengaturan → Konektor</strong> dan pilih <strong>Lepas</strong> pada konektor tersebut.</li>
          <li>Untuk mencabut izin langsung dari Google, buka <a className="underline underline-offset-4" href="https://myaccount.google.com/connections">pengaturan koneksi akun Google</a>, pilih Eureka, lalu hapus aksesnya.</li>
          <li>Untuk menghapus hasil konektor yang sudah muncul di chat, pilih <strong>Hapus</strong> pada percakapan yang bersangkutan. Untuk meminta akses, koreksi, atau penghapusan data lain dan akun, hubungi <a className="break-all underline underline-offset-4" href="mailto:support@eureka-ai.web.id">support@eureka-ai.web.id</a>.</li>
        </ul>
        <p>Pelepasan konektor dan penghapusan percakapan berlaku di Eureka. Jika kamu ingin menghapus file atau acara yang telah dibuat di akun Google, kelola hasil tersebut dari layanan Google terkait.</p>
      </section>

      <section>
        <h2>Pengguna anak dan pembaruan kebijakan</h2>
        <p>Jika hukum yang berlaku mensyaratkan persetujuan orang tua atau wali untuk pemrosesan data anak, persetujuan itu harus diperoleh sebelum anak menggunakan akun Eureka. Orang tua atau wali dapat menggunakan alamat kontak di atas untuk mengajukan pertanyaan atau permintaan terkait data anak.</p>
        <p>Perubahan kebijakan akan diterbitkan di halaman ini. Jika penggunaan data Google berubah, kami akan memberi tahu pengguna dan meminta izin baru jika diperlukan.</p>
      </section>
    </>
  );
}
