export type PageGuide = {
  label: string;
  title: string;
  description: string;
  steps: readonly [string, string, string];
  action: string;
  target?: string;
  /** Add a local /tutorials/...mp4 path or an HTTPS recording here when ready. */
  recording?: { src: string; poster?: string };
};

export const PAGE_GUIDES = {
  dashboard: {
    label: "Beranda", title: "Belajar kini dimulai dari obrolan",
    description: "Bawa ide, tautan, atau materi belajarmu. Momo membantu menyusunnya menjadi catatan yang bisa kamu pelajari dengan berbagai cara.",
    steps: ["Tulis topik atau lampirkan materi", "Kirim, lalu ikuti proses penyusunan", "Buka catatan untuk mulai belajar"],
    action: "Buat catatan pertama", target: ".dv2-composer textarea, .dv2 textarea, [data-tutorial-id='create-note-btn']",
  },
  "room-learn": {
    label: "Alur belajar", title: "Satu materi, banyak cara memahami",
    description: "Ikuti bab sesuai urutanmu. Semua alat belajar untuk materi ini tersedia di menu ruang belajar.",
    steps: ["Pilih bab yang ingin dipelajari", "Baca dan tandai bab yang selesai", "Lanjutkan dengan kuis atau flashcard"],
    action: "Mulai menjelajah", target: ".sr-continue button",
  },
  "room-notes": {
    label: "Editor catatan", title: "Jadikan catatan ini milikmu",
    description: "Baca ringkasan atau pilih bab, rapikan tulisan, dan minta bantuan Momo untuk bagian yang ingin diperjelas.",
    steps: ["Pilih ringkasan atau bab", "Blok teks untuk membuka bantuan AI", "Tinjau perubahan, lalu simpan"],
    action: "Buka editor", target: ".de-editor .tiptap, .tiptap, [contenteditable='true']",
  },
  "room-mindmap": {
    label: "Mindmap · Beta", title: "Lihat bagaimana ide saling terhubung",
    description: "Jelajahi cabang konsep sambil membaca bab di sampingnya. Momo juga bisa mengembangkan peta dari isi catatanmu.",
    steps: ["Pilih cabang untuk membaca konsep", "Geser atau perbesar kanvas", "Kembangkan dengan AI saat diperlukan"],
    action: "Jelajahi mindmap", target: ".rm-mindmap input, .rm-map-search input, .rm-feature-heading button",
  },
  "room-quiz": {
    label: "Kuis", title: "Uji pemahaman, bukan sekadar hafalan",
    description: "Latih materi dari catatan ini, lalu gunakan pembahasan untuk memahami bagian yang belum tepat.",
    steps: ["Siapkan soal dari materi", "Pilih jawaban dan periksa hasilnya", "Baca pembahasan, lalu coba kembali"],
    action: "Lihat latihan", target: ".sp-setup button, .sp-choices button, .sp-question-actions button",
  },
  "room-cards": {
    label: "Flashcard", title: "Ingat sedikit demi sedikit",
    description: "Coba ingat jawaban sebelum membalik kartu. Nilai tingkat kesulitannya untuk mengatur latihan berikutnya.",
    steps: ["Baca pertanyaan pada kartu", "Balik untuk melihat jawabannya", "Nilai seberapa mudah kamu mengingat"],
    action: "Lihat kartu", target: ".rf-flip, .rf-card, .sp-setup button",
  },
  "room-sources": {
    label: "Sumber materi", title: "Kembali ke sumber aslinya",
    description: "Telusuri tautan dan berkas yang menjadi dasar catatan. Gunakan sumber asli untuk memeriksa informasi penting.",
    steps: ["Periksa daftar sumber", "Buka tautan materi asli", "Bandingkan dengan isi catatan"],
    action: "Lihat sumber", target: ".rm-source-card a, .rm-source-card",
  },
  "room-ask": {
    label: "Tanya Momo", title: "Belum paham? Kita bahas bersama",
    description: "Momo memiliki konteks catatan ini. Tanyakan bagian tertentu, minta contoh, atau uji pemahamanmu lewat obrolan.",
    steps: ["Tulis bagian yang belum dipahami", "Kirim pertanyaan ke Momo", "Lanjutkan dengan pertanyaan susulan"],
    action: "Tanyakan sesuatu", target: ".rm-chat-composer textarea",
  },
  "room-podcast": {
    label: "Studio podcast · Beta", title: "Dua teman bicara, satu cerita belajar",
    description: "Susun percakapan dari materi ini. Pilih dua host, tentukan gaya obrolan, lalu dengarkan hasilnya di studio.",
    steps: ["Isi kursi kiri dan kanan dengan host", "Atur gaya, bahasa, dan durasi", "Buat podcast, lalu dengarkan"],
    action: "Masuk studio", target: ".ps-host-labels button",
  },
  "room-scratch": {
    label: "Catatan tempel", title: "Tangkap ide sebelum terlupa",
    description: "Simpan pertanyaan, rumus, atau pengingat kecil di atas kertas tempel yang terhubung dengan materi ini.",
    steps: ["Buat kertas tempel baru", "Tulis ide atau pengingatmu", "Geser kertas untuk menata papan"],
    action: "Lihat papan tempel", target: ".rm-sticky-board button, .rm-sticky-board textarea",
  },
  chat: {
    label: "Chat Eureka", title: "Teman berpikir untuk setiap pertanyaan",
    description: "Mulai percakapan dengan Momo. Pilih model dan tingkat kedalaman jawaban, atau lampirkan catatan sebagai konteks.",
    steps: ["Tulis pertanyaan atau tambahkan materi", "Pilih model dan tingkat kedalaman", "Kirim dan lanjutkan percakapan"],
    action: "Mulai mengobrol", target: "textarea",
  },
  library: {
    label: "Koleksi catatan", title: "Semua materi, satu rak belajarmu",
    description: "Cari catatan yang sudah dibuat, buka buku untuk mempelajari babnya, atau tambahkan materi baru.",
    steps: ["Cari atau pilih catatan", "Buka buku untuk melihat bab", "Tambahkan materi saat diperlukan"],
    action: "Jelajahi catatan", target: "input[type='search'], input[placeholder*='Cari']",
  },
  subjects: {
    label: "Mata pelajaran", title: "Susun perjalanan belajarmu per pelajaran",
    description: "Kelompokkan materi agar lebih mudah ditemukan, lalu pilih langkah belajar berikutnya dari peta aktivitasmu.",
    steps: ["Pilih atau buat mata pelajaran", "Buka materi yang tersedia", "Siapkan dan ulangi kartu latihan"],
    action: "Lihat mata pelajaran", target: "input[placeholder*='Cari']",
  },
  missions: {
    label: "Misi", title: "Langkah kecil menjadi kebiasaan",
    description: "Pilih tantangan belajar yang sesuai dengan materimu. Ikuti aktivitasnya dan lihat progres dari hasil yang tercatat.",
    steps: ["Pilih misi yang tersedia", "Buka aktivitas yang diarahkan", "Kembali untuk melihat progres"],
    action: "Lihat misi",
  },
  schedule: {
    label: "Jadwal", title: "Beri ruang untuk belajar",
    description: "Atur waktu belajar dan pengingat agar materi penting mendapat perhatian secara teratur.",
    steps: ["Pilih tanggal atau jadwal", "Tambahkan aktivitas belajar", "Tinjau rencana yang tersimpan"], action: "Atur jadwal",
  },
  leaderboard: {
    label: "Papan skor", title: "Tumbuh bersama teman belajar",
    description: "Lihat peringkat berdasarkan aktivitas belajar yang tercatat dan jadikan kemajuan sebagai penyemangat.",
    steps: ["Pilih lingkup peringkat", "Lihat progres belajarmu", "Lanjutkan aktivitas untuk menambah XP"], action: "Lihat papan skor",
  },
  profile: {
    label: "Profil", title: "Kenali perjalanan belajarmu",
    description: "Lihat profil dan perkembangan akunmu, lalu perbarui informasi yang ingin kamu tampilkan.",
    steps: ["Periksa profil dan statistik", "Perbarui informasi akun", "Simpan perubahan yang diperlukan"], action: "Lihat profil",
  },
  courses: {
    label: "Kursus · Pengembangan", title: "Kenali ruang kursus personal",
    description: "Fitur kursus masih dalam pengembangan. Gunakan catatan dan ruang belajar untuk mempelajari materimu sekarang.",
    steps: ["Lihat status ketersediaan fitur", "Kembali ke koleksi catatan", "Belajar lewat bab, kuis, dan kartu"], action: "Mengerti",
  },
  settings: {
    label: "Pengaturan", title: "Atur Eureka sesuai kebutuhanmu",
    description: "Tinjau preferensi, informasi akun, dan pengaturan keamanan sebelum menyimpan perubahan.",
    steps: ["Pilih pengaturan yang diperlukan", "Tinjau perubahan dengan teliti", "Simpan untuk menerapkannya"], action: "Lihat pengaturan",
  },
  streaks: {
    label: "Streak", title: "Jaga ritme belajarmu",
    description: "Lihat kebiasaan belajar yang tercatat dan luangkan waktu untuk satu aktivitas hari ini.",
    steps: ["Periksa riwayat aktivitas", "Pilih materi untuk hari ini", "Selesaikan satu langkah belajar"], action: "Lihat aktivitas",
  },
  friends: {
    label: "Teman", title: "Temukan teman untuk belajar bersama",
    description: "Kelola koneksi belajarmu dan temukan teman untuk saling mendukung perjalanan belajar.",
    steps: ["Cari teman belajar", "Periksa permintaan pertemanan", "Kelola koneksi yang tersimpan"], action: "Lihat teman",
  },
  guide: {
    label: "Bantuan", title: "Kenali semua cara belajar di Eureka",
    description: "Buka panduan fitur sesuai kebutuhanmu. Pop-up ini juga bisa dibuka ulang melalui tombol Panduan di setiap halaman.",
    steps: ["Pilih topik bantuan", "Ikuti langkah yang dijelaskan", "Kembali ke fitur untuk mencoba"], action: "Baca panduan",
  },
  tasks: {
    label: "Tugas dan rencana", title: "Atur pekerjaan belajar satu per satu",
    description: "Tinjau tugas atau rencana yang tersedia, pilih prioritas, dan perbarui aktivitas setelah dikerjakan.",
    steps: ["Pilih tugas atau rencana", "Periksa detail dan waktunya", "Perbarui setelah selesai"], action: "Lihat aktivitas",
  },
  music: {
    label: "Musik", title: "Temukan suasana untuk fokus",
    description: "Pilih musik pendamping yang sesuai, atur suara, lalu kembali ke materi belajarmu.",
    steps: ["Pilih musik yang tersedia", "Atur pemutaran dan volume", "Lanjutkan belajar dengan nyaman"], action: "Lihat musik",
  },
} satisfies Record<string, PageGuide>;

export type PageGuideId = keyof typeof PAGE_GUIDES;

export function guideForPath(pathname: string): PageGuideId | null {
  const path = pathname.replace(/^\/(id|en)(?=\/|$)/, "").replace(/\/$/, "");
  if (path === "/dashboard-v2" || path === "/dashboard" || path === "/dashboard/v1") return "dashboard";
  // StudyRoom supplies its own guide, including local tab changes without navigation.
  if (path.startsWith("/dashboard-v2/")) return null;
  if (/^\/chat(?:\/|$)/.test(path)) return "chat";
  if (/^\/dashboard\/note\/[^/]+\/bab\//.test(path)) return "room-notes";
  if (/^\/dashboard\/note\/[^/]+\/(game|uji-pemahaman)/.test(path)) return "room-quiz";
  if (/^\/dashboard\/note\/[^/]+\/papan/.test(path)) return "room-scratch";
  if (/^\/dashboard\/note\//.test(path)) return "room-learn";
  const segment = path.split("/")[2];
  const pages: Record<string, PageGuideId> = {
    catatan: "library", "mata-pelajaran": "subjects", leaderboard: "leaderboard", misi: "missions",
    jadwal: "schedule", profil: "profile", kursus: "courses", pengaturan: "settings", keamanan: "settings",
    streaks: "streaks", teman: "friends", panduan: "guide", tugas: "tasks", ujian: "tasks", rencana: "tasks", musik: "music",
  };
  return path.startsWith("/dashboard/") ? pages[segment] ?? "guide" : null;
}
