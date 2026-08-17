/**
 * i18n — fondasi multi-bahasa (Indonesia / English).
 *
 * Strategi:
 * - URL ber-prefix locale: /pricing → /id/pricing atau /en/pricing
 *   (ditangani middleware.ts via redirect + rewrite, tanpa memindahkan
 *   folder halaman — link internal lama tetap aman).
 * - Dictionary dengan fallback: `getDictionary("en")` mengembalikan
 *   terjemahan en; key yang belum diterjemahkan jatuh ke id (halaman
 *   yang belum lengkap tetap tampil bahasa Indonesia, tidak pernah
 *   kosong/broken).
 * - Komponen client membaca locale via LocaleContext (context/LocaleContext).
 */

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "id" || v === "en";
}

/** Tambah prefix locale ke path (mis. "/pricing" + "en" → "/en/pricing"). */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Alternates (canonical + hreflang) untuk path di locale tertentu. */
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      id: localePath("id", path),
      en: localePath("en", path),
      "x-default": localePath("id", path),
    },
  };
}

/** Nama bahasa lengkap untuk meta og:locale. */
export function ogLocale(locale: Locale): string {
  return locale === "en" ? "en_US" : "id_ID";
}

/** Nama bahasa untuk dipakai di label pemilih bahasa. */
export const LOCALE_LABELS: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

/**
 * Dictionary bahasa Indonesia — sumber utama.
 * Semua string UI situs didefinisikan di sini; `en` menerjemahkannya.
 */
export const dictionaries = {
  id: {
    // ── Umum / nav ────────────────────────────────────────
    nav: {
      fitur: "Fitur",
      caraKerja: "Cara Kerja",
      harga: "Harga",
      faq: "FAQ",
      pricing: "Pricing",
      beta: "Beta",
      masuk: "Masuk",
      cobaGratis: "Coba Gratis",
      bukaDashboard: "Buka Dashboard",
      lanjutBelajar: "Lanjut Belajar",
      mulaiGratis: "Mulai Gratis",
      lihatHarga: "Lihat Harga",
      sayaSudahPunyaAkun: "Saya sudah punya akun",
    },
    // ── Landing hero ──────────────────────────────────────
    hero: {
      chip: "AI Tutor untuk Semua Pelajar Indonesia",
      title1: "Bukan sekadar jawaban, tapi momen",
      title2: "Eureka!",
      subtitle:
        "Eureka.AI adalah AI Tutor Socratic untuk pelajar: ubah video, artikel & PDF jadi catatan otomatis, tanya apa saja per bab, kerjakan kuis & kartu hafalan — dan temukan sendiri jawabannya.",
      gratis: "Gratis selamanya untuk fitur dasar — tanpa kartu kredit",
      noteTitle: "Turunan Fungsi — Konsep Dasar",
      noteMeta: "YouTube · 12 menit → catatan otomatis",
      noteBab: "Bab 1 · Limit",
      noteQuiz: "5 kuis siap",
      chatEureka:
        "Eureka: “Kalau kamu lari 5 km dalam 30 menit, berapa kecepatan rata-ratamu?”",
      chatSiswa: "Siswa: “10 km/jam… Ooooh, itu turunan!”",
      streak: "Streak 7 hari",
      level: "Level 3 · 245 XP",
    },
    // ── Landing model AI ──────────────────────────────────
    aiModels: {
      label: "Didukung oleh Model AI Terdepan",
      title: "AI apa yang mendukung Eureka.AI?",
      desc: "Sistem multi-model AI — otomatis memilih model terbaik untuk setiap tugas belajar",
    },
    // ── Landing fitur ─────────────────────────────────────
    fitur: {
      label: "Keunggulan Eureka.AI",
      title: "Belajar yang membuatmu paham, bukan sekadar hafal",
      desc: "Dari catatan otomatis sampai kuis interaktif — semua dirancang untuk pemahaman mendalam.",
      items: [
        {
          title: "AI Tutor Socratic",
          desc: "Eureka tidak memberi jawaban instan — ia membimbingmu dengan pertanyaan bertahap sampai kamu menemukan momen 'Eureka!' sendiri.",
        },
        {
          title: "Catatan Otomatis dari Materi",
          desc: "Tempel link YouTube, artikel, atau unggah PDF — AI mengubahnya menjadi catatan belajar terstruktur per bab, siap dipelajari.",
        },
        {
          title: "Tanya Apa Saja per Bab",
          desc: "Kesulitan satu topik? Tanyakan langsung pada AI di bab tersebut — jawaban fokus pada materi yang sedang kamu pelajari.",
        },
        {
          title: "Belajar Bersama Teman",
          desc: "Kolaborasi real-time di catatan yang sama: chat, stabilo bersama, hingga papan tulis untuk belajar kelompok online.",
        },
        {
          title: "Kuis & Kartu Hafalan",
          desc: "Setiap catatan otomatis dilengkapi kuis dan flashcards dari AI — berlatih tanpa perlu menyusun soal sendiri.",
        },
        {
          title: "Streak, XP & Papan Peringkat",
          desc: "Belajar rutin menjaga streak tetap menyala. Naik level, kumpulkan XP, dan pantau progresmu di papan peringkat.",
        },
      ],
    },
    // ── Landing cara kerja ────────────────────────────────
    caraKerja: {
      label: "Cara Kerja",
      title: "Bagaimana cara kerja Eureka.AI?",
      desc: "Eureka.AI bekerja dalam 3 langkah: unggah atau tempel materi, AI menyusunnya menjadi catatan per bab, lalu kamu belajar lewat tanya jawab, kuis, dan kartu hafalan.",
      langkah: "Langkah",
      steps: [
        {
          title: "Masukkan Materi",
          desc: "Tempel link YouTube atau halaman web, atau unggah PDF/DOCX — apa pun sumber belajarmu.",
        },
        {
          title: "AI Membuat Catatan",
          desc: "Materi diubah menjadi bab-bab rapi lengkap dengan ringkasan, poin penting, kuis, dan kartu hafalan.",
        },
        {
          title: "Belajar Hingga Eureka!",
          desc: "Tanya pada AI per bab, kerjakan kuis, ulangi kartu hafalan — sampai benar-benar paham.",
        },
      ],
    },
    // ── Landing fakta (GEO) ───────────────────────────────
    fakta: {
      label: "Fakta Eureka.AI",
      title: "Angka yang membuat Eureka.AI beda",
      desc: "Eureka.AI adalah aplikasi belajar AI gratis untuk pelajar Indonesia: 4 tipe rangkuman otomatis, hingga 6 bab per catatan, dan 3 sumber materi — video YouTube, artikel web, dan dokumen.",
      stat1: "tipe rangkuman: biasa, makalah, laporan, dan poin penting",
      stat2:
        "hari masa aktif Pro per pembayaran — Rp 59.000, tanpa langganan berulang",
      stat3: "sumber materi: video YouTube, artikel web, dan file dokumen (PDF, DOCX, PPTX)",
      updated: "Terakhir diperbarui: Agustus 2026",
    },
    // ── Landing harga ─────────────────────────────────────
    harga: {
      label: "Harga",
      title: "Berapa biaya Eureka.AI?",
      desc: "Paket Pro Rp 59.000/bulan — bayar sekali, aktif 30 hari.",
      gratis: "Gratis",
      perBulan: "/bulan",
      gratisFeatures: [
        "Chat AI Socratic (batas harian)",
        "3 catatan otomatis per bulan",
        "Kuis & kartu hafalan dasar",
        "Streak, XP & papan peringkat",
      ],
      terpopuler: "Terpopuler",
      pro: "Pro",
      proFeatures: [
        "Semua fitur paket Gratis",
        "Chat AI tanpa batas",
        "Catatan otomatis tanpa batas",
        "Kolaborasi real-time dengan teman",
        "Akses fitur baru lebih dulu",
      ],
      berlangganan: "Berlangganan Pro",
      pembayaran:
        "Pembayaran aman via Pakasir — QRIS, e-wallet, VA. Aktif otomatis setelah terverifikasi.",
    },
    // ── Landing FAQ ───────────────────────────────────────
    faq: {
      label: "FAQ",
      title: "Pertanyaan yang sering ditanyakan",
      items: [
        {
          q: "Apa itu Eureka.AI?",
          a: "Eureka.AI adalah AI Tutor Socratic untuk pelajar Indonesia. Ia mengubah materi (video, artikel, PDF) menjadi catatan otomatis, lalu membimbingmu memahami konsep lewat pertanyaan bertahap — bukan sekadar memberi jawaban.",
        },
        {
          q: "Apakah Eureka.AI gratis?",
          a: "Ya. Paket Gratis tersedia selamanya: chat AI dengan batas harian, 3 catatan otomatis per bulan, serta kuis dan kartu hafalan dasar. Upgrade ke Pro (Rp 59.000/bulan) untuk akses tanpa batas.",
        },
        {
          q: "Bagaimana cara membuat catatan otomatis?",
          a: "Tempel link YouTube atau halaman web, atau unggah file PDF/DOCX di dashboard. AI merangkumnya menjadi catatan terstruktur per bab, lengkap dengan ringkasan, kuis, dan flashcards.",
        },
        {
          q: "Metode Socratic itu apa?",
          a: "Metode Socratic adalah cara belajar dengan pertanyaan bertahap: alih-alih langsung memberi jawaban, Eureka membimbingmu menemukan sendiri jawabannya sehingga pemahaman lebih dalam dan bertahan lama.",
        },
        {
          q: "Bisa belajar bersama teman?",
          a: "Bisa. Eureka.AI mendukung kolaborasi real-time pada catatan yang sama — chat, stabilo bersama, dan papan tulis — cocok untuk belajar kelompok online.",
        },
        {
          q: "Aplikasi belajar AI gratis di Indonesia apa?",
          a: "Eureka.AI adalah aplikasi belajar AI gratis untuk pelajar Indonesia. Tanpa biaya, kamu bisa chat dengan AI tutor, membuat 3 catatan otomatis per bulan, dan mengerjakan kuis. Cukup daftar dengan email atau Google — tanpa kartu kredit.",
        },
        {
          q: "Bisakah Eureka.AI membuat rangkuman dari YouTube?",
          a: "Bisa. Tempel link video YouTube di dashboard, lalu AI mengekstrak subtitle dan menyusunnya menjadi catatan per bab dengan ringkasan, poin penting, kuis, dan kartu hafalan — siap dibaca ulang sebelum ujian.",
        },
        {
          q: "Bagaimana cara kerja AI tutor Eureka?",
          a: "Eureka memakai metode Socratic: ia mengajukan pertanyaan bertahap dan membimbingmu menemukan jawaban sendiri. Materi diubah jadi catatan terstruktur, lalu AI berperan sebagai tutor yang menyesuaikan tingkat kesulitan dengan pemahamanmu.",
        },
        {
          q: "Untuk jenjang apa Eureka.AI cocok?",
          a: "Eureka.AI cocok untuk pelajar SMP, SMA, hingga mahasiswa. Setiap akun bisa memilih jenjang dan mata pelajaran di profil, sehingga AI menyesuaikan bahasa, tingkat kesulitan, dan contoh materi dengan kebutuhan belajarmu.",
        },
      ],
    },
    // ── Landing CTA akhir ─────────────────────────────────
    ctaAkhir: {
      title: "Siap mengalami momen Eureka pertamamu?",
      desc: "Mulai gratis sekarang, tempel materi pertamamu, dan biarkan AI membimbingmu hingga benar-benar paham — bukan sekadar menghafal.",
    },
    footer: {
      tagline: "AI Tutor Socratic untuk pelajar Indonesia",
      copyright: "AI Tutor Socratic untuk pelajar Indonesia",
    },
    review: {
      label: "Ulasan Pengguna",
    },
    // ── Halaman /pricing ───────────────────────────────────
    pricing: {
      alreadyPro: "Kamu Sudah Pro!",
      upgrade: "Tingkatkan ke Pro",
      subtitle:
        "Harga Eureka.AI — AI Tutor Socratic untuk pelajar Indonesia. Mulai gratis selamanya, upgrade Pro untuk belajar tanpa batas.",
      activeUntil: "Langganan aktif —",
      until: "hingga",
      hello: "Halo",
      getUnlimited: "Dapatkan pengalaman belajar tanpa batas.",
      statusActive: "Status langgananmu aktif",
      trialActiveDesc: "Kamu sedang dalam masa trial gratis. Semua fitur Pro terbuka!",
      proActiveDesc:
        "Semua fitur Pro sudah terbuka. Terima kasih sudah berlangganan!",
      topUp: "Top Up Pro (Perpanjang 30 Hari)",
      toPakar: "Ke Pakasir…",
      refreshStatus: "Muat ulang status",
      backHome: "Kembali ke Home",
      cancelSubscription: "Batalkan Langganan",
      freeTrial7: "Coba Gratis 7 Hari",
      trialDesc: "Semua fitur Pro tanpa bayar. Sekali seumur hidup, tanpa kartu kredit.",
      claimTrial: "Klaim Trial Gratis",
      activating: "Mengaktifkan…",
      proMonthly: "Pro Bulanan",
      normalPrice: "Harga normal",
      perMonth: "/bulan",
      free100: "Gratis 100%",
      claimFree: "Klaim Gratis",
      choose: "Pilih",
      haveCode: "Punya kode diskon?",
      codePlaceholder: "MASUKKAN KODE (mis. GRATIS100)",
      use: "Pakai",
      codeHint:
        "Tekan Enter atau tombol Pakai untuk menerapkan kode sebelum memilih paket.",
      remainingQuota: "Sisa kuota {n} dari 10 orang.",
      everything: "Semua yang kamu dapat",
      payNote:
        "Pembayaran aman via Pakasir — QRIS, e-wallet, VA. Status premium aktif otomatis setelah pembayaran terverifikasi.",
      later: "Nanti aja",
      purchaseHistory: "Riwayat Pembelian",
      loadingHistory: "Memuat riwayat...",
      noPurchases: "Belum ada pembelian.",
      paid: "Lunas",
      unpaid: "Belum dibayar",
      cancelTitle: "Batalkan Langganan?",
      cancelDesc:
        "Akses premium akan berhenti sekarang. Karena harga Pro sudah sangat murah, tidak ada pengembalian dana (refund) untuk sisa masa aktif.",
      yesCancel: "Ya, Batalkan Langganan",
      cancelling: "Membatalkan…",
      notNow: "Tidak jadi",
      errInvalidCode: "Kode tidak valid.",
      errLoginFirst: "Silakan masuk dulu untuk berlangganan.",
      errPayment: "Gagal membuat pembayaran. Coba lagi.",
      errValidate: "Gagal memvalidasi kode. Coba lagi.",
      errTrial: "Gagal mengaktifkan trial. Coba lagi.",
      errCancel: "Gagal membatalkan langganan. Coba lagi.",
      errLoginTrial: "Silakan masuk dulu untuk mencoba trial.",
      errLoginCancel: "Silakan masuk dulu.",
      perks: [
        "Sesi belajar & chat AI tak terbatas",
        "Web search real-time saat bertanya",
        "Generate gambar AI (Eureka Draw)",
        "Kuis & flashcards AI tanpa batas",
        "Generate catatan AI unlimited",
        "Prioritas fitur baru",
      ],
    },
    // ── Halaman login & register ───────────────────────────
    auth: {
      welcome: "Selamat Datang Kembali!",
      welcomeSub: "Masuk dan lanjutkan momen Eureka-mu",
      loginGoogle: "Masuk dengan Google",
      or: "atau",
      tabPassword: "Kata Sandi",
      tabOtp: "Kode OTP",
      email: "EMAIL",
      emailPlaceholder: "kamu@email.com",
      password: "KATA SANDI",
      showPassword: "Tampilkan kata sandi",
      hidePassword: "Sembunyikan kata sandi",
      login: "Masuk",
      otpHint:
        "Masukkan email — kami kirim kode 6 digit yang berlaku beberapa menit. Tidak perlu kata sandi!",
      sendCode: "Kirim Kode",
      changeEmail: "Ganti email",
      otpSent: "Kode 6 digit terkirim ke",
      otpCheckInbox: "Periksa kotak masuk (atau spam) email kamu.",
      otpLabel: "KODE OTP",
      resend: "Kirim ulang kode",
      resending: "Mengirim ulang...",
      resendIn: "Kirim ulang dalam",
      noAccount: "Belum punya akun?",
      backHome: "← Kembali ke beranda",
      errFill: "Isi email dan kata sandi dulu ya.",
      errCaptcha: "Selesaikan verifikasi keamanan (captcha) dulu ya.",
      errLogin: "Gagal masuk. Coba lagi.",
      errEmail: "Masukkan email dulu ya.",
      errSend: "Gagal mengirim kode. Coba lagi.",
      errOtp6: "Masukkan kode 6 digit dari email.",
      errVerify: "Gagal verifikasi. Coba lagi.",
      errGoogle: "Gagal membuka login Google.",
      pageLoader: "Menyiapkan halaman masuk...",
      // register
      regTitle: "Daftar Gratis Sekarang",
      regSubForm:
        "Isi nama & email — akun dibuat otomatis setelah kode OTP kamu verifikasi",
      regSubOtp: "Cek emailmu untuk kode verifikasi",
      regGoogle: "Daftar dengan Google",
      fullName: "NAMA LENGKAP",
      namePlaceholder: "Nama kamu",
      regOtp: "Daftar dengan Kode OTP",
      changeNameEmail: "Ubah nama / email",
      regOtpSent:
        "Periksa kotak masuk (atau spam) email kamu. Akun dibuat otomatis saat kode benar.",
      createAccount: "Buat Akun & Masuk",
      haveAccount: "Sudah punya akun?",
      loginHere: "Masuk di sini",
      errNameEmail: "Isi nama (minimal 2 huruf) dan email dulu ya.",
      errGoogleReg: "Gagal membuka daftar dengan Google.",
      pageLoaderReg: "Menyiapkan halaman daftar...",
    },
    // ── Halaman /join (beta tester) ────────────────────────
    join: {
      chip: "Program Beta Tester",
      title: "Gabung Beta Eureka.AI",
      subtitle:
        "Bantu kami menguji fitur baru & dapatkan akses lebih awal. Sebagai beta tester, kamu bisa langsung mencoba fitur eksperimental:",
      featRecTitle: "Rekam Suara di Composer",
      featRecDesc: "Bicara, langsung jadi teks di kolom chat — tanpa ngetik.",
      featCallTitle: "Panggilan AI Realtime",
      featCallDesc:
        "Tutor suara Eureka.AI: tanya dengan suara, dijawab dengan suara + visualizer animasi.",
      featEarlyTitle: "Akses Awal Fitur Baru",
      featEarlyDesc:
        "Kamu termasuk yang pertama mencoba fitur eksperimental sebelum rilis publik.",
      alreadyTitle: "Kamu sudah beta tester!",
      alreadyDesc:
        "Fitur Rekam Suara & Panggilan AI sudah terbuka di halaman chat kamu.",
      tryNow: "Coba Sekarang",
      keDashboard: "Ke Dashboard",
      readyTitle: "Siap mencoba fitur baru?",
      readyDesc:
        "Klik tombol di bawah, dan akses beta langsung aktif di akunmu. Tanpa biaya, tanpa menunggu persetujuan.",
      joinNow: "Gabung Beta Sekarang",
      activating: "Mengaktifkan...",
      joinNote:
        "Butuh akun — bila belum masuk, kamu akan diarahkan ke halaman login dulu, lalu kembali otomatis.",
      errLogin: "Silakan masuk dulu untuk join beta.",
      errJoin: "Gagal join beta. Coba lagi.",
      question: "Ada pertanyaan? Tanyakan lewat",
      chatLink: "chat Eureka.AI",
    },
    // ── Halaman /launch ────────────────────────────────────
    launch: {
      chip: "Peluncuran Eureka.AI",
      title: "Klaim Hadiah Launch Eureka.AI",
      subtitle:
        "Buka link ini saat sudah masuk, dan hadiahmu aktif otomatis — tanpa kode, tanpa kartu kredit.",
      perks: [
        {
          title: "Trial Pro 7 Hari",
          desc: "Chat AI, catatan otomatis, kuis & flashcards tanpa batas — gratis 7 hari.",
        },
        {
          title: "Rekam Suara di Composer",
          desc: "Bicara, langsung jadi teks di kolom chat — tanpa ngetik.",
        },
        {
          title: "Panggilan AI Realtime",
          desc: "Tutor suara Eureka.AI: tanya dengan suara, dijawab dengan suara.",
        },
        {
          title: "Akses Awal Fitur Baru",
          desc: "Jadi beta tester — coba fitur eksperimental sebelum rilis publik.",
        },
      ],
      checking: "Memeriksa sesi kamu...",
      guestTitle: "Hadiah untuk pengguna Eureka.AI",
      guestDesc:
        "Masuk (atau daftar gratis) dulu, lalu kembali ke halaman ini — trial Pro 7 hari & akses beta langsung aktif otomatis.",
      masukKlaim: "Masuk & Klaim",
      daftarGratis: "Daftar Gratis",
      guestNote: "Sudah punya akun? Cukup masuk — tidak perlu mendaftar ulang.",
      workingTitle: "Mengaktifkan hadiahmu...",
      workingDesc: "Trial Pro + akses beta — sebentar lagi aktif.",
      trialActive: "Trial Pro 7 Hari Aktif!",
      trialUnavailable: "Trial tidak tersedia",
      trialUntil: "Aktif sampai",
      trialUntilDesc:
        "chat AI, catatan otomatis, kuis & flashcards tanpa batas.",
      stillFree: "Kamu tetap bisa memakai beta & fitur gratis.",
      betaActive: "Beta Tester Aktif!",
      betaUnavailable: "Beta tidak tersedia",
      betaActiveDesc:
        "Rekam suara di composer & panggilan AI realtime sudah terbuka di halaman chat kamu.",
      betaFail: "Gagal mengaktifkan beta. Coba lagi nanti.",
      mulalBelajar: "Mulai Belajar",
      keDashboard: "Ke Dashboard",
      footer:
        "Satu akun = satu trial Pro (7 hari). Sudah pernah klaim? Beta tetap bisa diaktifkan.",
      question: "Pertanyaan? Tanya lewat",
      chatLink: "chat Eureka.AI",
      claimFail: "Sebagian hadiah gagal diaktifkan. Silakan coba lagi nanti.",
      claimFailTrial: "Gagal klaim trial.",
    },
    // ── Halaman /introduce (video pengenalan) ──────────────
    introduce: {
      chip: "Video Pengenalan",
      title: "Kenali Eureka.AI dalam Sekejap",
      subtitle:
        "Pilih bahasa video — Indonesia atau English. Video ini menjelaskan cara Eureka.AI mengubah video, artikel & PDF menjadi catatan otomatis, kuis, dan kartu hafalan.",
      videoId: "Video Bahasa Indonesia",
      videoEn: "Video Bahasa Inggris",
      watchNote: "Butuh bantuan? Tanya lewat",
      chatLink: "chat Eureka.AI",
      mulaiBelajar: "Mulai Belajar",
      keBeranda: "Ke Beranda",
    },
  },

  en: {
    nav: {
      fitur: "Features",
      caraKerja: "How it works",
      harga: "Pricing",
      faq: "FAQ",
      pricing: "Pricing",
      beta: "Beta",
      masuk: "Log in",
      cobaGratis: "Try Free",
      bukaDashboard: "Open Dashboard",
      lanjutBelajar: "Continue Learning",
      mulaiGratis: "Start Free",
      lihatHarga: "See Pricing",
      sayaSudahPunyaAkun: "I already have an account",
    },
    hero: {
      chip: "AI Tutor for Every Indonesian Student",
      title1: "Not just answers — the",
      title2: "Eureka!",
      subtitle:
        "Eureka.AI is a Socratic AI Tutor for students: turn videos, articles & PDFs into auto-generated notes, ask anything per chapter, take quizzes & flashcards — and discover the answers yourself.",
      gratis: "Free forever for core features — no credit card required",
      noteTitle: "Derivatives — Core Concepts",
      noteMeta: "YouTube · 12 min → auto notes",
      noteBab: "Chapter 1 · Limits",
      noteQuiz: "5 quizzes ready",
      chatEureka:
        "Eureka: “If you run 5 km in 30 minutes, what's your average speed?”",
      chatSiswa: "Student: “10 km/h… Oh, that's a derivative!”",
      streak: "7-day streak",
      level: "Level 3 · 245 XP",
    },
    aiModels: {
      label: "Powered by Leading AI Models",
      title: "What AI powers Eureka.AI?",
      desc: "Multi-model AI system — automatically picks the best model for each learning task",
    },
    fitur: {
      label: "Why Eureka.AI",
      title: "Learning that makes you understand, not just memorize",
      desc: "From auto-generated notes to interactive quizzes — everything is built for deep understanding.",
      items: [
        {
          title: "Socratic AI Tutor",
          desc: "Eureka doesn't give instant answers — it guides you with step-by-step questions until you have your own 'Eureka!' moment.",
        },
        {
          title: "Auto Notes from Any Material",
          desc: "Paste a YouTube link, an article, or upload a PDF — AI turns it into structured chapter-by-chapter study notes.",
        },
        {
          title: "Ask Anything per Chapter",
          desc: "Stuck on a topic? Ask the AI right in that chapter — answers stay focused on what you're studying.",
        },
        {
          title: "Study Together with Friends",
          desc: "Real-time collaboration on the same note: chat, shared highlights, and a whiteboard for online group study.",
        },
        {
          title: "Quizzes & Flashcards",
          desc: "Every note comes with AI-generated quizzes and flashcards — practice without building your own questions.",
        },
        {
          title: "Streaks, XP & Leaderboard",
          desc: "Daily study keeps your streak alive. Level up, earn XP, and track your progress on the leaderboard.",
        },
      ],
    },
    caraKerja: {
      label: "How it works",
      title: "How does Eureka.AI work?",
      desc: "Eureka.AI works in 3 steps: upload or paste material, AI turns it into chapter-by-chapter notes, then you learn through Q&A, quizzes, and flashcards.",
      langkah: "Step",
      steps: [
        {
          title: "Add Your Material",
          desc: "Paste a YouTube or web link, or upload PDF/DOCX — whatever your learning source.",
        },
        {
          title: "AI Writes the Notes",
          desc: "Material becomes clean chapters with summaries, key points, quizzes, and flashcards.",
        },
        {
          title: "Learn Until Eureka!",
          desc: "Ask the AI per chapter, take quizzes, review flashcards — until you truly get it.",
        },
      ],
    },
    fakta: {
      label: "Eureka.AI Facts",
      title: "Numbers that make Eureka.AI different",
      desc: "Eureka.AI is a free AI learning app for Indonesian students: 4 summary types, up to 6 chapters per note, and 3 material sources — YouTube videos, web articles, and documents.",
      stat1: "summary types: regular, paper, report, and key points",
      stat2: "days of active Pro per payment — Rp 59.000, no recurring subscription",
      stat3: "material sources: YouTube videos, web articles, and document files (PDF, DOCX, PPTX)",
      updated: "Last updated: August 2026",
    },
    harga: {
      label: "Pricing",
      title: "How much does Eureka.AI cost?",
      desc: "Pro Rp 59.000/month — pay once, active 30 days.",
      gratis: "Free",
      perBulan: "/month",
      gratisFeatures: [
        "Socratic AI chat (daily limit)",
        "3 auto-generated notes per month",
        "Basic quizzes & flashcards",
        "Streaks, XP & leaderboard",
      ],
      terpopuler: "Most popular",
      pro: "Pro",
      proFeatures: [
        "Everything in Free",
        "Unlimited AI chat",
        "Unlimited auto-generated notes",
        "Real-time collaboration with friends",
        "Early access to new features",
      ],
      berlangganan: "Subscribe to Pro",
      pembayaran:
        "Secure payments via Pakasir — QRIS, e-wallet, VA. Auto-activated after verification.",
    },
    faq: {
      label: "FAQ",
      title: "Frequently asked questions",
      items: [
        {
          q: "What is Eureka.AI?",
          a: "Eureka.AI is a Socratic AI Tutor for Indonesian students. It turns material (videos, articles, PDFs) into auto-generated notes, then guides you to understand concepts through step-by-step questions — not just answers.",
        },
        {
          q: "Is Eureka.AI free?",
          a: "Yes. The Free plan lasts forever: AI chat with a daily limit, 3 auto-generated notes per month, plus basic quizzes and flashcards. Upgrade to Pro (Rp 59.000/month) for unlimited access.",
        },
        {
          q: "How do I create auto-generated notes?",
          a: "Paste a YouTube or web link, or upload a PDF/DOCX in the dashboard. AI summarizes it into structured chapter-by-chapter notes with summaries, quizzes, and flashcards.",
        },
        {
          q: "What is the Socratic method?",
          a: "The Socratic method is learning through step-by-step questions: instead of giving you the answer directly, Eureka guides you to discover it yourself, so understanding is deeper and lasts longer.",
        },
        {
          q: "Can I study with friends?",
          a: "Yes. Eureka.AI supports real-time collaboration on the same note — chat, shared highlights, and a whiteboard — great for online group study.",
        },
        {
          q: "What free AI learning app is available in Indonesia?",
          a: "Eureka.AI is a free AI learning app for Indonesian students. At no cost you can chat with an AI tutor, create 3 auto-generated notes per month, and take quizzes. Just sign up with email or Google — no credit card.",
        },
        {
          q: "Can Eureka.AI summarize YouTube videos?",
          a: "Yes. Paste a YouTube link in the dashboard and AI extracts the subtitles into chapter-by-chapter notes with summaries, key points, quizzes, and flashcards — ready to review before exams.",
        },
        {
          q: "How does the Eureka AI tutor work?",
          a: "Eureka uses the Socratic method: it asks step-by-step questions and guides you to find the answer yourself. Material becomes structured notes, then the AI acts as a tutor that adapts difficulty to your understanding.",
        },
        {
          q: "Which education levels is Eureka.AI for?",
          a: "Eureka.AI suits junior high, senior high, and university students. Each account can choose their level and subjects in the profile, so the AI adapts language, difficulty, and examples to your needs.",
        },
      ],
    },
    ctaAkhir: {
      title: "Ready for your first Eureka moment?",
      desc: "Start free now, paste your first material, and let AI guide you until you truly understand — not just memorize.",
    },
    footer: {
      tagline: "Socratic AI Tutor for Indonesian students",
      copyright: "Socratic AI Tutor for Indonesian students",
    },
    review: {
      label: "User Reviews",
    },
    pricing: {
      alreadyPro: "You're Already Pro!",
      upgrade: "Upgrade to Pro",
      subtitle:
        "Eureka.AI pricing — Socratic AI Tutor for Indonesian students. Start free forever, upgrade to Pro for unlimited learning.",
      activeUntil: "Subscription active —",
      until: "until",
      hello: "Hi",
      getUnlimited: "Get an unlimited learning experience.",
      statusActive: "Your subscription is active",
      trialActiveDesc:
        "You're on a free trial. All Pro features are unlocked!",
      proActiveDesc:
        "All Pro features are unlocked. Thanks for subscribing!",
      topUp: "Top Up Pro (Renew 30 Days)",
      toPakar: "To Pakasir…",
      refreshStatus: "Refresh status",
      backHome: "Back to Home",
      cancelSubscription: "Cancel Subscription",
      freeTrial7: "Try Free for 7 Days",
      trialDesc: "All Pro features, no payment. Once per lifetime, no credit card.",
      claimTrial: "Claim Free Trial",
      activating: "Activating…",
      proMonthly: "Pro Monthly",
      normalPrice: "Regular price",
      perMonth: "/month",
      free100: "100% Free",
      claimFree: "Claim Free",
      choose: "Choose",
      haveCode: "Have a discount code?",
      codePlaceholder: "ENTER CODE (e.g. GRATIS100)",
      use: "Apply",
      codeHint:
        "Press Enter or the Apply button to redeem the code before choosing a plan.",
      remainingQuota: "{n} of 10 spots left.",
      everything: "Everything you get",
      payNote:
        "Secure payments via Pakasir — QRIS, e-wallet, VA. Premium activates automatically after payment is verified.",
      later: "Maybe later",
      purchaseHistory: "Purchase History",
      loadingHistory: "Loading history...",
      noPurchases: "No purchases yet.",
      paid: "Paid",
      unpaid: "Unpaid",
      cancelTitle: "Cancel Subscription?",
      cancelDesc:
        "Premium access will stop now. Since Pro is already very affordable, there is no refund for the remaining active period.",
      yesCancel: "Yes, Cancel Subscription",
      cancelling: "Cancelling…",
      notNow: "Not now",
      errInvalidCode: "Invalid code.",
      errLoginFirst: "Please log in first to subscribe.",
      errPayment: "Failed to create payment. Try again.",
      errValidate: "Failed to validate code. Try again.",
      errTrial: "Failed to activate trial. Try again.",
      errCancel: "Failed to cancel subscription. Try again.",
      errLoginTrial: "Please log in first to try the trial.",
      errLoginCancel: "Please log in first.",
      perks: [
        "Unlimited study sessions & AI chat",
        "Real-time web search while asking",
        "AI image generation (Eureka Draw)",
        "Unlimited AI quizzes & flashcards",
        "Unlimited AI note generation",
        "Priority access to new features",
      ],
    },
    auth: {
      welcome: "Welcome Back!",
      welcomeSub: "Log in and continue your Eureka moment",
      loginGoogle: "Continue with Google",
      or: "or",
      tabPassword: "Password",
      tabOtp: "OTP Code",
      email: "EMAIL",
      emailPlaceholder: "you@email.com",
      password: "PASSWORD",
      showPassword: "Show password",
      hidePassword: "Hide password",
      login: "Log in",
      otpHint:
        "Enter your email — we'll send a 6-digit code that lasts a few minutes. No password needed!",
      sendCode: "Send Code",
      changeEmail: "Change email",
      otpSent: "A 6-digit code was sent to",
      otpCheckInbox: "Check your inbox (or spam).",
      otpLabel: "OTP CODE",
      resend: "Resend code",
      resending: "Resending...",
      resendIn: "Resend in",
      noAccount: "Don't have an account?",
      backHome: "← Back to home",
      errFill: "Please enter your email and password.",
      errCaptcha: "Please complete the security check (captcha) first.",
      errLogin: "Failed to log in. Try again.",
      errEmail: "Please enter your email first.",
      errSend: "Failed to send the code. Try again.",
      errOtp6: "Enter the 6-digit code from your email.",
      errVerify: "Verification failed. Try again.",
      errGoogle: "Failed to open Google login.",
      pageLoader: "Preparing login page...",
      regTitle: "Sign Up Free Now",
      regSubForm:
        "Enter your name & email — your account is created automatically once you verify the OTP code",
      regSubOtp: "Check your email for the verification code",
      regGoogle: "Sign up with Google",
      fullName: "FULL NAME",
      namePlaceholder: "Your name",
      regOtp: "Sign Up with OTP Code",
      changeNameEmail: "Change name / email",
      regOtpSent:
        "Check your inbox (or spam). Your account is created automatically when the code is correct.",
      createAccount: "Create Account & Log in",
      haveAccount: "Already have an account?",
      loginHere: "Log in here",
      errNameEmail: "Please enter your name (min 2 letters) and email.",
      errGoogleReg: "Failed to open Google signup.",
      pageLoaderReg: "Preparing signup page...",
    },
    join: {
      chip: "Beta Tester Program",
      title: "Join Eureka.AI Beta",
      subtitle:
        "Help us test new features & get early access. As a beta tester you can try experimental features right away:",
      featRecTitle: "Voice Recording in Composer",
      featRecDesc: "Speak and it turns into text in the chat — no typing needed.",
      featCallTitle: "Realtime AI Calls",
      featCallDesc:
        "Eureka.AI voice tutor: ask by voice, answered by voice + animated visualizer.",
      featEarlyTitle: "Early Access to New Features",
      featEarlyDesc:
        "Be among the first to try experimental features before public release.",
      alreadyTitle: "You're already a beta tester!",
      alreadyDesc:
        "Voice Recording & AI Calls are now unlocked on your chat page.",
      tryNow: "Try Now",
      keDashboard: "Go to Dashboard",
      readyTitle: "Ready to try new features?",
      readyDesc:
        "Click the button below and beta access activates instantly on your account. No cost, no waiting for approval.",
      joinNow: "Join Beta Now",
      activating: "Activating...",
      joinNote:
        "An account is required — if you're not logged in, you'll be taken to the login page first, then return automatically.",
      errLogin: "Please log in first to join the beta.",
      errJoin: "Failed to join beta. Try again.",
      question: "Questions? Ask via",
      chatLink: "Eureka.AI chat",
    },
    launch: {
      chip: "Eureka.AI Launch",
      title: "Claim Your Eureka.AI Launch Gift",
      subtitle:
        "Open this link while logged in and your gift activates automatically — no code, no credit card.",
      perks: [
        {
          title: "7-Day Pro Trial",
          desc: "Unlimited AI chat, auto notes, quizzes & flashcards — free for 7 days.",
        },
        {
          title: "Voice Recording in Composer",
          desc: "Speak and it turns into text in the chat — no typing needed.",
        },
        {
          title: "Realtime AI Calls",
          desc: "Eureka.AI voice tutor: ask by voice, get answered by voice.",
        },
        {
          title: "Early Access to New Features",
          desc: "Become a beta tester — try experimental features before public release.",
        },
      ],
      checking: "Checking your session...",
      guestTitle: "A gift for Eureka.AI users",
      guestDesc:
        "Log in (or sign up free) first, then come back to this page — your 7-day Pro trial & beta access activate automatically.",
      masukKlaim: "Log in & Claim",
      daftarGratis: "Sign Up Free",
      guestNote: "Already have an account? Just log in — no need to re-register.",
      workingTitle: "Activating your gift...",
      workingDesc: "Pro trial + beta access — activating in a moment.",
      trialActive: "7-Day Pro Trial Active!",
      trialUnavailable: "Trial unavailable",
      trialUntil: "Active until",
      trialUntilDesc: "unlimited AI chat, auto notes, quizzes & flashcards.",
      stillFree: "You can still use beta & free features.",
      betaActive: "Beta Tester Active!",
      betaUnavailable: "Beta unavailable",
      betaActiveDesc:
        "Voice recording in the composer & realtime AI calls are now unlocked on your chat page.",
      betaFail: "Failed to activate beta. Please try again later.",
      mulalBelajar: "Start Learning",
      keDashboard: "Go to Dashboard",
      footer:
        "One account = one Pro trial (7 days). Already claimed? Beta can still be activated.",
      question: "Questions? Ask via",
      chatLink: "Eureka.AI chat",
      claimFail: "Some gifts failed to activate. Please try again later.",
      claimFailTrial: "Failed to claim trial.",
    },
    introduce: {
      chip: "Intro Video",
      title: "Meet Eureka.AI in a Flash",
      subtitle:
        "Choose your video language — Indonesian or English. This video shows how Eureka.AI turns videos, articles & PDFs into auto-generated notes, quizzes, and flashcards.",
      videoId: "Indonesian Video",
      videoEn: "English Video",
      watchNote: "Need help? Ask via",
      chatLink: "Eureka.AI chat",
      mulaiBelajar: "Start Learning",
      keBeranda: "Back to Home",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)["id"];

/** Ambil dictionary untuk locale (fallback: id untuk key yang belum diterjemahkan). */
export function getDictionary(locale: Locale): Dictionary {
  if (locale === "id") return dictionaries.id;
  const en = dictionaries.en;
  return deepMerge(dictionaries.id, en) as Dictionary;
}

/** Gabungkan: nilai en menimpa id hanya jika key-nya ada di en. */
function deepMerge(base: unknown, override: unknown): unknown {
  if (
    typeof base === "object" &&
    base !== null &&
    typeof override === "object" &&
    override !== null &&
    !Array.isArray(base) &&
    !Array.isArray(override)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
      const ov = (override as Record<string, unknown>)[k];
      out[k] = ov === undefined ? v : deepMerge(v, ov);
    }
    return out;
  }
  return override === undefined ? base : override;
}
