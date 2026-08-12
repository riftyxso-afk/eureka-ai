import type { OnboardingAnalysis } from "@/lib/types";

export const EDUCATION_LABELS: Record<string, string> = {
  sd: "SD (Sekolah Dasar)",
  smp: "SMP (Sekolah Menengah Pertama)",
  sma: "SMA (Sekolah Menengah Atas)",
  mahasiswa: "Mahasiswa",
  lainnya: "Lainnya",
};

export interface ProfileInput {
  name?: string | null;
  username?: string | null;
  userNumber?: number | null;
  education?: string;
  grade?: string;
  /** Jawaban tes psikologi belajar: questionId → trait. */
  psyAnswers?: Record<string, string> | null;
  weakTopic?: string;
  learningHabit?: string;
  peakHour?: string;
  plan?: string;
  analysis?: OnboardingAnalysis | null;
}

/** Rangkum kebutuhan user dari jawaban onboarding menjadi markdown agar AI paham profil user. */
export function buildProfileMarkdown(input: ProfileInput): string {
  const lines: string[] = [
    "# Profil User Eureka.AI",
    "",
    `- Nama: ${input.name?.trim() || "-"}`,
    `- Username: @${(input.username ?? "").trim() || "-"}`,
    `- No. Pengguna: ${input.userNumber ?? "-"}`,
    `- Plan: ${input.plan === "pro" ? "Pro" : "Free"}`,
  ];

  const education = input.education
    ? EDUCATION_LABELS[input.education] ?? input.education
    : "";
  if (education) lines.push(`- Jenjang Pendidikan: ${education}`);
  if (input.grade?.trim()) lines.push(`- Kelas/Semester: ${input.grade.trim()}`);

  lines.push(
    "",
    "## Kebutuhan & Preferensi Belajar",
    "",
    `- Topik tersulit: ${input.weakTopic?.trim() || "-"}`,
    `- Kebiasaan saat soal sulit: ${input.learningHabit?.trim() || "-"}`,
    `- Waktu paling fokus: ${input.peakHour?.trim() || "-"}`,
  );

  const psyAnswers = input.psyAnswers ?? {};
  const psyEntries = Object.entries(psyAnswers).filter(
    ([, trait]) => typeof trait === "string" && trait.trim()
  );
  if (psyEntries.length > 0) {
    lines.push("", "## Hasil Tes Kepribadian Belajar", "");
    for (const [qid, trait] of psyEntries) {
      lines.push(`- ${qid}: ${String(trait).trim()}`);
    }
  }

  const analysis = input.analysis;
  if (analysis?.psyLabel || analysis?.psySummary) {
    lines.push("", "## Tipe Kepribadian Belajar", "");
    if (analysis.psyLabel) lines.push(`- Tipe: ${analysis.psyLabel.trim()}`);
    if (analysis.psySummary) lines.push(`- Ringkasan: ${analysis.psySummary.trim()}`);
  }
  if (analysis?.learningStyle) {
    lines.push("", "## Analisis AI", "", `- Gaya belajar: ${analysis.learningStyle.trim()}`);
  }
  if (analysis?.recommendations?.length) {
    lines.push("", "## Rekomendasi", "");
    for (const rec of analysis.recommendations) {
      lines.push(`- ${rec.icon} ${rec.title}: ${rec.desc}`);
    }
  }
  if (analysis?.studyTips?.length) {
    lines.push("", "## Tips Belajar", "");
    for (const tip of analysis.studyTips) lines.push(`- ${tip}`);
  }

  lines.push(
    "",
    "## Panduan AI",
    "",
    "Gunakan profil di atas saat menjawab pertanyaan user. Sesuaikan penjelasan dengan jenjang pendidikan, topik tersulit, kebiasaan belajar, dan waktu fokus mereka. Selalu jawab dalam Bahasa Indonesia yang santai dan mudah dipahami.",
  );

  return lines.join("\n");
}

/** Ambil profile_md dari data baris users (profile_md di DB atau turunkan dari profile_data). */
export function getProfileMd(row: {
  profile_md?: string | null;
  name?: string | null;
  username?: string | null;
  user_number?: number | null;
  profile_data?: Record<string, unknown> | null;
}): string {
  if (row.profile_md?.trim()) return row.profile_md;

  const pd = (row.profile_data ?? {}) as Record<string, unknown>;
  return buildProfileMarkdown({
    name: row.name,
    username: row.username,
    userNumber: row.user_number,
    education: typeof pd.education === "string" ? pd.education : "",
    grade: typeof pd.grade === "string" ? pd.grade : "",
    psyAnswers:
      pd.psyAnswers && typeof pd.psyAnswers === "object"
        ? (pd.psyAnswers as Record<string, string>)
        : null,
    weakTopic: typeof pd.weakTopic === "string" ? pd.weakTopic : "",
    learningHabit: typeof pd.learningHabit === "string" ? pd.learningHabit : "",
    peakHour: typeof pd.peakHour === "string" ? pd.peakHour : "",
    plan: typeof pd.plan === "string" ? pd.plan : "free",
    analysis:
      pd.analysis && typeof pd.analysis === "object"
        ? (pd.analysis as OnboardingAnalysis)
        : null,
  });
}
