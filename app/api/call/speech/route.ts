import { elevenLabsFetch, hasElevenLabsKey } from "@/lib/audio/elevenlabs";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 5000) return NextResponse.json({ error: "Teks harus berisi 1–5.000 karakter." }, { status: 400 });
  const configured = hasElevenLabsKey();
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim() || "hpp4J3VqNfWAUOO0d1Us";
  const model = process.env.ELEVENLABS_CALL_MODEL_ID?.trim() || "eleven_flash_v2_5";
  if (!configured) return NextResponse.json({ error: "Suara ElevenLabs belum dikonfigurasi." }, { status: 503 });
  ensureRateLimitPrune();
  if (!checkRateLimit(`call-audio:${auth.userId}`, 30, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Batas suara tercapai. Coba lagi nanti." }, { status: 429 });
  try {
    const endpoint = `text-to-speech/${encodeURIComponent(voice)}/stream`;
    const response = await elevenLabsFetch(`https://api.elevenlabs.io/v1/${endpoint}?output_format=pcm_24000`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok || !response.body) return NextResponse.json({ error: response.status === 402 ? "Paket atau kuota ElevenLabs tidak mendukung suara ini." : "Suara belum bisa dibuat. Coba lagi." }, { status: 502 });
    return new Response(response.body, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Layanan suara belum dapat dihubungi." }, { status: 502 }); }
}
