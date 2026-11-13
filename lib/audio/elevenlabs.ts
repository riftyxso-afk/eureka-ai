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
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (error) {
      if (init.signal?.aborted || index === keys.length - 1 || init.body instanceof ReadableStream) throw error;
      continue;
    }
    if (response.ok || index === keys.length - 1 || init.signal?.aborted) return response;
    let exhausted = response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429 || response.status >= 500;
    if (response.status === 400 || response.status === 401) {
      const body = await response.clone().json().catch(() => null);
      exhausted ||= body?.detail?.status === "quota_exceeded";
    }
    if (!exhausted || init.body instanceof ReadableStream) return response;
    void response.body?.cancel().catch(() => {});
  }
  throw new Error("ElevenLabs request failed");
}
