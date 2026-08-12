/**
 * Konfigurasi AI terpusat — multi-provider (semuanya OpenAI-compatible).
 *
 * Provider utama (env AI_PROVIDER):
 * - "openagentic" (default) → https://openagentic.id/api/v1 (37+ model, 1 key)
 * - "aimurah"               → https://aimurah.my.id/api/v1
 * - "openai"                → https://api.openai.com/v1
 *
 * Fallback otomatis: bila provider utama gagal (502/503/timeout/sibuk),
 * panggilan dialihkan ke OpenRouter (bila OPENROUTER_API_KEY diisi).
 *
 * Auth: Authorization: Bearer <key>; endpoint: POST /chat/completions.
 *
 * Env:
 * - AI_PROVIDER             (default "openagentic")
 * - OPENAGENTIC_API_KEY     (key openagentic.id, awalan sk-…)
 * - OPENAGENTIC_BASE_URL    (default https://openagentic.id/api/v1)
 * - OPENAGENTIC_MODEL       (default claude-sonnet-4.5)
 * - AI_API_KEY              (AIMurah; fallback ke OPENAI_API_KEY)
 * - AI_BASE_URL             (base URL AIMurah, default https://aimurah.my.id/api/v1)
 * - AI_MODEL                (model AIMurah, default deepseek-v4-flash)
 * - OPENAI_API_KEY          (OpenAI resmi)
 * - OPENROUTER_API_KEY      (key openrouter.ai, awalan sk-or-…; fallback saat utama down)
 * - OPENROUTER_BASE_URL     (default https://openrouter.ai/api/v1)
 * - OPENROUTER_MODEL        (default openai/gpt-4o-mini)
 * - JUANROUTER_API_KEY      (key router.juan.web.id, awalan sk-…; fallback terakhir)
 * - JUANROUTER_BASE_URL     (default https://router.juan.web.id/v1)
 * - JUANROUTER_MODEL        (default deepseek-v4-flash)
 */
export type AiProvider = "aimurah" | "openai" | "openagentic";

export const AI_PROVIDER: AiProvider =
  (process.env.AI_PROVIDER as AiProvider) ?? "openagentic";

export const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://aimurah.my.id/api/v1";

export const AI_MODEL = process.env.AI_MODEL ?? "deepseek-v4-flash";

export const AI_API_KEY =
  process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export const OPENAGENTIC_BASE_URL =
  process.env.OPENAGENTIC_BASE_URL ?? "https://openagentic.id/api/v1";

export const OPENAGENTIC_API_KEY = process.env.OPENAGENTIC_API_KEY ?? "";

export const OPENAGENTIC_MODEL =
  process.env.OPENAGENTIC_MODEL ?? "claude-sonnet-4.5";

export const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";

export const JUANROUTER_BASE_URL =
  process.env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1";

export const JUANROUTER_API_KEY = process.env.JUANROUTER_API_KEY ?? "";

export const JUANROUTER_MODEL =
  process.env.JUANROUTER_MODEL ?? "deepseek-v4-flash";

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  name: string;
}

function getProviderConfig(): ProviderConfig | null {
  if (AI_PROVIDER === "openagentic") {
    if (!OPENAGENTIC_API_KEY) {
      console.error('[AI Error] OPENAGENTIC_API_KEY is not set in environment variables');
      return null;
    }
    console.log('[AI] Using OpenAgentic provider');
    return {
      baseURL: OPENAGENTIC_BASE_URL,
      apiKey: OPENAGENTIC_API_KEY,
      model: OPENAGENTIC_MODEL,
      name: "OpenAgentic",
    };
  }
  if (AI_PROVIDER === "openai") {
    if (!AI_API_KEY) {
      console.error('[AI Error] AI_API_KEY is not set for OpenAI provider');
      return null;
    }
    console.log('[AI] Using OpenAI provider');
    return {
      baseURL: process.env.OPENAI_BASE_URL ?? OPENAI_BASE_URL,
      apiKey: AI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      name: "OpenAI",
    };
  }
  if (!AI_API_KEY) {
    console.error('[AI Error] AI_API_KEY is not set for AIMurah provider');
    return null;
  }
  console.log('[AI] Using AIMurah provider');
  return {
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
    model: AI_MODEL,
    name: "AIMurah",
  };
}

export function hasAiKey(): boolean {
  return getProviderChain().length > 0;
}

/** Semua provider OpenAI-compatible → embedding & transkripsi tersedia bila ada key. */
export function isOpenAICompatible(): boolean {
  return hasAiKey();
}

/**
 * Rantai provider yang dicoba berurutan: provider utama → OpenRouter
 * → Juan Router (fallback, bila key masing-masing tersedia).
 */
function getProviderChain(): ProviderConfig[] {
  const chain: ProviderConfig[] = [];
  const main = getProviderConfig();
  if (main) chain.push(main);
  if (OPENROUTER_API_KEY) {
    chain.push({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      name: "OpenRouter",
    });
  }
  if (JUANROUTER_API_KEY) {
    chain.push({
      baseURL: JUANROUTER_BASE_URL,
      apiKey: JUANROUTER_API_KEY,
      model: JUANROUTER_MODEL,
      name: "JuanRouter",
    });
  }
  return chain;
}

/** Config {baseURL, apiKey} provider terpilih untuk SDK openai (embedding/transkripsi). */
export function getAiApiConfig(): { baseURL: string; apiKey: string } | null {
  const cfg = getProviderConfig();
  return cfg ? { baseURL: cfg.baseURL, apiKey: cfg.apiKey } : null;
}

export interface AiChatOptions {
  system?: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/** Ekstrak objek JSON dari teks AI (toleran terhadap ```markdown fence & trailing comma). */
export function extractJsonObject<T = Record<string, unknown>>(
  raw: string
): T {
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Respons AI tidak mengandung objek JSON.");
  }
  const candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    // Model thinking kadang menambahkan koma berlebih → perbaiki lalu coba lagi
    const fixed = candidate.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(fixed) as T;
    } catch {
      throw e instanceof Error
        ? new Error(`Respons AI bukan JSON valid: ${e.message}`)
        : e;
    }
  }
}

/**
 * Panggil Chat Completions (OpenAI-compatible) → kembalikan teks jawaban.
 * - Retry otomatis untuk error transien (429, 5xx, timeout/putus jaringan);
 * - Fallback ke provider berikutnya (mis. OpenRouter) bila provider utama
 *   gagal terus-menerus;
 * - Mendukung mode JSON (response_format), dengan retry tanpa response_format
 *   bila provider tidak mendukungnya.
 */
export async function aiChat(options: AiChatOptions): Promise<string> {
  const providers = getProviderChain();
  
  console.log('[AI] aiChat called with options:', {
    hasSystem: !!options.system,
    userLength: options.user?.length || 0,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });
  console.log('[AI] Provider chain length:', providers.length);
  
  if (providers.length === 0) {
    console.error('[AI Error] No providers available in chain');
    const hint =
      AI_PROVIDER === "openagentic"
        ? "Isi OPENAGENTIC_API_KEY di .env.local (daftar & buat key di openagentic.id)."
        : AI_PROVIDER === "openai"
          ? "Isi OPENAI_API_KEY di .env.local."
          : "Tambahkan AI_API_KEY di .env.local (daftar di aimurah.my.id).";
    throw new Error(`API key AI belum diatur. ${hint}`);
  }

  const body: Record<string, unknown> = {
    stream: false,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    messages: [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: options.user },
    ],
  };

  const doRequest = async (provider: ProviderConfig): Promise<string> => {
    body.model = provider.model;
    console.log('[AI] Making request to:', provider.name, provider.baseURL);
    console.log('[AI] Using model:', provider.model);
    
    const res = await fetch(`${provider.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        ...(provider.name === "OpenRouter"
          ? { "X-Title": "Eureka.AI", "HTTP-Referer": "https://eureka-ai.app" }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    console.log('[AI] Response status:', res.status, res.statusText);

    if (!res.ok) {
      let detail = "";
      try {
        const errText = await res.text();
        const err = extractJsonObject(errText) as {
          error?: { message?: string };
        };
        detail = err?.error?.message ?? "";
        console.error('[AI Error] API error details:', err);
      } catch {
        // abaikan
      }
      throw new Error(
        `${provider.name} API error ${res.status}${detail ? `: ${detail}` : ""}`
      );
    }

    // Sebagian gateway (mis. OpenAgentic) menambahkan sisa SSE seperti
    // "data: [DONE]" setelah body JSON → parse manual agar tidak gagal.
    const resText = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(resText) as Record<string, unknown>;
    } catch {
      data = extractJsonObject(resText) as Record<string, unknown>;
    }
    const firstChoice = Array.isArray(data?.choices)
      ? (data.choices[0] as Record<string, unknown> | undefined)
      : undefined;
    const messageObj = firstChoice?.message as Record<string, unknown> | undefined;
    const content = messageObj?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      console.error('[AI Error] Empty response from API');
      throw new Error("AI mengembalikan respons kosong.");
    }
    console.log('[AI] Response received, length:', content.length);
    return content;
  };

  const isRetryable = (e: unknown): boolean => {
    if (e instanceof Error) {
      if (e.name === "TimeoutError" || e.name === "AbortError") return true;
      if (/fetch failed|terminated|ECONNRESET|UndiciError/i.test(e.message))
        return true;
      const m = e.message.match(/API error (\d{3})/);
      if (m) return ["429", "500", "502", "503", "504"].includes(m[1]);
    }
    return false;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Coba tiap provider secara berurutan: utama dulu, lalu fallback (OpenRouter).
  // Error transien (502/saturasi) ditangani retry di dalam loop attempt.
  const attemptsPerProvider = 4;
  const tried: string[] = [];
  for (const provider of providers) {
    tried.push(`${provider.name}/${provider.model}`);
    let useJsonFormat = Boolean(options.json);
    for (let attempt = 1; attempt <= attemptsPerProvider; attempt++) {
      if (useJsonFormat) body.response_format = { type: "json_object" };
      else delete body.response_format;

      try {
        return await doRequest(provider);
      } catch (e) {
        const retryable = isRetryable(e);
        if (retryable && attempt < attemptsPerProvider) {
          // 429/5xx/timeout → upstream sibuk: tunggu sebentar lalu ulangi
          await sleep(2_000);
          continue;
        }
        // Gagal (error apa pun, termasuk 401/403 key invalid): coba sekali
        // tanpa response_format (bila mode JSON), lalu pindah ke provider lain.
        if (Boolean(options.json) && useJsonFormat) {
          useJsonFormat = false;
          try {
            return await doRequest(provider);
          } catch {
            // jatuh ke provider berikutnya
          }
        }
        break;
      }
    }
  }
  throw new Error(
    `Semua provider AI gagal (${tried.join(" → ")}). Coba lagi nanti.`
  );
}

/**
 * Panggil AI lalu parse JSON-nya. Jika output bukan JSON valid (model thinking
 * sering merusak JSON multi-baris, mis. nilai menyatu tanpa koma), coba sekali
 * lagi dengan instruksi STRICT: JSON satu baris, properti dipisah koma.
 */
export async function aiChatJson<T>(
  options: AiChatOptions,
  parse: (raw: string) => T
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const callOptions: AiChatOptions =
      attempt === 0
        ? options
        : {
            ...options,
            system: `${options.system ?? ""}\n\nPENTING: Output harus JSON VALID dalam SATU BARIS (tanpa baris baru di dalam objek/array). Setiap properti WAJIB dipisah tanda koma. Nilai string WAJIB diapit tanda kutip ganda. Jangan satukan dua nilai tanpa koma. Jangan tambahkan teks apa pun di luar JSON.`,
          };
    const raw = await aiChat(callOptions);
    try {
      return parse(raw);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Respons AI bukan JSON valid.");
}
