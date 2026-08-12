import { NextRequest, NextResponse } from "next/server";

import { aiChatJson, hasAiKey } from "@/lib/ai";
import type { OnboardingAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FALLBACK: OnboardingAnalysis = {
  tagline: "Tutor Socratic-mu siap bikin kamu paham, bukan cuma hafal!",
  learningStyle:
    "Profil belajarmu sudah tercatat. Saat materi baru masuk, Eureka akan menyesuaikan cara membimbingmu.",
  psyLabel: "Si Penasaran Adaptif",
  psySummary:
    "Kamu belajar paling nyaman saat bebas mengeksplorasi dengan caramu sendiri. Eureka akan menyesuaikan ritmenya denganmu.",
  recommendations: [
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
  ],
  studyTips: [
    "Belajar rutin 25 menit per sesi lebih efektif daripada maraton panjang.",
  ],
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      education?: string;
      grade?: string;
      psyAnswers?: Record<string, string>;
      weakTopic?: string;
      learningHabit?: string;
      peakHour?: string;
    } | null;

    const name = String(body?.name ?? "").trim().slice(0, 60);
    const education = String(body?.education ?? "").trim().slice(0, 40);
    const grade = String(body?.grade ?? "").trim().slice(0, 40);
    const psyAnswers =
      body?.psyAnswers && typeof body.psyAnswers === "object"
        ? body.psyAnswers
        : {};
    const weakTopic = String(body?.weakTopic ?? "").trim().slice(0, 80);
    const learningHabit = String(body?.learningHabit ?? "").trim().slice(0, 80);
    const peakHour = String(body?.peakHour ?? "").trim().slice(0, 40);

    if (!name) {
      return NextResponse.json(
        { error: "Nama diperlukan untuk analisis." },
        { status: 400 }
      );
    }

    // Tanpa API key AI → pakai konten umum (offline-friendly).
    if (!hasAiKey()) {
      return NextResponse.json({ analysis: FALLBACK });
    }

    // Tingkat pendidikan → konteks materi yang relevan.
    const eduContext: Record<string, string> = {
      sd: "Siswa SD (kelas 1-6): materi dasar seperti operasi hitung, pecahan, geometri sederhana; gunakan bahasa sangat sederhana dan contoh sehari-hari",
      smp: "Siswa SMP (kelas 7-9): aljabar dasar, persamaan linear, statistika sederhana; gunakan bahasa sederhana dengan analogi",
      sma: "Siswa SMA (kelas 10-12): aljabar lanjut, turunan, integral, trigonometri, statistika; bahasa formal santai, siap menghadapi ujian sekolah/UTBK",
      mahasiswa: "Mahasiswa: kalkulus, aljabar linear, statistika lanjut, mata kuliah eksakta; pendekatan analitis dan penjelasan yang dalam",
    };
    const eduLine = eduContext[education] ?? "Jenjang umum: sesuaikan tingkat kesulitan penjelasan dengan kelas yang disebutkan";

    const psyLines = Object.entries(psyAnswers)
      .map(([qid, trait]) => `- ${qid}: ${trait}`)
      .join("\n");

    const analysis = await aiChatJson<OnboardingAnalysis>(
      {
        system:
          "Kamu adalah psikolog belajar & perancang pengalaman edukasi Eureka.AI. Analisis hasil tes kepribadian belajar siswa lalu susun rekomendasi belajar yang PERSONAL dan SESUAI JENJANG PENDIDIKANNYA. Jawab HANYA JSON valid tanpa teks lain.",
        user: `Analisis profil siswa berikut lalu susun rekomendasi belajar:
- Nama: ${name || "-"}
- Jenjang pendidikan: ${education || "-"} (${eduLine})
- Kelas/Semester: ${grade || "-"}
- Topik matematika yang paling sulit: ${weakTopic || "-"}
- Kebiasaan saat menemui soal sulit: ${learningHabit || "-"}
- Waktu paling fokus: ${peakHour || "-"}

Hasil TES KEPSIKOLOGI BELAJAR (question_id: trait yang dipilih):
${psyLines || "- belum diisi -"}

Berdasarkan jawaban tes tersebut, tentukan "tipe kepribadian belajar"-nya (kamu boleh menamai tipe yang menarik & positif, mis. "Si Analitis Santai", "Penjelajah Visual", dsb) dan jelaskan singkat.

Sesuaikan SEMUA rekomendasi dengan jenjang tersebut: tingkat kesulitan materi, cara menjelaskan, dan target belajar (ulangan harian → UTBK → kuliah).

Output JSON dengan skema:
{
  "tagline": "kalimat penyambutan 1 kalimat, menyebut nama, bahasa Indonesia santai",
  "psyLabel": "nama tipe kepribadian belajar yang menarik, maksimal 4 kata",
  "psySummary": "ringkasan kepribadian belajar 2-3 kalimat berdasarkan jawaban tes, bahasa santai",
  "learningStyle": "analisis singkat 2-3 kalimat tentang gaya belajarnya + saran umum",
  "recommendations": [{"icon": "emoji", "title": "judul pendek", "desc": "deskripsi 1 kalimat yang relevan dengan profil & jenjangnya"}],
  "studyTips": ["3 tips belajar singkat yang personal untuk profil dan jenjang ini"]
}
Maksimal 4 rekomendasi dan 3 tips.`,
        json: true,
        maxTokens: 1500,
        temperature: 0.6,
      },
      (raw) => {
        const obj = JSON.parse(
          raw.replace(/```(?:json)?/gi, "").trim()
        ) as Partial<OnboardingAnalysis>;
        return {
          tagline:
            typeof obj.tagline === "string" && obj.tagline.trim()
              ? obj.tagline.trim().slice(0, 200)
              : FALLBACK.tagline,
          psyLabel:
            typeof obj.psyLabel === "string" && obj.psyLabel.trim()
              ? obj.psyLabel.trim().slice(0, 60)
              : FALLBACK.psyLabel,
          psySummary:
            typeof obj.psySummary === "string" && obj.psySummary.trim()
              ? obj.psySummary.trim().slice(0, 600)
              : FALLBACK.psySummary,
          learningStyle:
            typeof obj.learningStyle === "string" && obj.learningStyle.trim()
              ? obj.learningStyle.trim().slice(0, 1000)
              : FALLBACK.learningStyle,
          recommendations: Array.isArray(obj.recommendations)
            ? obj.recommendations
                .map((r) => ({
                  icon:
                    typeof r.icon === "string" && r.icon.trim()
                      ? r.icon.trim().slice(0, 8)
                      : "✨",
                  title:
                    typeof r.title === "string" && r.title.trim()
                      ? r.title.trim().slice(0, 80)
                      : "Rekomendasi",
                  desc:
                    typeof r.desc === "string" && r.desc.trim()
                      ? r.desc.trim().slice(0, 300)
                      : "",
                }))
                .filter((r) => r.desc)
                .slice(0, 4)
            : FALLBACK.recommendations,
          studyTips: Array.isArray(obj.studyTips)
            ? obj.studyTips
                .map((t) => (typeof t === "string" ? t.trim() : ""))
                .filter(Boolean)
                .slice(0, 3)
            : FALLBACK.studyTips,
        };
      }
    );

    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menganalisis profil.";
    console.error("[api/onboarding/analyze]", e);
    // Analisis AI gagal → tetap berikan konten umum agar onboarding lancar.
    return NextResponse.json({ analysis: FALLBACK });
  }
}
