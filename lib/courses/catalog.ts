import type { Course } from "./types";

export const CURATED_COURSES: Course[] = [
  {
    id: "excel-kerja",
    slug: "excel-kerja",
    title: "Excel untuk Kebutuhan Kerja",
    category: "Produktivitas",
    level: "Pemula",
    description:
      "Pelajari cara mengolah data kerja di Excel, mulai dari rumus dasar hingga tabel yang dapat diurutkan dan difilter.",
    outcome:
      "Mampu membuat rekap sederhana, menghitung ringkasan angka, menerapkan logika IF, dan menyiapkan tabel untuk dianalisis.",
    audience:
      "Pekerja kantoran, staf administrasi, dan pemula yang perlu mengolah angka atau daftar kerja dengan Excel.",
    prerequisites: [
      "Dapat menggunakan komputer dan memasukkan data ke dalam sel.",
      "Memahami operasi hitung dasar: tambah, kurang, kali, dan bagi.",
    ],
    estimatedMinutes: 28,
    version: 1,
    sourceKind: "curated",
    sources: [
      {
        id: "excel-kerja-source-microsoft-excel",
        title: "Pusat bantuan dan pembelajaran Excel",
        url: "https://support.microsoft.com/en-us/excel",
        note: "Rujukan resmi fitur dan penggunaan Microsoft Excel.",
      },
      {
        id: "excel-kerja-source-microsoft-tables",
        title: "Create and format tables",
        url: "https://support.microsoft.com/en-us/office/create-and-format-tables-e81aa349-b006-4f8a-9806-5af9df0ac664",
      },
    ],
    modules: [
      {
        id: "excel-kerja-fondasi",
        title: "Fondasi Data dan Rumus",
        description: "Bangun perhitungan yang benar dan ringkas data tanpa menjumlahkan manual.",
        lessons: [
          {
            id: "excel-kerja-data-rumus-dasar",
            title: "Memasukkan Data dan Menulis Rumus",
            summary: "Gunakan referensi sel dan operator hitung agar hasil mengikuti perubahan data.",
            minutes: 7,
            objectives: [
              "Menulis rumus Excel dengan referensi sel dan operator yang tepat.",
              "Membaca urutan perhitungan dan menggunakan tanda kurung saat diperlukan.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Rumus di Excel diawali tanda sama dengan (=). Alih-alih mengetik =12*25000, gunakan referensi seperti =B2*C2. Jika B2 berisi jumlah barang dan C2 berisi harga satuan, hasil akan diperbarui ketika salah satu sel sumber berubah.",
              },
              {
                type: "bullets",
                title: "Operator yang sering dipakai",
                items: [
                  "+ untuk penjumlahan dan - untuk pengurangan.",
                  "* untuk perkalian dan / untuk pembagian.",
                  "Tanda kurung mengelompokkan bagian yang harus dihitung lebih dahulu.",
                ],
              },
              {
                type: "example",
                title: "Menghitung nilai penjualan",
                text: "Jika B2 berisi 12 dan C2 berisi 25000, tulis =B2*C2 di D2. Hasilnya 300000. Salin rumus ke baris berikutnya untuk menghitung pasangan jumlah dan harga pada baris tersebut.",
              },
              {
                type: "callout",
                title: "Perhatikan urutan hitung",
                text: "Perkalian dan pembagian dikerjakan sebelum penjumlahan dan pengurangan. Rumus =2+3*4 menghasilkan 14, sedangkan =(2+3)*4 menghasilkan 20.",
              },
            ],
            questions: [
              {
                id: "excel-kerja-data-rumus-dasar-q1",
                prompt: "B2 berisi jumlah barang dan C2 berisi harga satuan. Rumus apa yang paling tepat untuk menghitung nilai penjualan di D2?",
                options: ["=B2+C2", "=B2*C2", "=B2/C2", "=SUM(B2:C2)"],
                answer: 1,
                explanation: "Nilai penjualan adalah jumlah barang dikali harga satuan, sehingga rumusnya =B2*C2.",
              },
              {
                id: "excel-kerja-data-rumus-dasar-q2",
                prompt: "Apa hasil rumus =2+3*4?",
                options: ["20", "24", "14", "10"],
                answer: 2,
                explanation: "Excel menghitung 3*4 terlebih dahulu, lalu menambahkan 2. Hasilnya 14.",
              },
            ],
            sources: [
              {
                id: "excel-kerja-data-rumus-dasar-source-formulas",
                title: "Create a simple formula in Excel",
                url: "https://support.microsoft.com/en-us/office/create-a-simple-formula-in-excel-11a5f0e5-38a3-4115-85bc-f4a465f64a8a",
              },
            ],
          },
          {
            id: "excel-kerja-fungsi-ringkasan",
            title: "Meringkas Angka dengan Fungsi",
            summary: "Hitung total, rata-rata, dan nilai ekstrem dengan fungsi bawaan Excel.",
            minutes: 7,
            objectives: [
              "Menggunakan SUM dan AVERAGE pada rentang data.",
              "Memilih MIN atau MAX untuk menemukan nilai terkecil atau terbesar.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Fungsi adalah rumus bawaan dengan nama dan argumen. Rentang D2:D6 berarti sel D2 sampai D6. Penulisan =SUM(D2:D6) lebih ringkas dan lebih mudah diperiksa daripada menjumlahkan setiap sel satu per satu.",
              },
              {
                type: "bullets",
                title: "Empat fungsi ringkasan",
                items: [
                  "SUM(rentang) menjumlahkan angka.",
                  "AVERAGE(rentang) menghitung rata-rata aritmetika.",
                  "MIN(rentang) mencari nilai terkecil dan MAX(rentang) mencari nilai terbesar.",
                ],
              },
              {
                type: "example",
                title: "Rekap penjualan mingguan",
                text: "Untuk nilai di D2:D6, gunakan =SUM(D2:D6) untuk total, =AVERAGE(D2:D6) untuk rata-rata, dan =MAX(D2:D6) untuk penjualan tertinggi. Letakkan hasil di luar rentang sumber agar tidak ikut dihitung.",
              },
              {
                type: "callout",
                title: "Sel kosong bukan angka nol",
                text: "AVERAGE mengabaikan sel kosong dalam rentang, tetapi angka 0 ikut dihitung. Pastikan sel kosong memang berarti tidak ada data, bukan nilai nol yang belum ditulis.",
              },
            ],
            questions: [
              {
                id: "excel-kerja-fungsi-ringkasan-q1",
                prompt: "Total pengeluaran tercatat di E2:E10. Rumus mana yang menghitung seluruh total tersebut?",
                options: ["=MAX(E2:E10)", "=AVERAGE(E2:E10)", "=SUM(E2:E10)", "=E2+E10"],
                answer: 2,
                explanation: "SUM menjumlahkan semua angka dalam rentang E2:E10. =E2+E10 hanya menjumlahkan sel pertama dan terakhir.",
              },
              {
                id: "excel-kerja-fungsi-ringkasan-q2",
                prompt: "Tiga sel berisi 80, 90, dan 100. Apa hasil AVERAGE untuk ketiga nilai itu?",
                options: ["80", "90", "100", "270"],
                answer: 1,
                explanation: "Rata-ratanya adalah (80+90+100)/3 = 90. Nilai 270 adalah totalnya, bukan rata-ratanya.",
              },
            ],
            sources: [
              {
                id: "excel-kerja-fungsi-ringkasan-source-sum",
                title: "SUM function",
                url: "https://support.microsoft.com/en-us/office/sum-function-043e1c7d-7726-4e80-8f32-07b23e057f89",
              },
              {
                id: "excel-kerja-fungsi-ringkasan-source-average",
                title: "AVERAGE function",
                url: "https://support.microsoft.com/en-us/office/average-function-047bac88-d466-426c-a32b-8f33eb960cf6",
              },
            ],
          },
        ],
      },
      {
        id: "excel-kerja-analisis",
        title: "Rumus Logika dan Analisis Tabel",
        description: "Buat rumus yang konsisten, lalu temukan informasi penting dalam daftar kerja.",
        lessons: [
          {
            id: "excel-kerja-referensi-logika",
            title: "Referensi Absolut dan Fungsi IF",
            summary: "Kunci sel parameter saat menyalin rumus dan berikan label berdasarkan syarat.",
            minutes: 7,
            objectives: [
              "Membedakan perubahan referensi relatif dan absolut saat rumus disalin.",
              "Menulis IF dengan satu kondisi dan dua kemungkinan hasil.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Referensi seperti H1 bersifat relatif dan dapat bergeser ketika rumus disalin. Tanda dolar mengunci bagian referensi: $H$1 mengunci kolom H dan baris 1. Ini berguna untuk satu sel parameter, misalnya tarif pajak atau persentase diskon, yang dipakai banyak baris.",
              },
              {
                type: "example",
                title: "Diskon dengan satu parameter",
                text: "Jika H1 berisi 0,1 untuk diskon 10 persen dan D2 berisi harga awal, gunakan =D2*(1-$H$1). Saat disalin ke bawah, D2 menyesuaikan menjadi D3 dan seterusnya, sedangkan $H$1 tetap menunjuk ke sel diskon.",
              },
              {
                type: "paragraph",
                text: "IF menghasilkan satu dari dua nilai berdasarkan kondisi: =IF(kondisi; hasil_jika_benar; hasil_jika_salah). Excel juga dapat menggunakan koma sebagai pemisah argumen, bergantung pada pengaturan regional. Teks hasil ditulis di antara tanda kutip.",
              },
              {
                type: "example",
                title: "Memberi label transaksi",
                text: "Rumus =IF(E2>=1000000,\"Prioritas\",\"Normal\") memberi label Prioritas jika E2 bernilai minimal 1000000, dan Normal jika di bawahnya. Salin rumus untuk menerapkan syarat yang sama pada setiap baris.",
              },
            ],
            questions: [
              {
                id: "excel-kerja-referensi-logika-q1",
                prompt: "Persentase diskon selalu berada di H1. Referensi mana yang menjaga rumus tetap menunjuk ke H1 saat disalin ke baris lain?",
                options: ["H1", "$H$1", "H$1:H10", "IF(H1)"],
                answer: 1,
                explanation: "$H$1 adalah referensi absolut untuk kolom H dan baris 1, sehingga tidak bergeser ketika rumus disalin.",
              },
              {
                id: "excel-kerja-referensi-logika-q2",
                prompt: "E2 berisi 750000. Apa hasil =IF(E2>=1000000,\"Prioritas\",\"Normal\")?",
                options: ["Prioritas", "Normal", "750000", "Kesalahan rumus"],
                answer: 1,
                explanation: "Kondisi 750000>=1000000 bernilai salah, sehingga IF mengembalikan hasil kedua, yaitu Normal.",
              },
            ],
            sources: [
              {
                id: "excel-kerja-referensi-logika-source-references",
                title: "Switch between relative, absolute, and mixed references",
                url: "https://support.microsoft.com/en-us/office/switch-between-relative-absolute-and-mixed-references-dfec08cd-ae65-4f56-839e-5f0d8d0baca9",
              },
              {
                id: "excel-kerja-referensi-logika-source-if",
                title: "IF function",
                url: "https://support.microsoft.com/en-us/office/if-function-69aed7c9-4e8a-4755-a9bc-aa8bbff73be2",
              },
            ],
          },
          {
            id: "excel-kerja-tabel-sortir-filter",
            title: "Menata Tabel, Mengurutkan, dan Memfilter",
            summary: "Ubah daftar menjadi tabel yang rapi dan cari data tanpa menghapus baris lain.",
            minutes: 7,
            objectives: [
              "Menyiapkan data dengan satu baris judul kolom yang jelas.",
              "Mengurutkan dan memfilter tabel tanpa memisahkan data antarkolom.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Susun data sebagai satu daftar berkelanjutan: setiap kolom punya satu judul, setiap baris mewakili satu catatan, dan tidak ada baris kosong di tengah data. Pilih sel di dalam daftar lalu gunakan Insert > Table atau Ctrl+T. Centang pilihan bahwa tabel memiliki header jika judul kolom sudah tersedia.",
              },
              {
                type: "bullets",
                title: "Dua alat untuk membaca data",
                items: [
                  "Sort mengubah urutan baris berdasarkan nilai kolom, misalnya total dari terbesar ke terkecil.",
                  "Filter menampilkan hanya baris yang cocok, misalnya Status = Belum lunas.",
                  "Gunakan perintah pada tabel atau rentang lengkap agar seluruh kolom dalam satu baris tetap bersama.",
                ],
              },
              {
                type: "example",
                title: "Memprioritaskan tagihan",
                text: "Filter kolom Status untuk memilih Belum lunas, lalu urutkan kolom Jatuh tempo dari yang terlama ke yang terbaru. Daftar kini menampilkan tagihan yang perlu ditindaklanjuti lebih dahulu.",
              },
              {
                type: "callout",
                title: "Filter tidak menghapus data",
                text: "Baris yang tidak cocok hanya disembunyikan sementara. Hapus atau ubah filter untuk menampilkannya kembali. Berhati-hatilah saat menyalin atau menghapus data yang sedang difilter karena tidak semua baris terlihat.",
              },
            ],
            questions: [
              {
                id: "excel-kerja-tabel-sortir-filter-q1",
                prompt: "Setelah filter Status = Belum lunas diterapkan, apa yang terjadi pada baris berstatus Lunas?",
                options: [
                  "Dihapus permanen dari workbook",
                  "Dipindahkan ke sheet baru",
                  "Disembunyikan sementara dari tampilan",
                  "Diubah nilainya menjadi nol",
                ],
                answer: 2,
                explanation: "Filter menyembunyikan baris yang tidak cocok. Data tetap ada dan dapat ditampilkan kembali dengan mengubah atau menghapus filter.",
              },
              {
                id: "excel-kerja-tabel-sortir-filter-q2",
                prompt: "Anda ingin melihat transaksi dengan Total terbesar lebih dahulu tanpa memisahkan nama pelanggan dari totalnya. Apa tindakan yang tepat?",
                options: [
                  "Urutkan hanya sel Total yang dipilih satu per satu",
                  "Urutkan kolom Total dari terbesar ke terkecil pada tabel lengkap",
                  "Filter kolom Nama, lalu hapus baris terlihat",
                  "Gunakan AVERAGE pada kolom Total",
                ],
                answer: 1,
                explanation: "Sort pada tabel lengkap memindahkan seluruh baris sebagai satu catatan, sehingga hubungan nama, total, dan kolom lain tetap terjaga.",
              },
            ],
            sources: [
              {
                id: "excel-kerja-tabel-sortir-filter-source-sort",
                title: "Sort data in a range or table",
                url: "https://support.microsoft.com/en-us/office/sort-data-in-a-range-or-table-62d0b95d-2a90-4610-a6eb-2bbd545c0a05",
              },
              {
                id: "excel-kerja-tabel-sortir-filter-source-filter",
                title: "Filter data in a range or table",
                url: "https://support.microsoft.com/en-us/office/filter-data-in-a-range-or-table-01832226-31b5-4568-8806-38c37dcc180e",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "inggris-harian",
    slug: "inggris-harian",
    title: "Bahasa Inggris Percakapan Sehari-hari",
    category: "Bahasa",
    level: "Pemula",
    description:
      "Latih ungkapan bahasa Inggris untuk memperkenalkan diri, membicarakan rutinitas, memesan sesuatu, dan menanyakan arah.",
    outcome:
      "Mampu merespons percakapan sederhana, membuat permintaan yang sopan, dan meminta klarifikasi ketika belum memahami lawan bicara.",
    audience:
      "Pemula yang ingin membangun keberanian berbicara untuk situasi umum di rumah, tempat kerja, atau saat bepergian.",
    prerequisites: [
      "Mengenal alfabet bahasa Inggris dan beberapa kata dasar.",
      "Bersedia membaca contoh dialog dengan suara keras untuk melatih kelancaran.",
    ],
    estimatedMinutes: 24,
    version: 1,
    sourceKind: "curated",
    sources: [
      {
        id: "inggris-harian-source-british-council-speaking",
        title: "A1 speaking",
        url: "https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking",
        note: "Latihan berbicara tingkat pemula dari British Council.",
      },
      {
        id: "inggris-harian-source-british-council-vocabulary",
        title: "A1-A2 vocabulary",
        url: "https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary",
      },
    ],
    modules: [
      {
        id: "inggris-harian-membuka-percakapan",
        title: "Membuka Percakapan",
        description: "Gunakan sapaan, perkenalan, dan pola kalimat untuk membicarakan kegiatan sehari-hari.",
        lessons: [
          {
            id: "inggris-harian-sapa-perkenalan",
            title: "Menyapa dan Memperkenalkan Diri",
            summary: "Mulai percakapan dengan sapaan yang wajar dan berikan informasi dasar tentang diri.",
            minutes: 6,
            objectives: [
              "Memilih sapaan dan respons perkenalan yang sesuai.",
              "Menyebutkan nama serta asal dengan pola kalimat sederhana.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Gunakan Hello atau Hi untuk sapaan umum. Good morning dipakai pada pagi hari, sedangkan Good afternoon untuk sore hari. Setelah sapaan, How are you? adalah pertanyaan umum yang dapat dijawab I'm fine, thanks. And you?",
              },
              {
                type: "example",
                title: "Perkenalan singkat",
                text: "A: Hi, I'm Sari. Nice to meet you.\nB: Nice to meet you, too. I'm Daniel.\nA: I'm from Bandung. How about you?\nB: I'm from Singapore.",
              },
              {
                type: "bullets",
                title: "Pola yang dapat langsung dipakai",
                items: [
                  "I'm ... atau My name is ... untuk menyebutkan nama.",
                  "I'm from ... untuk menyebutkan asal kota atau negara.",
                  "Nice to meet you untuk menyatakan senang berkenalan.",
                ],
              },
              {
                type: "callout",
                title: "Respons yang alami",
                text: "Saat seseorang berkata Nice to meet you, jawaban yang umum adalah Nice to meet you, too. Kata too menandakan bahwa Anda juga senang berkenalan.",
              },
            ],
            questions: [
              {
                id: "inggris-harian-sapa-perkenalan-q1",
                prompt: "Seseorang berkata, \"Nice to meet you.\" Respons apa yang paling sesuai?",
                options: [
                  "Nice to meet you, too.",
                  "I'm from Jakarta.",
                  "I start at nine.",
                  "How much is it?",
                ],
                answer: 0,
                explanation: "Nice to meet you, too adalah respons yang wajar untuk menyatakan bahwa Anda juga senang berkenalan.",
              },
              {
                id: "inggris-harian-sapa-perkenalan-q2",
                prompt: "Kalimat mana yang tepat untuk mengatakan bahwa Anda berasal dari Surabaya?",
                options: ["I'm Surabaya.", "I live Surabaya from.", "I'm from Surabaya.", "My name Surabaya."],
                answer: 2,
                explanation: "Pola I'm from + tempat digunakan untuk menyebutkan asal. I'm Surabaya menyamakan diri dengan nama kota.",
              },
            ],
            sources: [
              {
                id: "inggris-harian-sapa-perkenalan-source",
                title: "Introducing yourself",
                url: "https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/introducing-yourself",
              },
            ],
          },
          {
            id: "inggris-harian-rutinitas-waktu",
            title: "Membicarakan Rutinitas dan Waktu",
            summary: "Ceritakan kebiasaan dengan present simple dan tanyakan waktu kegiatan.",
            minutes: 6,
            objectives: [
              "Membentuk kalimat present simple tentang rutinitas.",
              "Menanyakan waktu kegiatan dengan do atau does yang tepat.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Present simple digunakan untuk kebiasaan dan fakta umum. Gunakan bentuk dasar untuk I, you, we, dan they: I start work at nine. Untuk he, she, atau it, kata kerja umumnya mendapat akhiran -s: She starts work at nine.",
              },
              {
                type: "bullets",
                title: "Kata keterangan kebiasaan",
                items: [
                  "Always berarti selalu dan never berarti tidak pernah.",
                  "Usually berarti biasanya dan sometimes berarti kadang-kadang.",
                  "Posisi umumnya sebelum kata kerja utama: I usually have lunch at noon.",
                ],
              },
              {
                type: "example",
                title: "Rutinitas kerja",
                text: "I usually start work at 8.30. I have lunch at noon. On Fridays, I finish at 4.30. Untuk menanyakan kebiasaan orang lain: What time do you start work?",
              },
              {
                type: "callout",
                title: "Do dan does dalam pertanyaan",
                text: "Gunakan do bersama I, you, we, atau they, dan does bersama he, she, atau it. Setelah does, kata kerja kembali ke bentuk dasar: Does she start at nine?, bukan Does she starts at nine?",
              },
            ],
            questions: [
              {
                id: "inggris-harian-rutinitas-waktu-q1",
                prompt: "Kalimat mana yang benar untuk membicarakan rutinitas Maya?",
                options: [
                  "She go to work at eight.",
                  "She goes to work at eight.",
                  "She going to work at eight every day.",
                  "She do goes to work at eight.",
                ],
                answer: 1,
                explanation: "Dalam present simple untuk she, kata kerja go menjadi goes. Goes to work at eight menyatakan rutinitas.",
              },
              {
                id: "inggris-harian-rutinitas-waktu-q2",
                prompt: "Pertanyaan mana yang benar untuk menanyakan jam mulai kerja Raka?",
                options: [
                  "What time do he start work?",
                  "What time does he starts work?",
                  "What time does he start work?",
                  "What time he does starting work?",
                ],
                answer: 2,
                explanation: "He membutuhkan does, dan kata kerja setelah does memakai bentuk dasar start.",
              },
            ],
            sources: [
              {
                id: "inggris-harian-rutinitas-waktu-source-grammar",
                title: "Present simple",
                url: "https://learnenglish.britishcouncil.org/grammar/english-grammar-reference/present-simple",
              },
              {
                id: "inggris-harian-rutinitas-waktu-source-vocabulary",
                title: "Daily routines",
                url: "https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary/daily-routines",
              },
            ],
          },
        ],
      },
      {
        id: "inggris-harian-situasi-praktis",
        title: "Situasi Praktis",
        description: "Pesan makanan, tanyakan harga, cari tempat, dan jaga percakapan tetap berjalan.",
        lessons: [
          {
            id: "inggris-harian-pesan-harga",
            title: "Memesan dan Menanyakan Harga",
            summary: "Gunakan permintaan sopan di kafe atau toko dan tanyakan informasi yang dibutuhkan.",
            minutes: 6,
            objectives: [
              "Memesan makanan atau minuman dengan ungkapan yang sopan.",
              "Menanyakan harga dan meminta tagihan dengan jelas.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Could I have ..., please? adalah cara sopan untuk meminta sesuatu. I'd like ... juga berarti saya ingin ... dan umum digunakan saat memesan. Tambahkan please untuk membuat permintaan lebih santun, lalu ucapkan Thank you setelah menerima layanan.",
              },
              {
                type: "example",
                title: "Di kafe",
                text: "Customer: Could I have a cup of tea, please?\nServer: Sure. Anything else?\nCustomer: No, thanks. Could I get the bill, please?\nServer: Of course.",
              },
              {
                type: "bullets",
                title: "Ungkapan di toko dan restoran",
                items: [
                  "Can I see the menu, please? untuk meminta menu.",
                  "How much is this? untuk menanyakan harga satu barang.",
                  "How much are these? untuk menanyakan harga beberapa barang.",
                  "Could I get the bill, please? untuk meminta tagihan.",
                ],
              },
              {
                type: "callout",
                title: "Pilih bentuk permintaan",
                text: "Give me a menu terdengar seperti perintah langsung. Dalam situasi layanan, Could I see the menu, please? atau Can I see the menu, please? lebih tepat untuk memulai permintaan dengan sopan.",
              },
            ],
            questions: [
              {
                id: "inggris-harian-pesan-harga-q1",
                prompt: "Anda ingin memesan segelas kopi dengan sopan. Ungkapan mana yang paling tepat?",
                options: [
                  "Could I have a cup of coffee, please?",
                  "You coffee now.",
                  "How much coffee cup you?",
                  "I am a cup of coffee.",
                ],
                answer: 0,
                explanation: "Could I have ..., please? adalah pola permintaan yang sopan. Sebutkan pesanan setelah have.",
              },
              {
                id: "inggris-harian-pesan-harga-q2",
                prompt: "Anda menunjuk satu jaket dan ingin mengetahui harganya. Apa yang sebaiknya Anda tanyakan?",
                options: ["Where is the bill?", "How much is this?", "What time is it?", "Could I have a menu?"],
                answer: 1,
                explanation: "How much is this? digunakan untuk menanyakan harga satu barang yang ditunjuk.",
              },
            ],
            sources: [
              {
                id: "inggris-harian-pesan-harga-source-speaking",
                title: "Ordering food in cafes and restaurants",
                url: "https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/ordering-food-cafes-and-restaurants",
              },
              {
                id: "inggris-harian-pesan-harga-source-vocabulary",
                title: "Shopping",
                url: "https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary/shopping",
              },
            ],
          },
          {
            id: "inggris-harian-arah-klarifikasi",
            title: "Menanyakan Arah dan Meminta Klarifikasi",
            summary: "Cari suatu tempat, pahami petunjuk dasar, dan minta pengulangan tanpa ragu.",
            minutes: 6,
            objectives: [
              "Menanyakan lokasi dan memahami petunjuk arah sederhana.",
              "Meminta lawan bicara mengulang atau berbicara lebih pelan.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Awali pertanyaan kepada orang yang tidak dikenal dengan Excuse me. Gunakan How do I get to the station? untuk menanyakan cara menuju stasiun, atau Where is the nearest pharmacy? untuk menanyakan lokasi apotek terdekat.",
              },
              {
                type: "bullets",
                title: "Petunjuk yang sering terdengar",
                items: [
                  "Go straight ahead berarti terus berjalan lurus.",
                  "Turn left atau turn right berarti belok kiri atau kanan.",
                  "It's next to the bank berarti tempat itu berada di sebelah bank.",
                  "It's opposite the station berarti tempat itu berada di seberang stasiun.",
                ],
              },
              {
                type: "example",
                title: "Mencari apotek",
                text: "A: Excuse me, how do I get to the pharmacy?\nB: Go straight ahead, then turn left at the corner. It's next to the bank.\nA: Sorry, could you repeat that, please?",
              },
              {
                type: "callout",
                title: "Tidak paham bukan akhir percakapan",
                text: "Gunakan Sorry, could you repeat that, please? untuk meminta pengulangan. Gunakan Could you speak more slowly, please? jika lawan bicara berbicara terlalu cepat. Kedua ungkapan ini membantu Anda memperbaiki pemahaman dengan sopan.",
              },
            ],
            questions: [
              {
                id: "inggris-harian-arah-klarifikasi-q1",
                prompt: "Petunjuk berkata, \"Go straight ahead, then turn left. The pharmacy is next to the bank.\" Di mana apoteknya?",
                options: ["Di dalam stasiun", "Di sebelah bank", "Di seberang bank", "Di belokan sebelum bank"],
                answer: 1,
                explanation: "Next to the bank berarti di sebelah bank. Petunjuk sebelumnya menjelaskan cara mencapai tempat tersebut.",
              },
              {
                id: "inggris-harian-arah-klarifikasi-q2",
                prompt: "Anda belum memahami penjelasan lawan bicara dan ingin mendengarnya sekali lagi. Apa ungkapan yang tepat?",
                options: [
                  "Could you repeat that, please?",
                  "How much is this?",
                  "I'm from Indonesia.",
                  "Could I get the bill, please?",
                ],
                answer: 0,
                explanation: "Could you repeat that, please? secara sopan meminta lawan bicara mengulangi ucapannya.",
              },
            ],
            sources: [
              {
                id: "inggris-harian-arah-klarifikasi-source-directions",
                title: "Asking for and giving directions",
                url: "https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking/asking-directions",
              },
              {
                id: "inggris-harian-arah-klarifikasi-source-cambridge",
                title: "Cambridge Dictionary: repeat",
                url: "https://dictionary.cambridge.org/dictionary/english/repeat",
                note: "Lihat makna dan contoh penggunaan repeat dalam konteks meminta pengulangan.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "web-dasar",
    slug: "web-dasar",
    title: "Dasar Pemrograman Web",
    category: "Teknologi",
    level: "Pemula",
    description:
      "Bangun halaman web sederhana dengan HTML dan CSS, atur layout responsif, lalu tambahkan interaksi menggunakan JavaScript.",
    outcome:
      "Mampu menyusun struktur konten, menerapkan gaya dan layout dasar, serta menghubungkan tombol dengan perubahan pada halaman.",
    audience:
      "Pemula yang ingin memahami fondasi pembuatan halaman web sebelum mempelajari framework atau pengembangan backend.",
    prerequisites: [
      "Dapat membuat dan membuka file teks menggunakan editor kode.",
      "Dapat membuka file HTML di browser dan menggunakan fitur refresh.",
    ],
    estimatedMinutes: 28,
    version: 1,
    sourceKind: "curated",
    sources: [
      {
        id: "web-dasar-source-mdn-learn",
        title: "Learn web development",
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development",
        note: "Jalur belajar web dari MDN untuk HTML, CSS, dan JavaScript.",
      },
      {
        id: "web-dasar-source-mdn-html",
        title: "HTML: HyperText Markup Language",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
      },
    ],
    modules: [
      {
        id: "web-dasar-struktur-gaya",
        title: "Struktur dan Gaya Halaman",
        description: "Berikan makna pada konten dengan HTML, lalu atur tampilannya menggunakan CSS.",
        lessons: [
          {
            id: "web-dasar-html-struktur",
            title: "Menyusun Konten dengan HTML",
            summary: "Gunakan elemen HTML sesuai makna konten, bukan hanya berdasarkan tampilannya.",
            minutes: 7,
            objectives: [
              "Menyusun judul, paragraf, dan daftar dengan elemen yang sesuai.",
              "Membuat tautan dan menulis teks alternatif untuk gambar.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "HTML memberi struktur dan makna pada konten. Elemen umumnya terdiri dari tag pembuka, isi, dan tag penutup, misalnya <p>Ini paragraf.</p>. Gunakan <h1> untuk judul utama halaman dan <p> untuk paragraf, bukan memilih tag hanya karena ukuran hurufnya.",
              },
              {
                type: "example",
                title: "Bagian artikel sederhana",
                text: "<article>\n  <h1>Catatan Belajar</h1>\n  <p>Tiga bahan yang perlu disiapkan:</p>\n  <ul>\n    <li>Editor kode</li>\n    <li>Browser</li>\n  </ul>\n</article>",
              },
              {
                type: "bullets",
                title: "Daftar, tautan, dan gambar",
                items: [
                  "<ul> membuat daftar tanpa urutan dan setiap butir ditulis dengan <li>.",
                  "<ol> digunakan ketika urutan butir bermakna, seperti langkah-langkah.",
                  "<a href=\"https://developer.mozilla.org\">Baca MDN</a> membuat tautan ke tujuan yang jelas.",
                  "<img src=\"tim.jpg\" alt=\"Tim sedang berdiskusi\"> menyertakan gambar dan teks alternatif.",
                ],
              },
              {
                type: "callout",
                title: "Alt menjelaskan informasi gambar",
                text: "Teks alt dibaca oleh pembaca layar dan dapat tampil ketika gambar tidak termuat. Tuliskan informasi yang relevan, bukan nama file. Untuk gambar yang murni dekoratif, gunakan alt=\"\" agar tidak menambah informasi yang tidak perlu.",
              },
            ],
            questions: [
              {
                id: "web-dasar-html-struktur-q1",
                prompt: "Anda ingin menampilkan tiga fitur tanpa urutan tertentu. Struktur mana yang paling sesuai?",
                options: [
                  "<p>Fitur satu, fitur dua, fitur tiga</p>",
                  "<ul><li>Fitur satu</li><li>Fitur dua</li><li>Fitur tiga</li></ul>",
                  "<h1>Fitur satu</h1><h1>Fitur dua</h1>",
                  "<img alt=\"Fitur satu, fitur dua, fitur tiga\">",
                ],
                answer: 1,
                explanation: "ul menyatakan daftar tanpa urutan, sedangkan li menandai setiap butir. Struktur ini menyampaikan makna konten dengan tepat.",
              },
              {
                id: "web-dasar-html-struktur-q2",
                prompt: "Gambar menunjukkan petugas memindai kode batang produk. Teks alt mana yang paling berguna?",
                options: [
                  "gambar",
                  "IMG_2048.jpg",
                  "Petugas memindai kode batang produk",
                  "Klik di sini untuk gambar petugas",
                ],
                answer: 2,
                explanation: "Alt tersebut menjelaskan informasi utama gambar secara ringkas. Nama file atau kata gambar tidak membantu memahami isinya.",
              },
            ],
            sources: [
              {
                id: "web-dasar-html-struktur-source",
                title: "Basic HTML syntax",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax",
              },
            ],
          },
          {
            id: "web-dasar-css-dasar",
            title: "Mengatur Tampilan dengan CSS",
            summary: "Tulis aturan CSS dan pahami bagian-bagian box model sebelum mengatur ukuran.",
            minutes: 7,
            objectives: [
              "Menulis rule CSS dengan selector, properti, dan nilai.",
              "Menghitung ruang yang dipakai elemen berdasarkan box model.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "Rule CSS terdiri dari selector dan blok deklarasi. Selector memilih elemen, sedangkan setiap deklarasi berisi properti dan nilai yang dipisahkan titik dua. Titik koma mengakhiri deklarasi. Selector .card memilih elemen dengan class=\"card\".",
              },
              {
                type: "example",
                title: "Gaya untuk kartu informasi",
                text: ".card {\n  padding: 16px;\n  margin-bottom: 24px;\n  border: 1px solid #777;\n  color: #222;\n}",
              },
              {
                type: "bullets",
                title: "Lapisan box model dari dalam ke luar",
                items: [
                  "Content berisi teks atau elemen lain dan dipengaruhi width serta height.",
                  "Padding adalah ruang di dalam elemen, antara content dan border.",
                  "Border adalah garis tepi elemen.",
                  "Margin adalah ruang di luar border yang memisahkan elemen dari elemen lain.",
                ],
              },
              {
                type: "callout",
                title: "Width tidak selalu lebar akhir",
                text: "Dengan box-sizing: content-box, width menetapkan lebar area content saja. Padding dan border menambah lebar yang terlihat, sedangkan margin menambah ruang di luar elemen. Nilai box-sizing: border-box menghitung padding dan border di dalam width yang ditetapkan.",
              },
            ],
            questions: [
              {
                id: "web-dasar-css-dasar-q1",
                prompt: "Selector mana yang memilih semua elemen dengan class=\"notice\"?",
                options: ["#notice", "notice()", ".notice", "*notice"],
                answer: 2,
                explanation: "Awalan titik pada .notice adalah selector class. Tanda # digunakan untuk selector id.",
              },
              {
                id: "web-dasar-css-dasar-q2",
                prompt: "Dengan box-sizing: content-box, sebuah elemen memiliki width: 200px, padding kiri-kanan 16px, dan border kiri-kanan 2px. Berapa lebar dari border kiri ke border kanan?",
                options: ["200px", "216px", "232px", "236px"],
                answer: 3,
                explanation: "Lebarnya 200 + (2 x 16) + (2 x 2) = 236px. Margin tidak termasuk karena berada di luar border.",
              },
            ],
            sources: [
              {
                id: "web-dasar-css-dasar-source-basics",
                title: "CSS styling basics",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics",
              },
              {
                id: "web-dasar-css-dasar-source-box-model",
                title: "The box model",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model",
              },
            ],
          },
        ],
      },
      {
        id: "web-dasar-layout-interaksi",
        title: "Layout Responsif dan Interaksi",
        description: "Susun elemen dengan Flexbox dan ubah konten melalui JavaScript.",
        lessons: [
          {
            id: "web-dasar-layout-responsif",
            title: "Menyusun Layout Responsif",
            summary: "Atur deretan elemen dengan Flexbox dan sesuaikan layout pada layar sempit.",
            minutes: 7,
            objectives: [
              "Menggunakan properti Flexbox untuk mengatur arah, jarak, dan perataan.",
              "Menerapkan media query sederhana untuk viewport sempit.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "display: flex menjadikan sebuah elemen sebagai flex container dan anak-anak langsungnya sebagai flex items. Secara default, sumbu utama berjalan horizontal sebagai baris. flex-direction: column mengubah arah sumbu utama menjadi vertikal.",
              },
              {
                type: "bullets",
                title: "Properti Flexbox yang penting",
                items: [
                  "gap mengatur jarak antaritem tanpa margin pada setiap item.",
                  "justify-content mengatur distribusi item di sepanjang sumbu utama.",
                  "align-items mengatur perataan item pada sumbu silang.",
                  "flex-wrap: wrap memungkinkan item pindah ke baris berikutnya ketika ruang tidak cukup.",
                ],
              },
              {
                type: "example",
                title: "Menu yang berubah menjadi kolom",
                text: ".menu {\n  display: flex;\n  gap: 16px;\n}\n\n@media (max-width: 600px) {\n  .menu {\n    flex-direction: column;\n  }\n}",
              },
              {
                type: "paragraph",
                text: "Media query di atas menerapkan flex-direction: column ketika lebar viewport maksimal 600px. Untuk halaman mobile, sertakan <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> di dalam <head>. Gunakan gambar dengan max-width: 100% agar tidak melebihi lebar containernya.",
              },
              {
                type: "callout",
                title: "Uji perilaku, bukan hanya satu ukuran",
                text: "Periksa layout saat viewport dipersempit dan diperlebar. Pastikan teks tetap terbaca, konten tidak terpotong, dan urutan elemen masih masuk akal setelah arah flex berubah.",
              },
            ],
            questions: [
              {
                id: "web-dasar-layout-responsif-q1",
                prompt: "Flex container menggunakan flex-direction: row. Properti apa yang mengatur distribusi item pada sumbu horizontal?",
                options: ["align-items", "justify-content", "font-weight", "max-width"],
                answer: 1,
                explanation: "Dengan arah row, sumbu utama berjalan horizontal. justify-content mengatur distribusi item pada sumbu utama tersebut.",
              },
              {
                id: "web-dasar-layout-responsif-q2",
                prompt: "Kapan aturan di dalam @media (max-width: 600px) diterapkan?",
                options: [
                  "Hanya ketika lebar viewport tepat 600px",
                  "Ketika lebar viewport 600px atau kurang",
                  "Ketika lebar viewport lebih dari 600px",
                  "Hanya pada layar perangkat berlogo mobile",
                ],
                answer: 1,
                explanation: "max-width: 600px cocok untuk viewport dengan lebar sampai 600px, termasuk tepat 600px.",
              },
            ],
            sources: [
              {
                id: "web-dasar-layout-responsif-source-flexbox",
                title: "Flexbox",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox",
              },
              {
                id: "web-dasar-layout-responsif-source-media",
                title: "CSS media queries",
                url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries",
              },
            ],
          },
          {
            id: "web-dasar-javascript-interaksi",
            title: "Menambahkan Interaksi dengan JavaScript",
            summary: "Pilih elemen, dengarkan klik, dan perbarui teks halaman dengan aman.",
            minutes: 7,
            objectives: [
              "Memilih elemen HTML menggunakan document.querySelector.",
              "Menjalankan fungsi saat tombol diklik dan memperbarui teks dengan textContent.",
            ],
            blocks: [
              {
                type: "paragraph",
                text: "JavaScript dapat membaca dan mengubah Document Object Model (DOM), yaitu representasi dokumen yang digunakan browser. document.querySelector(\"#status\") memilih elemen pertama yang cocok dengan selector CSS #status. Simpan hasilnya dalam variabel agar dapat digunakan kembali.",
              },
              {
                type: "example",
                title: "Tombol pengubah status",
                text: "HTML:\n<button id=\"save-button\">Simpan</button>\n<p id=\"status\">Belum disimpan</p>\n\nJavaScript:\nconst button = document.querySelector(\"#save-button\");\nconst status = document.querySelector(\"#status\");\n\nbutton.addEventListener(\"click\", () => {\n  status.textContent = \"Tersimpan\";\n});",
              },
              {
                type: "bullets",
                title: "Alur interaksinya",
                items: [
                  "querySelector mencari tombol dan paragraf berdasarkan id.",
                  "addEventListener mendaftarkan fungsi yang dijalankan ketika event click terjadi.",
                  "textContent mengganti isi teks paragraf menjadi Tersimpan setelah pengguna mengklik.",
                ],
              },
              {
                type: "callout",
                title: "Pastikan elemen sudah tersedia",
                text: "Jika script dimuat di <head>, atribut defer menunda eksekusi sampai dokumen HTML selesai diparsing: <script src=\"app.js\" defer></script>. Gunakan textContent untuk memasukkan teks biasa; jangan memakai innerHTML untuk data yang tidak dipercaya karena dapat ditafsirkan sebagai markup.",
              },
            ],
            questions: [
              {
                id: "web-dasar-javascript-interaksi-q1",
                prompt: "Anda ingin menjalankan fungsi showMessage setiap kali tombol pada variabel button diklik. Kode mana yang tepat?",
                options: [
                  "button.addEventListener(\"click\", showMessage);",
                  "button.querySelector(\"click\", showMessage);",
                  "document.textContent(button, showMessage);",
                  "click.button = addEventListener;",
                ],
                answer: 0,
                explanation: "addEventListener menerima jenis event dan fungsi yang akan dipanggil. Di sini event-nya click dan fungsinya showMessage.",
              },
              {
                id: "web-dasar-javascript-interaksi-q2",
                prompt: "Variabel status menunjuk ke <p id=\"status\">Belum siap</p>. Apa hasil status.textContent = \"Siap\";?",
                options: [
                  "ID paragraf berubah menjadi Siap",
                  "Teks paragraf berubah menjadi Siap",
                  "Paragraf berubah menjadi tombol",
                  "Browser membuka halaman baru bernama Siap",
                ],
                answer: 1,
                explanation: "textContent membaca atau mengganti konten teks elemen. Atribut id dan jenis elemen tidak berubah.",
              },
            ],
            sources: [
              {
                id: "web-dasar-javascript-interaksi-source-dom",
                title: "DOM scripting",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/DOM_scripting",
              },
              {
                id: "web-dasar-javascript-interaksi-source-events",
                title: "Introduction to events",
                url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events",
              },
            ],
          },
        ],
      },
    ],
  },
];
