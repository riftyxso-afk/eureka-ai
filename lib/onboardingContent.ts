export interface StepOption {
  label: string;
  value: string;
}

export interface OnboardingStep {
  key: "name" | "grade" | "weakTopic" | "learningHabit" | "peakHour";
  emoji: string;
  question: string;
  subtitle?: string;
  options?: StepOption[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "name",
    emoji: "👋",
    question: "Halo! Kenalan dulu yuk.",
    subtitle: "Nama kamu siapa?",
  },
  {
    key: "grade",
    emoji: "🎓",
    question: "Sekarang kamu kelas berapa?",
    options: [
      { label: "10 SMA", value: "10_sma" },
      { label: "11 SMA", value: "11_sma" },
      { label: "12 SMA", value: "12_sma" },
      { label: "Mahasiswa", value: "mahasiswa" },
      { label: "Lainnya", value: "lainnya" },
    ],
  },
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

export const LOADING_TEXTS: string[] = [
  "🔍 Menganalisis profil kognitifmu...",
  "🧩 Memetakan pola kesalahan matematika...",
  "🎯 Mengidentifikasi gaya belajarmu yang paling efektif...",
  "🤖 Menyusun strategi tutor Socratic yang personal...",
  "⚙️ Mengaktifkan Agentic Engine untuk kebutuhanmu...",
  "✨ Siap!",
];

export interface ResultFeature {
  icon: string;
  title: string;
  desc: string;
}

export const RESULT_FEATURES: ResultFeature[] = [
  {
    icon: "🧠",
    title: "Socratic AI",
    desc: "Bertanya balik, BUKAN kasih jawaban instan.",
  },
  {
    icon: "📋",
    title: "Agentic Planner",
    desc: "AI bikin rencana belajar 3 hari ke depan khusus buat kamu.",
  },
  {
    icon: "🎯",
    title: "Fokus di Kelemahanmu",
    desc: "Kami catat topik yang kamu pusingin untuk dipelajari pertama.",
  },
  {
    icon: "👁️",
    title: "Reasoning Trace",
    desc: "Lihat alur pikir AI step-by-step di balik layar.",
  },
];
