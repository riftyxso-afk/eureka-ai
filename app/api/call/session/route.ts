import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });

  ensureRateLimitPrune();
  if (!checkRateLimit(`call-session:${auth.userId}`, 20, 3_600_000).ok) {
    return Response.json({ error: "Batas sesi suara tercapai. Coba lagi nanti." }, { status: 429 });
  }
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return Response.json({ error: "Panggilan suara belum dikonfigurasi." }, { status: 503 });

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": key },
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
