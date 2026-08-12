/**
 * POST /api/missions/guide — AI menyusun strategi bimbingan untuk sebuah misi
 * belajar (kejar IPK, lolos SNBP/SNBT, target pribadi).
 *
 * Body: { type, title, currentValue, targetValue, unit, deadline, education }
 * Response: { guide, steps[] }
 */
import { NextRequest, NextResponse } from "next/server";

import { aiChat, hasAiKey } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const TYPE_CONTEXT: Record<string, string> = {
  ipk: `Misi: Mahasiswa mengejar IPK (Indeks Prestasi Kumulatif, skala 0-4).
Susun strategi belajar semestersan: pemilihan beban SKS, prioritas mata kuliah berbobot tinggi,
teknik belajar aktif (active recall, spaced repetition), kelompok belajar, manajemen waktu,
dan tips menghadapi ujian agar IPK naik konsisten dari semester ke semester.`,
  snbp: `Misi: Siswa SMA kelas 12 mengejar lolos SNBP (Seleksi Nasional Berdasarkan Prestasi).
SNBP dinilai dari nilai rapor (minimal 50% bobot), prestasi akademik/non-akademik (portofolio),
dan konsistensi nilai dari semester 1-5. Susun strategi: menjaga nilai rapor semua mapel,
membuat portofolio prestasi yang kuat (lomba, organisasi, sertifikat), memilih PTN/prodi sesuai
daya tampung & passing grade, dan timeline persiapan dari kelas 10-12.`,
  snbt: `Misi: Siswa SMA kelas 12 mengejar lolos SNBT (Seleksi Nasional Berdasarkan Tes — UTBK).
SNBT menguji Penalaran Umum, Literasi (bahasa Indonesia & Inggris), dan Penalaran Matematika.
Susun strategi: rencana belajar mingguan per subtes, latihan soal UTBK bertahap, evaluasi try out,
manajemen waktu saat ujian, dan daftar PTN/prodi sesuai skor target.`,
  umum: `Misi: Target belajar pribadi. Susun strategi belajar yang jelas: pecah target menjadi
materi yang bisa dipelajari, buat jadwal, teknik mengingat yang efektif, dan cara mengukur kemajuan.`,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      type?: string;
      title?: string;
      currentValue?: number;
      targetValue?: number;
      unit?: string;
      deadline?: string;
      education?: string;
    } | null;

    const type = String(body?.type ?? "umum");
    const title = String(body?.title ?? "Misi Belajar").slice(0, 120);
    const current =
      body?.currentValue != null && Number.isFinite(Number(body.currentValue))
        ? Number(body.currentValue)
        : undefined;
    const target =
      body?.targetValue != null && Number.isFinite(Number(body.targetValue))
        ? Number(body.targetValue)
        : undefined;
    const unit = String(body?.unit ?? "nilai").slice(0, 30);
    const deadline = String(body?.deadline ?? "").slice(0, 30);
    const education = String(body?.education ?? "").slice(0, 60);

    if (!hasAiKey()) {
      return NextResponse.json(
        {
          guide:
            "AI belum tersedia (API key belum diatur). Misi tetap tersimpan — isi API key dulu agar mendapat bimbingan pribadi.",
          steps: [
            "Pantau nilai/menuju target secara rutin (mis. mingguan).",
            "Pecah target menjadi materi kecil yang bisa dipelajari setiap hari.",
            "Evaluasi kemajuan tiap 2 minggu dan sesuaikan strategi.",
          ],
        },
        { status: 200 }
      );
    }

    const context = TYPE_CONTEXT[type] ?? TYPE_CONTEXT.umum;

    const prompt = `Buat strategi bimbingan belajar yang AKURAT dan TERPERINCI untuk misi berikut:

${context}

DATA MISI:
- Judul: ${title}
- Nilai sekarang: ${current != null ? current : "belum diisi"} ${unit}
- Target: ${target != null ? target : "belum diisi"} ${unit}
- Tenggat: ${deadline || "tidak ditentukan"}
${education ? `- Jenjang/Kelas: ${education}` : ""}

Susun respons HANYA dalam Bahasa Indonesia dengan format:

GUIDE (1 paragraf pendek, 2-3 kalimat) — gambaran besar strategi.

STEPS (4-6 langkah konkret, urut):
- 1. <langkah> — beri detail singkat & realistis.
- 2. ...

Pastikan langkah sesuai jenis misi di atas, angka dan istilah akurat (SNBP/SNBT/UTBK/IPK), dan dapat langsung dijalankan minggu ini.`;

    const raw = await aiChat({
      system:
        "Kamu adalah mentor belajar (study coach) yang berpengalaman membimbing mahasiswa kejar IPK dan siswa SMA menuju SNBP/SNBT. Jawab akurat, spesifik, dan tidak bertele-tele.",
      user: prompt,
      maxTokens: 1200,
      temperature: 0.4,
    });

    // Pisahkan GUIDE dan STEPS dari teks AI.
    const guideMatch = raw.match(/GUIDE\s*:?\s*([\s\S]*?)(?=STEPS)/i);
    const stepsBlock = raw.match(/STEPS\s*:?([\s\S]*)$/i);
    const guide = (guideMatch?.[1] ?? raw).trim().slice(0, 600);
    const steps = (stepsBlock?.[1] ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
      .filter((l) => l.length > 10)
      .slice(0, 6);

    return NextResponse.json({
      guide,
      steps: steps.length > 0 ? steps : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyusun bimbingan.";
    console.error("[api/missions/guide]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
