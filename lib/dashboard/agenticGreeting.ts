import type { ProgressStats } from "@/lib/progress-store";

export interface GreetingNoteSummary {
  id: string;
  title?: string;
  subject?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface GreetingSessionSummary {
  id: string;
  title?: string;
  updatedAt?: string;
}

export interface GreetingProfileSummary {
  name?: string;
  profileData?: {
    weakTopic?: string;
    learningHabit?: string;
    peakHour?: string;
    education?: string;
    grade?: string;
    analysis?: {
      psyLabel?: string;
    };
  };
}

export interface GreetingAction {
  label: string;
  href?: string;
  prompt?: string;
  mode?: "ask" | "note";
}

export interface AgenticGreeting {
  id: string;
  eyebrow: string;
  headline: string;
  subline: string;
  primaryAction?: GreetingAction;
  secondaryAction?: GreetingAction;
}

export interface AgenticGreetingInput {
  userName?: string;
  now?: Date;
  mode: "ask" | "note";
  effort: string;
  stats?: Partial<ProgressStats> | null;
  recentNotes?: GreetingNoteSummary[];
  recentSessions?: GreetingSessionSummary[];
  profile?: GreetingProfileSummary | null;
  rotationIndex?: number;
}

const WEAK_TOPIC_LABELS: Record<string, string> = {
  aljabar: "Aljabar",
  turunan: "Turunan & Diferensial",
  integral: "Integral",
  statistika_peluang: "Statistika & Peluang",
  trigonometri: "Trigonometri",
  matematika: "Matematika & hitungan",
  sains: "Sains & logika",
  ipa: "Sains & IPA",
  hafalan: "Hafalan & konsep",
  bahasa: "Bahasa & menulis",
  bahasa_inggris: "Bahasa Inggris",
  pemrograman: "Logika & pemrograman",
  sejarah: "Sejarah & hafalan",
  ekonomi: "Ekonomi & analisis",
};

const LEARNING_HABIT_HINTS: Record<string, string> = {
  tanya_temen: "lewat diskusi dua arah kayak belajar bareng teman",
  cari_google: "langsung ke inti konsep dan contoh cepat",
  coba_sendiri: "pakai petunjuk bertahap biar kamu nemu polanya sendiri",
  skip: "dipecah jadi langkah kecil supaya nggak terasa berat",
  contoh_visual: "pakai visualisasi dan analogi yang gampang kebayang",
  latihan_soal: "langsung lewat latihan soal bertahap",
  ringkasan: "diringkas jadi poin-poin inti biar cepat nempel",
  diskusi: "lewat tanya-jawab dua arah step by step",
};

const PEAK_HOUR_WINDOWS: Record<string, [number, number]> = {
  pagi: [4, 11],
  siang: [11, 15],
  sore: [15, 18],
  malam: [14, 23],
  tengah_malam: [23, 5],
};

function cleanFirstName(raw?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || /^pelajar$/i.test(trimmed) || /^user/i.test(trimmed)) return "";
  return trimmed.split(/\s+/)[0].slice(0, 24);
}

function truncateText(value: string, max = 32): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(8, max - 1)).trimEnd()}…`;
}

function isMeaningfulTitle(title?: string): title is string {
  if (!title) return false;
  const clean = title.trim().toLowerCase();
  if (clean.length < 3) return false;
  return ![
    "obrolan baru",
    "chat baru",
    "new chat",
    "tanpa judul",
    "untitled",
    "catatan baru",
    "aktivitas belajar",
    "sesi belajar",
    "belajar",
  ].includes(clean);
}

function isWithinHours(iso: string | undefined, hours: number, nowMs: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const diff = nowMs - t;
  return diff >= -60_000 && diff <= hours * 3_600_000;
}

function isPeakHourNow(peakHour: string | undefined, hour: number): boolean {
  if (!peakHour) return false;
  const normalized = peakHour.toLowerCase().trim();
  const win = PEAK_HOUR_WINDOWS[normalized];
  if (!win) return false;
  const [start, end] = win;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function timeGreeting(hour: number, firstName: string): { period: string; greeting: string } {
  const callName = firstName ? `, ${firstName}` : "";
  if (hour >= 5 && hour < 11) {
    return { period: "Pagi produktif", greeting: `Selamat pagi${callName}` };
  }
  if (hour >= 11 && hour < 15) {
    return { period: "Sesi siang", greeting: `Siang${callName}` };
  }
  if (hour >= 15 && hour < 18) {
    return { period: "Sore santai", greeting: `Sore${callName}` };
  }
  if (hour >= 18 && hour < 23) {
    return { period: "Malam fokus", greeting: `Malam${callName}` };
  }
  return { period: "Fokus larut malam", greeting: `Masih semangat${callName}` };
}

function formatWeakTopic(raw?: string): string {
  const clean = (raw ?? "").trim();
  if (!clean || clean === "lainnya" || clean === "semua_aman") return "";
  return WEAK_TOPIC_LABELS[clean] ?? clean.replace(/[_-]+/g, " ");
}

function formatHabitHint(raw?: string): string {
  const clean = (raw ?? "").trim();
  if (!clean) return "";
  return LEARNING_HABIT_HINTS[clean] ?? "";
}

export function buildAgenticCandidates(input: AgenticGreetingInput): AgenticGreeting[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const hour = now.getHours();
  const firstName = cleanFirstName(input.userName || input.profile?.name);
  const profileData = input.profile?.profileData ?? {};
  const stats = input.stats ?? {};
  const streak = Number(stats.streak ?? 0);
  const dueCards = Number(stats.dueCards ?? 0);
  const totalNotes = (input.recentNotes ?? []).length;
  const weakTopic = formatWeakTopic(profileData.weakTopic);
  const habitHint = formatHabitHint(profileData.learningHabit);
  const inPeakHour = isPeakHourNow(profileData.peakHour, hour);
  const { period, greeting } = timeGreeting(hour, firstName);
  const metaSuffix = [
    streak >= 2 ? `Streak ${streak} hari` : null,
    inPeakHour ? "Jam fokus favoritmu" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const candidates: AgenticGreeting[] = [];

  // 1. Live Mode & Effort awareness (always reactive to user's immediate UI toggle)
  if (input.mode === "note") {
    const noteBaseTopic =
      (isMeaningfulTitle(input.recentSessions?.[0]?.title) && input.recentSessions?.[0]?.title) ||
      weakTopic ||
      "topik barumu";
    candidates.push({
      id: "mode-note",
      eyebrow: ["Mode Catatan", metaSuffix].filter(Boolean).join(" · "),
      headline: firstName
        ? `Mau catat materi apa, ${firstName}?`
        : "Mau merapikan catatan materi apa?",
      subline: habitHint
        ? `Ketik topik, langsung diringkas ${habitHint}.`
        : "Tulis topik singkat, langsung jadi ringkasan siap hafal.",
      primaryAction: {
        label: `Catat ${truncateText(noteBaseTopic, 20)}`,
        prompt: `Buatkan catatan belajar terstruktur lengkap dengan poin inti, analogi mudah, dan 3 pertanyaan refleksi tentang: ${noteBaseTopic}`,
        mode: "note",
      },
      secondaryAction:
        totalNotes > 0
          ? { label: "Semua catatan", href: "/dashboard-v2/catatan" }
          : undefined,
    });
  }

  const latestNote = (input.recentNotes ?? []).find(
    (n) => typeof n.id === "string" && n.id.length > 0 && isMeaningfulTitle(n.title)
  );
  const anyNoteId = (input.recentNotes ?? []).find(
    (n) => typeof n.id === "string" && n.id.length > 0
  )?.id;

  // 2. Due flashcards (highest pedagogical urgency when cards are waiting)
  if (dueCards > 0) {
    const dueNoteId = stats.nextDueNoteId;
    candidates.push({
      id: "due-cards",
      eyebrow: [`${dueCards} kartu menunggu`, metaSuffix].filter(Boolean).join(" · "),
      headline: firstName
        ? `${dueCards} kartu siap diulang, ${firstName}`
        : `${dueCards} kartu siap diulang dulu`,
      subline: "Ulang sebentar sekarang biar hafalan tetap nempel.",
      primaryAction: dueNoteId
        ? {
            label: "Ulang flashcard",
            href: `/dashboard-v2/note/${encodeURIComponent(dueNoteId)}/flashcards`,
          }
        : {
            label: "Buka catatan & kartu",
            href: "/dashboard-v2/catatan",
          },
      secondaryAction: dueNoteId
        ? {
            label: "Kuis cepat",
            href: `/dashboard-v2/note/${encodeURIComponent(dueNoteId)}/quiz`,
          }
        : {
            label: "Misi Belajar",
            href: "/dashboard-v2/misi",
          },
    });
  }

  // 3. Recent AI chat session continuation
  const latestSession = (input.recentSessions ?? []).find((s) => isMeaningfulTitle(s.title));
  if (latestSession && isWithinHours(latestSession.updatedAt, 96, nowMs)) {
    const cleanTitle = truncateText(latestSession.title!, 28);
    candidates.push({
      id: "recent-session",
      eyebrow: ["Obrolan terakhir", metaSuffix].filter(Boolean).join(" · "),
      headline: `Lanjut bahas "${cleanTitle}"?`,
      subline:
        input.effort === "Mendalam"
          ? "Mode Mendalam aktif — siap bedah konsep dan soal lanjutannya."
          : "Lanjutkan diskusi terakhir atau uji lewat kuis singkat.",
      primaryAction: {
        label: "Lanjut chat",
        href: `/dashboard-v2/tanya-momo/${encodeURIComponent(latestSession.id)}`,
      },
      secondaryAction: {
        label: "Uji dengan kuis",
        prompt: `Uji pemahamanku tentang "${latestSession.title}" dengan 3 soal bertahap mulai dari dasar hingga menantang.`,
        mode: "ask",
      },
    });
  }

  // 4. Recent note follow-up
  if (latestNote) {
    const cleanTitle = truncateText(latestNote.title!, 28);
    candidates.push({
      id: "recent-note",
      eyebrow: [
        latestNote.subject ? `Catatan · ${latestNote.subject}` : "Catatan terbarumu",
        metaSuffix,
      ]
        .filter(Boolean)
        .join(" · "),
      headline: `Mau latih "${cleanTitle}"?`,
      subline: "Ubah catatanmu jadi latihan soal biar makin paham.",
      primaryAction: {
        label: "Latih dengan soal",
        prompt: `Berdasarkan topik catatan "${latestNote.title}", buatkan 4 soal latihan beserta pembahasan langkah demi langkah.`,
        mode: "ask",
      },
      secondaryAction: {
        label: "Buka catatan",
        href: `/dashboard-v2/note/${encodeURIComponent(latestNote.id)}`,
      },
    });
  }

  // 5. Recent activity momentum
  const meaningfulActivity = (stats.recentActivity ?? []).find((a) => isMeaningfulTitle(a?.label));
  const anyRecentActivity = (stats.recentActivity ?? [])[0];
  if (anyRecentActivity && isWithinHours(anyRecentActivity.date, 72, nowMs)) {
    const actLabel = meaningfulActivity ? truncateText(meaningfulActivity.label, 28) : "";
    candidates.push({
      id: "recent-activity",
      eyebrow: ["Momentum belajarmu", metaSuffix || `Level ${stats.level ?? 1}`].join(" · "),
      headline: firstName
        ? `Siap lanjut belajar, ${firstName}?`
        : "Momentum bagus. Lanjut apa sekarang?",
      subline: actLabel
        ? `Terakhir: ${actLabel}. Lanjut pendalaman atau kuis?`
        : "Pendalaman konsep atau kuis cepat dulu?",
      primaryAction: anyNoteId
        ? {
            label: "Kuis pemanasan",
            href: `/dashboard-v2/note/${encodeURIComponent(anyNoteId)}/quiz`,
          }
        : {
            label: "Buka Misi Belajar",
            href: "/dashboard-v2/misi",
          },
      secondaryAction: weakTopic
        ? {
            label: `Asah ${weakTopic}`,
            prompt: `Bantu aku menaklukkan topik ${weakTopic} hari ini mulai dari konsep yang paling sering bikin bingung.`,
            mode: "ask",
          }
        : undefined,
    });
  }

  // 6. Effort-specific agentic prompt ("Kilat" vs "Mendalam")
  if (input.effort === "Mendalam") {
    candidates.push({
      id: "effort-deep",
      eyebrow: ["Mode Mendalam", metaSuffix || period].join(" · "),
      headline: firstName
        ? `Topik berat apa nih, ${firstName}?`
        : "Topik berat apa yang mau dibedah?",
      subline: weakTopic
        ? `Pas buat membongkar ${weakTopic} sampai tuntas.`
        : "Dibahas mendalam, bertahap, dan cek logikamu.",
      primaryAction: weakTopic
        ? {
            label: `Bedah ${weakTopic}`,
            prompt: `Jelaskan secara mendalam dan terstruktur materi tersulit di ${weakTopic}, lalu ajak aku latihan berpikir bertahap.`,
            mode: "ask",
          }
        : {
            label: "Pecah konsep sulit",
            prompt: "Aku punya konsep yang terasa rumit. Bantu aku memahaminya dari dasar sampai mahir langkah demi langkah.",
            mode: "ask",
          },
    });
  } else if (input.effort === "Kilat") {
    candidates.push({
      id: "effort-fast",
      eyebrow: ["Mode Kilat", metaSuffix || period].join(" · "),
      headline: firstName
        ? `Butuh paham cepat soal apa, ${firstName}?`
        : "Butuh jawaban cepat soal apa?",
      subline: "Ringkas, langsung ke inti dan contoh kunci.",
      primaryAction: {
        label: "Rangkum 3 poin inti",
        prompt: "Tolong jelaskan inti topik berikut secara super ringkas dalam 3 poin kunci + 1 contoh cepat:",
        mode: "ask",
      },
    });
  }

  // 7. Weak topic + Learning style coaching
  if (weakTopic && input.mode === "ask") {
    candidates.push({
      id: "weak-topic",
      eyebrow: ["Dipersonalisasi", metaSuffix || period].join(" · "),
      headline: `Fokus ke ${weakTopic} hari ini?`,
      subline: habitHint
        ? `Dijelaskan ${habitHint}.`
        : "Mulai dari konsep paling dasar biar langsung klik.",
      primaryAction: {
        label: `Mulai ${weakTopic}`,
        prompt: `Bantu aku belajar ${weakTopic} dengan cara yang paling mudah dipahami, lalu beri 2 latihan soal ringan.`,
        mode: "ask",
      },
    });
  }

  // 8. Time-of-day baseline (always available fallback, still personalized!)
  candidates.push({
    id: "time-default",
    eyebrow: [period, metaSuffix || profileData.analysis?.psyLabel || "Momo AI"]
      .filter(Boolean)
      .join(" · "),
    headline: firstName
      ? `${greeting}. Belajar apa hari ini?`
      : "Mau belajar apa hari ini?",
    subline: habitHint
      ? `Siap bantu ${habitHint}.`
      : "Tanya konsep, buat catatan, atau latihan soal.",
    primaryAction:
      dueCards === 0 && totalNotes > 0 && anyNoteId
        ? { label: "Uji lewat kuis", href: `/dashboard-v2/note/${encodeURIComponent(anyNoteId)}/quiz` }
        : dueCards === 0 && totalNotes > 0
          ? { label: "Buka catatan", href: "/dashboard-v2/catatan" }
          : undefined,
  });

  // Ensure mode === "note" always stays top-of-mind when user explicitly switched to Note toggle.
  if (input.mode === "note") {
    const noteItem = candidates.find((c) => c.id === "mode-note");
    if (noteItem) {
      return [noteItem, ...candidates.filter((c) => c.id !== "mode-note")];
    }
  }

  return candidates;
}

export function selectAgenticGreeting(input: AgenticGreetingInput): AgenticGreeting {
  const candidates = buildAgenticCandidates(input);
  if (candidates.length === 0) {
    return {
      id: "fallback",
      eyebrow: "Asisten Belajar AI",
      headline: "Mau belajar apa hari ini?",
      subline: "Tanyakan konsep apa saja, rangkum catatan, atau uji pemahamanmu.",
    };
  }
  const idx = Math.abs(Math.trunc(input.rotationIndex ?? 0)) % candidates.length;
  return candidates[idx];
}
