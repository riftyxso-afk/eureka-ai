import { elevenLabsFetch, hasElevenLabsKey } from "@/lib/audio/elevenlabs";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { AI_SAFETY_GUARDRAIL } from "@/lib/prompts/safety";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ lala: Boolean(process.env.GEMINI_API_KEY?.trim()) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function createLalaSession(request: Request, english: boolean) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return Response.json({ error: "Lala belum diaktifkan. Pilih Momo untuk menelepon." }, { status: 503 });

  const model = "models/gemini-3.8-live";
  const setup = {
    model,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: { parts: [{ text: `Kamu Lala, teman belajar di Eureka. Gunakan ${english ? "bahasa Inggris" : "bahasa Indonesia yang santai"} secara default.
Sapa pengguna dengan hangat saat diminta membuka panggilan, lalu jawab singkat seperti percakapan biasa.
Jika pengguna menyela atau membetulkan ucapannya, ikuti maksud terbaru. Jika hanya bilang "eh, salah", tanyakan maksudnya.

${AI_SAFETY_GUARDRAIL}` }] },
  };
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(Date.now() + 10 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
      bidiGenerateContentSetup: setup,
    }),
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
  });
  if (response.status === 429) {
    return Response.json({ error: "Kuota Lala sedang penuh. Coba lagi nanti atau pilih Momo." }, { status: 429 });
  }
  const data = response.ok ? await response.json() : null;
  if (typeof data?.name !== "string" || !data.name) throw new Error("Missing Gemini Live token");
  return Response.json({ token: data.name, model }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });

  ensureRateLimitPrune();
  if (!checkRateLimit(`call-session:${auth.userId}`, 20, 3_600_000).ok) {
    return Response.json({ error: "Batas sesi suara tercapai. Coba lagi nanti." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (body?.provider === "lala") {
    try {
      return await createLalaSession(request, body.language === "en");
    } catch {
      return Response.json({ error: "Lala belum bisa terhubung. Coba lagi atau pilih Momo." }, { status: 502 });
    }
  }
  const configured = hasElevenLabsKey();
  if (!configured) return Response.json({ error: "Panggilan suara belum dikonfigurasi." }, { status: 503 });

  try {
    const response = await elevenLabsFetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",

      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    });
    const data = await response.json();
    if (response.ok && typeof data.token === "string" && data.token) {
      return Response.json({ token: data.token }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // The client can retry without exposing credentials or provider details.
  }
  return Response.json({ error: "Panggilan belum bisa terhubung. Coba lagi." }, { status: 502 });
}
