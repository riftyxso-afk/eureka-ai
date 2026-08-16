export interface StepOption {
  label: string;
  value: string;
}

export interface OnboardingStep {
  key: "name" | "username" | "education" | "grade" | "psyTest" | "weakTopic" | "learningHabit" | "peakHour";
  emoji: string;
  question: string;
  subtitle?: string;
  options?: StepOption[];
  /** Indeks soal tes psikologi bila key === "psyTest". */
  psyIndex?: number;
}

export interface PsyOption {
  label: string;
  /** Tag sifat/kecenderungan yang dianalisis AI. */
  trait: string;
}

export interface PsyQuestion {
  id: string;
  question: string;
  subtitle?: string;
  options: PsyOption[];
}

/** Tes psikologi singkat ala onboarding Eureka.AI. Jawaban dianalisis AI per akun. */
export const PSY_QUESTIONS: PsyQuestion[] = [
  {
    id: "belajar_baru",
    question: "Kalau harus paham materi baru, cara mana yang paling bikin kamu cepat ngerti?",
    subtitle: "Pilih yang paling mirip dengan kamu",
    options: [
      { label: "Nonton video / lihat diagram & gambar", trait: "visual" },
      { label: "Dengerin penjelasan / podcast / diskusi", trait: "auditori" },
      { label: "Langsung praktik / coba-coba sendiri", trait: "kinestetik" },
      { label: "Baca buku / catatan dengan teliti", trait: "reading_writing" },
    ],
  },
  {
    id: "hadapi_sulit",
    question: "Ketika ketemu soal yang bener-bener susah, apa yang biasanya kamu lakuin duluan?",
    subtitle: "Jawab jujur ya, nggak ada yang dinilai",
    options: [
      { label: "Nanya ke teman / guru / AI", trait: "mencari_bantuan" },
      { label: "Dipikirin terus sampai nemu sendiri", trait: "persisten" },
      { label: "Cari cara pintas atau contoh soal serupa", trait: "strategis" },
      { label: "Skip dulu, nanti balik lagi kalau udah santai", trait: "mengatur_ritme" },
    ],
  },
  {
    id: "motivasi",
    question: "Apa yang paling bikin kamu semangat belajar?",
    options: [
      { label: "Nilai bagus & ranking naik", trait: "pencapaian" },
      { label: "Penasaran dan pengen benar-benar paham", trait: "rasa_ingin_tahu" },
      { label: "Belajar bareng teman, seru-seruan", trait: "sosial" },
      { label: "Biar berguna buat cita-cita & masa depan", trait: "tujuan_jangka_panjang" },
    ],
  },
  {
    id: "lingkungan",
    question: "Kamu paling fokus belajar dalam suasana yang seperti apa?",
    options: [
      { label: "Sendirian, hening total, tanpa gangguan", trait: "fokus_solo" },
      { label: "Ada musik / suara pelan di latar belakang", trait: "ambient" },
      { label: "Kelompok kecil bareng teman", trait: "kolaboratif" },
      { label: "Bebas, bisa di mana aja asal nyaman", trait: "fleksibel" },
    ],
  },
  {
    id: "waktu",
    question: "Kalau tugasnya banyak banget, gaya kamu menghadapinya gimana?",
    options: [
      { label: "Bikin jadwal / prioritas dulu, baru mulai", trait: "terstruktur" },
      { label: "Kerjain semuanya sekaligus, maraton", trait: "maraton" },
      { label: "Cicil sedikit-sedikit setiap hari", trait: "konsisten" },
      { label: "Nunggu mepet deadline biar termotivasi", trait: "deadline_rider" },
    ],
  },
  {
    id: "perasaan",
    question: "Kalau hasil belajar nggak sesuai harapan (mis. nilai jelek), reaksi kamu biasanya...",
    options: [
      { label: "Evaluasi: cari tahu di mana salahnya", trait: "reflektif" },
      { label: "Sedih sebentar, lalu bangkit lagi", trait: "resilien" },
      { label: "Minta bantuan buat belajar bareng / les", trait: "kolaboratif_belajar" },
      { label: "Sempet down dan males lanjut", trait: "butuh_semangat" },
    ],
  },
];

export const EDUCATION_OPTIONS: StepOption[] = [
  { label: "🏫 SD (Sekolah Dasar)", value: "sd" },
  { label: "🏫 SMP (Sekolah Menengah Pertama)", value: "smp" },
  { label: "🏫 SMA (Sekolah Menengah Atas)", value: "sma" },
  { label: "🎓 Mahasiswa", value: "mahasiswa" },
  { label: "📚 Lainnya", value: "lainnya" },
];

/** Opsi kelas/semester yang menyesuaikan jenjang pendidikan. */
export function gradeOptionsFor(education: string): StepOption[] {
  switch (education) {
    case "sd":
      return [
        { label: "Kelas 1", value: "kelas_1" },
        { label: "Kelas 2", value: "kelas_2" },
        { label: "Kelas 3", value: "kelas_3" },
        { label: "Kelas 4", value: "kelas_4" },
        { label: "Kelas 5", value: "kelas_5" },
        { label: "Kelas 6", value: "kelas_6" },
      ];
    case "smp":
      return [
        { label: "Kelas 7", value: "kelas_7" },
        { label: "Kelas 8", value: "kelas_8" },
        { label: "Kelas 9", value: "kelas_9" },
      ];
    case "sma":
      return [
        { label: "Kelas 10", value: "kelas_10" },
        { label: "Kelas 11", value: "kelas_11" },
        { label: "Kelas 12", value: "kelas_12" },
      ];
    case "mahasiswa":
      return [
        { label: "Semester 1", value: "semester_1" },
        { label: "Semester 2", value: "semester_2" },
        { label: "Semester 3", value: "semester_3" },
        { label: "Semester 4", value: "semester_4" },
        { label: "Semester 5+", value: "semester_5" },
      ];
    default:
      return [
        { label: "Tingkat pemula", value: "pemula" },
        { label: "Tingkat menengah", value: "menengah" },
        { label: "Tingkat lanjut", value: "lanjut" },
      ];
  }
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "name",
    emoji: "👋",
    question: "Halo! Kenalan dulu yuk.",
    subtitle: "Nama kamu siapa?",
  },
  {
    key: "username",
    emoji: "🏷️",
    question: "Bikin @username biar teman bisa nemuin kamu",
    subtitle: "Hanya huruf kecil, angka, dan _ (3–20 karakter)",
  },
  {
    key: "education",
    emoji: "🎓",
    question: "Kamu sekarang di jenjang apa?",
    subtitle: "Ini penting biar materi & penjelasannya pas dengan levelmu",
    options: EDUCATION_OPTIONS,
  },
  {
    key: "grade",
    emoji: "📚",
    question: "Kelas/Semester berapa sekarang?",
    subtitle: "Pilih sesuai jenjangmu",
  },
  ...PSY_QUESTIONS.map((q, i): OnboardingStep => ({
    key: "psyTest",
    emoji: "🧠",
    question: i === 0 ? `Tes Kepribadian Belajar — ${q.question}` : q.question,
    subtitle: q.subtitle ?? "Jawab sesuai diri kamu, hasilnya dianalisis AI khusus buat kamu",
    psyIndex: i,
  })),
  {
    key: "weakTopic",
    emoji: "🤯",
    question: "Topik Matematika apa yang paling bikin kamu pusing?",
    options: [
      { label: "Aljabar", value: "aljabar" },
      { label: "Turunan (Diferensial)", value: "turunan" },
      { label: "Integral", value: "integral" },
      { label: "Statistika & Peluang", value: "statistika_peluang" },
      { label: "Trigonometri", value: "trigonometri" },
      { label: "Semua aman!", value: "semua_aman" },
    ],
  },
  {
    key: "learningHabit",
    emoji: "🧐",
    question: "Kalau ketemu soal susah, kebiasaan kamu gimana?",
    options: [
      { label: "Langsung tanya temen/guru", value: "tanya_temen" },
      { label: "Cari jawaban di Google/ChatGPT", value: "cari_google" },
      { label: "Coba kerjain sendiri sampai nemu jalannya", value: "coba_sendiri" },
      { label: "Skip, move on", value: "skip" },
    ],
  },
  {
    key: "peakHour",
    emoji: "⏰",
    question: "Kapan waktu paling fokus buat belajar?",
    options: [
      { label: "Pagi buta (jam 4-7)", value: "pagi" },
      { label: "Siang/Malam (di luar jam sekolah)", value: "malam" },
    ],
  },
];

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export function isUsernameValid(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

export function usernameHint(username: string): string | null {
  const clean = normalizeUsername(username);
  if (clean.length === 0) return null;
  if (!isUsernameValid(clean)) {
    return "Hanya huruf kecil, angka, dan _ (3–20 karakter).";
  }
  return null;
}

export const LOADING_TEXTS: string[] = [
  "Menganalisis profil kognitifmu...",
  "Memetakan hasil tes kepribadian belajarmu...",
  "Menentukan tipe kepribadian belajar khas kamu...",
  "Mengidentifikasi gaya belajarmu yang paling efektif...",
  "Menyusun strategi tutor Socratic yang personal...",
  "Mengaktifkan Agentic Engine untuk kebutuhanmu...",
  "Menyimpan profil & @username kamu ke cloud...",
  "Siap!",
];
