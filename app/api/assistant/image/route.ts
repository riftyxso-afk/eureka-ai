/**
 * POST /api/assistant/image — Generate gambar AI (Cloudflare Workers AI / FLUX).
 *
 * Dua langkah supaya gambar SELALU sesuai topik yang dibahas:
 *  1. Susun prompt ilustrasi yang jelas via AI: gabungkan deskripsi user
 *     ("buat gambar ...") + konteks percakapan (topik yang sedang dibahas).
 *     Kalau user cuma bilang "buat gambar aja", topik diambil dari riwayat
 *     chat (mis. sedang bahas sejarah → gambar sejarah, bukan topik lain).
 *  2. Generate via Cloudflare Workers AI (FLUX) → data URL PNG base64.
 *
 * Body: { prompt: string, history?: { role, content }[] }
 * Respon: { ok, dataUrl, alt } | { ok:false, error }
 */
import { NextRequest } from "next/server";

import { aiChat, hasAiKey } from "@/lib/ai";
import {
  buildIllustrationPrompt,
  generateAiIllustration,
  isCloudflareImagesConfigured,
} from "@/lib/cloudflareImages";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { enforcePremium } from "@/lib/premium";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_HISTORY_CHARS = 400;

/**
 * Ambil topik dari konteks percakapan: pesan user terakhir (selain prompt
 * gambar) + baris pertama jawaban AI terakhir — istilah topik biasanya ada
 * di sana. Return "" bila tidak ada konteks.
 */
function extractTopicFromHistory(
  prompt: string,
  history: { role: string; content: string }[]
): string {
  const userMsgs: string[] = [];
  const aiLines: string[] = [];
  for (const m of history) {
    const text = String(m.content ?? "").trim();
    if (!text || text === prompt) continue;
    if (m.role === "assistant") {
      aiLines.push(text.split(/\r?\n/)[0].slice(0, 160));
    } else {
      userMsgs.push(text.slice(0, 200));
    }
  }
  const parts = [...userMsgs.slice(-2), ...aiLines.slice(-1)];
  const topic = parts.join(" ").slice(0, MAX_HISTORY_CHARS);
  return topic;
}

export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as {
    prompt?: unknown;
    history?: unknown;
    userId?: unknown;
  } | null;

  const prompt = String(raw?.prompt ?? "").trim().slice(0, 500);
  const userId = String(raw?.userId ?? "").trim();
  if (!prompt || !userId) {
    return Response.json(
      { error: "prompt dan userId diperlukan." },
      { status: 400 }
    );
  }

  // Auth: token wajib & cocok dengan userId.
  const auth = await authorizeAssistantUser(
    req.headers.get("authorization"),
    userId
  );
  if (!auth.userId) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  // Gating premium: generate gambar AI hanya untuk pengguna Pro.
  const premiumImg = await enforcePremium(auth.userId, "assistant-image");
  if (!premiumImg.ok) {
    return Response.json(
      { error: premiumImg.error, upgradeUrl: premiumImg.upgradeUrl },
      { status: premiumImg.status ?? 402 }
    );
  }

  // Rate limit ringan: 8 generate gambar / menit / user.
  ensureRateLimitPrune();
  const rl = checkRateLimit(`img:${auth.userId}`, 8, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Terlalu banyak permintaan. Tunggu sebentar ya." },
      { status: 429 }
    );
  }

  if (!isCloudflareImagesConfigured()) {
    return Response.json(
      {
        error:
          "Generate gambar belum aktif — tambahkan CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN di .env (gratis di Cloudflare).",
      },
      { status: 400 }
    );
  }

  // Konteks percakapan (untuk topik bila deskripsi kosong / kurang jelas).
  const history: { role: string; content: string }[] = Array.isArray(raw?.history)
    ? (raw.history as { role?: string; content?: string }[])
        .filter((m) => typeof m?.content === "string")
        .map((m) => ({ role: m.role ?? "user", content: m.content ?? "" }))
        .slice(-10)
    : [];
  const contextTopic = extractTopicFromHistory(prompt, history);

  try {
    // 1) Susun prompt ilustrasi yang sesuai TOPIK via AI (mode fast — hemat).
    let illustrationPrompt = "";
    if (hasAiKey()) {
      const system =
        "Kamu adalah ilustrator edukasi. Dari permintaan user + topik konteks percakapan, tulis SATU prompt gambar ilustrasi (maks 2 kalimat, bahasa Indonesia) yang menggambarkan topik secara akurat. JANGAN ganti topik. Jangan sebut 'permintaan' — langsung deskripsi gambarnya saja.";
      const user = `Permintaan user: ${prompt}\n\nTopik konteks percakapan (gunakan ini bila permintaan tidak menyebut topik spesifik): ${contextTopic || "(tidak ada)"}`;
      try {
        const rawPrompt = await aiChat({
          system,
          user,
          maxTokens: 160,
          temperature: 0.5,
          speedMode: "fast",
        });
        illustrationPrompt = rawPrompt.trim().slice(0, 300);
      } catch (e) {
        console.warn("[api/assistant/image] AI prompt gagal — pakai mentah:", e);
      }
    }
    // Fallback: prompt mentah (tanpa penyusunan AI) tetap diikuti topik konteks.
    if (!illustrationPrompt) {
      illustrationPrompt = buildIllustrationPrompt({
        chapterTitle: prompt,
        noteTitle: contextTopic || undefined,
      });
    }

    // 2) Generate gambar.
    const dataUrl = await generateAiIllustration(illustrationPrompt);
    if (!dataUrl) {
      return Response.json(
        { error: "Gagal membuat gambar. Coba lagi beberapa saat lagi." },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      dataUrl,
      alt: prompt.slice(0, 120),
      promptUsed: illustrationPrompt.slice(0, 200),
    });
  } catch (e) {
    console.error("[api/assistant/image]", e);
    return Response.json(
      { error: "Terjadi kesalahan saat membuat gambar." },
      { status: 500 }
    );
  }
}
