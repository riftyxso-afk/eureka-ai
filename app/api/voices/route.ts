import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { STORY_VOICES } from "@/lib/storyVoices";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Suara belum dikonfigurasi." }, { status: 503 });
  try {
    const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new Error("Voice list unavailable");
    const data = await response.json();
    const available = Array.isArray(data.voices) ? data.voices : [];
    const voices = STORY_VOICES.flatMap(voice => {
      const match = available.find((item: { voice_id?: string }) => item.voice_id === voice.id);
      if (!match) return [];
      let previewUrl: string | null = null;
      try { const url = new URL(match.preview_url); if (url.protocol === "https:" && url.hostname === "storage.googleapis.com") previewUrl = url.toString(); } catch { /* preview unavailable */ }
      return [{ ...voice, previewUrl }];
    });
    return NextResponse.json({ voices }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Pilihan suara belum bisa dimuat." }, { status: 502 }); }
}
