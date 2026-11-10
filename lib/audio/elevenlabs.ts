/** Server-only. Replays failed requests before any audio is sent to the client. */
export function hasElevenLabsKey() {
  return !!(process.env.ELEVENLABS_API_KEY?.trim() || process.env.ELEVENLABS_API_KEY_FALLBACK?.trim());
}

export async function elevenLabsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const keys = [...new Set([process.env.ELEVENLABS_API_KEY, process.env.ELEVENLABS_API_KEY_FALLBACK]
    .map(key => key?.trim()).filter((key): key is string => !!key))];
  if (!keys.length) throw new Error("ElevenLabs is not configured");
  for (let index = 0; index < keys.length; index++) {
    const headers = new Headers(init.headers);
    headers.set("xi-api-key", keys[index]);
    const response = await fetch(url, { ...init, headers });
    if (response.ok || index === keys.length - 1 || init.signal?.aborted) return response;
    let exhausted = response.status === 402 || response.status === 429;
    if (response.status === 400 || response.status === 401) {
      const body = await response.clone().json().catch(() => null);
      exhausted = body?.detail?.status === "quota_exceeded";
    }
    if (!exhausted) return response;
    void response.body?.cancel().catch(() => {});
  }
  throw new Error("ElevenLabs request failed");
}
