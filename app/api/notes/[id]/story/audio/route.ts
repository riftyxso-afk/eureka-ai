import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { db } from "@/lib/supabase/admin";
import { STORY_VOICES } from "@/lib/storyVoices";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 5000) return NextResponse.json({ error: "Teks cerita harus berisi 1–5.000 karakter." }, { status: 400 });
  const { id } = await params;
  const { data, error } = await db().from("notes").select("id").eq("id", id).eq("user_id", auth.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Catatan belum bisa diperiksa." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (body?.voiceId !== undefined && (typeof body.voiceId !== "string" || !STORY_VOICES.some(voice => voice.id === body.voiceId))) return NextResponse.json({ error: "Pilihan suara tidak tersedia." }, { status: 400 });
  const voice = body?.voiceId || process.env.ELEVENLABS_VOICE_ID?.trim() || "hpp4J3VqNfWAUOO0d1Us";
  const model = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_v4";
  if (!key) return NextResponse.json({ error: "Suara ElevenLabs belum dikonfigurasi." }, { status: 503 });
  ensureRateLimitPrune();
  if (!checkRateLimit(`note-story-audio:${auth.userId}`, 15, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Batas pembuatan suara tercapai. Silakan coba lagi nanti." }, { status: 429 });
  try {
    const dialogue = model.startsWith("eleven_v4");
    const endpoint = dialogue ? "text-to-dialogue" : `text-to-speech/${encodeURIComponent(voice)}`;
    const upstream = await fetch(`https://api.elevenlabs.io/v1/${endpoint}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(dialogue ? { inputs: [{ text, voice_id: voice }], model_id: model, language_code: "id" } : { text, model_id: model, language_code: "id" }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
    });
    if (!upstream.ok) {
      const status = upstream.status;
      const message = status === 402 ? "Paket atau kuota ElevenLabs tidak mendukung suara ini." : status === 429 ? "Layanan suara sedang sibuk. Coba lagi sebentar." : "Suara belum bisa dibuat. Periksa konfigurasi ElevenLabs.";
      return NextResponse.json({ error: message }, { status: status === 429 ? 429 : 502 });
    }
    if (!upstream.body) return NextResponse.json({ error: "Audio tidak tersedia." }, { status: 502 });
    return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Layanan suara belum dapat dihubungi. Coba lagi." }, { status: 502 });
  }
}
