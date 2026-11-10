/** Server-only speech recognition. The API key never reaches the browser. */
export class TranscriptionError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function transcribeRecording(audio: Blob, filename: string, language: "id" | "en" = "id"): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new TranscriptionError("Transkripsi suara belum dikonfigurasi. Coba lagi nanti.", 503);
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2");
  form.append("language_code", language);
  form.append("timestamps_granularity", "none");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": key }, body: form,
      signal: AbortSignal.timeout(90_000), cache: "no-store",
    });
  } catch {
    throw new TranscriptionError("Layanan transkripsi belum merespons. Silakan coba lagi.", 504);
  }
  if (!response.ok) {
    if (response.status === 429) throw new TranscriptionError("Layanan suara sedang sibuk. Coba lagi sebentar.", 429);
    throw new TranscriptionError("Transkripsi suara sedang tidak tersedia. Silakan coba lagi nanti.");
  }
  const result = await response.json() as { text?: unknown };
  const text = typeof result.text === "string" ? result.text.trim() : "";
  if (!text) throw new TranscriptionError("Tidak ada ucapan yang terdeteksi. Coba bicara lebih jelas.", 422);
  return text;
}
