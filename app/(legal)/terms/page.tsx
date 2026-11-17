import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat Layanan | Eureka.AI",
  description: "Ketentuan menggunakan akun, fitur belajar, paket berbayar, dan konektor Eureka.AI.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <header>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Syarat Layanan</h1>
        <p>Syarat ini berlaku saat kamu menggunakan Eureka.AI untuk belajar, bertanya kepada AI, membuat materi, atau menghubungkan akun aplikasi lain.</p>
      </header>

      <section>
        <h2>Akun dan penggunaan yang diizinkan</h2>
        <p>Jaga keamanan akunmu dan hubungi kami jika kamu menduga akunmu dipakai orang lain. Pengguna yang memerlukan izin orang tua atau wali berdasarkan hukum yang berlaku harus mendapatkannya sebelum memakai layanan.</p>
        <p>Gunakan Eureka sesuai hukum. Hormati hak cipta dan privasi orang lain. Hindari penipuan, pelecehan, penyebaran perangkat lunak berbahaya, akses tanpa izin, dan tindakan yang mengganggu layanan.</p>
      </section>

      <section>
        <h2>Materi yang kamu masukkan dan hasil AI</h2>
        <p>Kamu tetap memegang hak yang kamu miliki atas materi yang kamu masukkan. Dengan memakai sebuah fitur, kamu mengizinkan Eureka memproses materi tersebut sejauh diperlukan untuk menjalankan fitur dan mengikuti <a className="underline underline-offset-4" href="/privacy">Kebijakan Privasi</a>. Pastikan kamu berhak mengunggah atau membagikan materi tersebut.</p>
        <p>Jawaban, ringkasan, dan materi dari AI dapat mengandung kesalahan. Periksa hasil dan sumbernya sebelum menjadikannya dasar tugas, karya, atau keputusan penting.</p>
      </section>

      <section>
        <h2>Konektor dan layanan pihak ketiga</h2>
        <p>Saat menghubungkan akun lain, kamu memberi izin sesuai pilihan yang ditampilkan oleh penyedia. Tinjau izin dan instruksi yang akan mengubah file, kalender, atau data di layanan itu. Ketentuan penyedia tersebut juga berlaku saat kamu menggunakannya.</p>
      </section>

      <section>
        <h2>Paket dan pembayaran</h2>
        <p>Harga, manfaat, serta masa berlaku paket ditampilkan sebelum pembayaran. Akses berbayar aktif setelah pembayaran berhasil diverifikasi. Untuk masalah tagihan, pembatalan, atau pengembalian dana, hubungi kami dengan menyertakan referensi transaksi. Hak konsumen berdasarkan hukum yang berlaku tetap berlaku.</p>
      </section>

      <section>
        <h2>Perubahan dan akses layanan</h2>
        <p>Fitur dapat berubah mengikuti pengembangan, pemeliharaan, atau ketersediaan penyedia. Akses dapat dibatasi untuk menangani penyalahgunaan, melindungi keamanan layanan, atau memenuhi kewajiban hukum. Perubahan syarat akan diterbitkan di halaman ini.</p>
      </section>

      <section>
        <h2>Kontak</h2>
        <p>Untuk pertanyaan tentang layanan atau syarat ini, hubungi <a className="break-all underline underline-offset-4" href="mailto:support@eureka-ai.web.id">support@eureka-ai.web.id</a>.</p>
      </section>
    </>
  );
}
